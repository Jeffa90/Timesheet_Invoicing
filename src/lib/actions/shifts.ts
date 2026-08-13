'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
const expenseSchema = z.object({ description: z.string(), amountCents: z.number(), gstApplicable: z.boolean() });

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
  expenses: z.array(expenseSchema),
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
  let expenses: unknown;
  try {
    activeSupport = JSON.parse(String(formData.get('activeSupport') ?? '[]'));
    expenses = JSON.parse(String(formData.get('expenses') ?? '[]'));
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
    expenses,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }
  const data = parsed.data;

  // Present only when editing an existing shift rather than logging a new one —
  // see the tail of this function for the update-vs-create branch.
  const shiftId = String(formData.get('shiftId') ?? '') || undefined;
  if (shiftId) {
    const existing = await db.shift.findUnique({ where: { id: shiftId } });
    if (!existing || existing.userId !== user.id) return { error: 'That shift could not be found.' };
    if (existing.status !== 'SUBMITTED') return { error: 'Only shifts that have not been invoiced yet can be edited.' };
  }

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

  const workerProfile = await db.workerProfile.findUnique({ where: { userId: user.id } });
  if (!workerProfile) {
    return { error: 'Set up your invoicing profile before logging a shift.' };
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
    expenses: data.expenses,
  };

  try {
    const shiftInput = buildShiftInput(formValues, engagement.org.timezone, serviceType.id, workerProfile.gstRegistered);
    const result = priceShift(shiftInput, snapshot, holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name })));

    const priced = {
      orgId: engagement.orgId,
      serviceTypeId: serviceType.id,
      startUtc: new Date(shiftInput.startUtc),
      endUtc: new Date(shiftInput.endUtc),
      timezone: engagement.org.timezone,
      travelKm: shiftInput.travelKm,
      status: 'SUBMITTED' as const,
      rateCardId: engagement.rateCardId,
      rateCardVersion: engagement.rateCard.version,
      pricingResult: JSON.parse(JSON.stringify(result)),
      subtotalCents: result.subtotalCents,
      gstCents: result.gstCents,
      totalCents: result.totalCents,
    };

    if (shiftId) {
      // Prisma update leaves a field untouched when it's undefined — unlike
      // create, clearing an optional field (e.g. removing the sleepover on
      // this edit) needs an explicit null, not undefined, or the stale JSON
      // from before the edit would silently survive.
      await db.shift.update({
        where: { id: shiftId },
        data: {
          ...priced,
          breaks: shiftInput.breaks ? JSON.parse(JSON.stringify(shiftInput.breaks)) : null,
          sleepover: shiftInput.sleepover ? JSON.parse(JSON.stringify(shiftInput.sleepover)) : null,
          expenses: shiftInput.expenses ? JSON.parse(JSON.stringify(shiftInput.expenses)) : null,
        },
      });
      redirect('/shifts');
    }

    const shift = await db.shift.create({
      data: {
        userId: user.id,
        ...priced,
        breaks: shiftInput.breaks ? JSON.parse(JSON.stringify(shiftInput.breaks)) : undefined,
        sleepover: shiftInput.sleepover ? JSON.parse(JSON.stringify(shiftInput.sleepover)) : undefined,
        expenses: shiftInput.expenses ? JSON.parse(JSON.stringify(shiftInput.expenses)) : undefined,
      },
    });

    return { savedShiftId: shift.id, totalCents: result.totalCents };
  } catch (error) {
    if (error instanceof ShiftFormError || error instanceof PricingError) return { error: error.message };
    throw error;
  }
}

/**
 * Deletes a logged shift the worker hasn't invoiced yet. Once a shift is
 * INVOICED it's part of a real financial document and can't be deleted
 * directly — the invoice itself would need deleting first (which un-invoices
 * its shifts back to SUBMITTED), keeping there always being exactly one way
 * a shift's status can change.
 */
export async function deleteShiftAction(shiftId: string) {
  const user = await requireSessionUser();
  const shift = await db.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.userId !== user.id || shift.status !== 'SUBMITTED') return;

  await db.shift.delete({ where: { id: shiftId } });
  revalidatePath('/shifts');
}
