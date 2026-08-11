'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { priceShift } from '@/lib/pricing/engine';
import { PricingError } from '@/lib/pricing/types';
import { toRateCardSnapshot } from '@/lib/rate-card-mapper';
import { buildShiftInput, ShiftFormError, type ShiftFormValues } from '@/lib/shift-form';
import { requireSessionUser } from '@/lib/session';

export interface SaveShiftState {
  error?: string;
  savedShiftId?: string;
  totalCents?: number;
}

const timeRangeSchema = z.object({ start: z.string(), end: z.string() });

const formSchema = z.object({
  orgId: z.string().min(1, 'Choose which business this shift is for.'),
  serviceTypeId: z.string().min(1, 'Choose which support this shift was for.'),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  hasUnpaidBreak: z.boolean(),
  breakStart: z.string(),
  breakMinutes: z.coerce.number().min(0),
  isOvernight: z.boolean(),
  sleepoverStart: z.string(),
  sleepoverEnd: z.string(),
  activeSupport: z.array(timeRangeSchema),
  travelKm: z.coerce.number().min(0),
});

/**
 * Re-prices the shift on the server against the worker's real engagement, never
 * trusting whatever total the browser displayed. The client-side preview on the
 * shift-logging page runs the same pure engine for instant feedback, but this is
 * the number that actually gets saved.
 */
export async function saveShiftAction(_prev: SaveShiftState, formData: FormData): Promise<SaveShiftState> {
  const user = await requireSessionUser();

  let activeSupport: unknown;
  try {
    activeSupport = JSON.parse(String(formData.get('activeSupport') ?? '[]'));
  } catch {
    return { error: 'Something went wrong reading the form. Try again.' };
  }

  const parsed = formSchema.safeParse({
    orgId: formData.get('orgId'),
    serviceTypeId: formData.get('serviceTypeId'),
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    hasUnpaidBreak: formData.get('hasUnpaidBreak') === 'true',
    breakStart: formData.get('breakStart') ?? '12:00',
    breakMinutes: formData.get('breakMinutes') ?? 0,
    isOvernight: formData.get('isOvernight') === 'true',
    sleepoverStart: formData.get('sleepoverStart') ?? '22:00',
    sleepoverEnd: formData.get('sleepoverEnd') ?? '06:00',
    activeSupport,
    travelKm: formData.get('travelKm') ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }
  const data = parsed.data;

  const engagement = await db.engagement.findUnique({
    where: { orgId_userId: { orgId: data.orgId, userId: user.id } },
    include: {
      org: true,
      rateCard: { include: { bands: true, rates: true, sleepover: true, travel: true } },
    },
  });
  if (!engagement || !engagement.active) {
    return { error: "You don't have an active engagement with that business." };
  }

  const serviceType = await db.serviceType.findFirst({
    where: { id: data.serviceTypeId, orgId: engagement.orgId, active: true },
  });
  if (!serviceType) return { error: 'Choose a valid support type.' };

  const serviceTypes = await db.serviceType.findMany({ where: { orgId: engagement.orgId } });
  const serviceTypeGst = Object.fromEntries(serviceTypes.map((s) => [s.id, s.gstApplicable]));
  const snapshot = toRateCardSnapshot(engagement.rateCard, serviceTypeGst);

  const holidays = await db.publicHoliday.findMany({ where: { state: engagement.org.state ?? undefined } });

  const formValues: ShiftFormValues = {
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    hasUnpaidBreak: data.hasUnpaidBreak,
    breakStart: data.breakStart,
    breakMinutes: data.breakMinutes,
    isOvernight: data.isOvernight,
    sleepoverStart: data.sleepoverStart,
    sleepoverEnd: data.sleepoverEnd,
    activeSupport: data.activeSupport,
    travelKm: data.travelKm,
  };

  try {
    const shiftInput = buildShiftInput(formValues, engagement.org.timezone, serviceType.id);
    const result = priceShift(shiftInput, snapshot, holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name })));

    const shift = await db.shift.create({
      data: {
        orgId: engagement.orgId,
        userId: user.id,
        serviceTypeId: serviceType.id,
        startUtc: new Date(shiftInput.startUtc),
        endUtc: new Date(shiftInput.endUtc),
        timezone: engagement.org.timezone,
        breaks: shiftInput.breaks ? JSON.parse(JSON.stringify(shiftInput.breaks)) : undefined,
        sleepover: shiftInput.sleepover ? JSON.parse(JSON.stringify(shiftInput.sleepover)) : undefined,
        travelKm: shiftInput.travelKm,
        status: 'SUBMITTED',
        rateCardId: engagement.rateCardId,
        rateCardVersion: engagement.rateCard.version,
        pricingResult: JSON.parse(JSON.stringify(result)),
        subtotalCents: result.subtotalCents,
        gstCents: result.gstCents,
        totalCents: result.totalCents,
      },
    });

    return { savedShiftId: shift.id, totalCents: result.totalCents };
  } catch (error) {
    if (error instanceof ShiftFormError || error instanceof PricingError) return { error: error.message };
    throw error;
  }
}
