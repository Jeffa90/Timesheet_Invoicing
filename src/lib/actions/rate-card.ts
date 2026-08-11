'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { DEFAULT_TIME_BANDS } from '@/lib/pricing/defaults';
import { getPrimaryAdminOrg, requireSessionUser } from '@/lib/session';
import { markOnboardingStepComplete } from '@/lib/actions/onboarding';

const rateLineSchema = z.object({
  serviceTypeId: z.string(),
  dayType: z.enum(['WEEKDAY', 'SATURDAY', 'SUNDAY', 'PUBLIC_HOLIDAY']),
  bandKey: z.enum(['DAY', 'EVENING', 'NIGHT']).nullable(),
  method: z.enum(['ABSOLUTE', 'PERCENT_OF_CAP']),
  amountCents: z.number().int().min(0).nullable(),
  percentOfCap: z.number().min(0).max(200).nullable(),
  capCents: z.number().int().min(0).nullable(),
});

const rateCardSchema = z.object({
  name: z.string().trim().min(1),
  classificationStrategy: z.enum(['SEGMENTED', 'SHIFT_START', 'MAJORITY']),
  roundingIncrementMin: z.coerce.number().int().min(1).max(60),
  roundingMode: z.enum(['NEAREST', 'UP', 'DOWN']),
  minimumEngagementMin: z.coerce.number().int().min(0),
  rateLines: z.array(rateLineSchema),
  sleepover: z.object({
    enabled: z.boolean(),
    spanHours: z.coerce.number().min(1).max(24),
    feeMethod: z.enum(['ABSOLUTE', 'PERCENT_OF_CAP']),
    feeCents: z.number().int().min(0).nullable(),
    feePercentOfCap: z.number().min(0).max(200).nullable(),
    feeCapCents: z.number().int().min(0).nullable(),
    includedActiveHours: z.coerce.number().min(0).max(8),
    excessActiveDayType: z.enum(['WEEKDAY', 'SATURDAY', 'SUNDAY', 'PUBLIC_HOLIDAY', 'PREVAILING']),
    gstApplicable: z.boolean(),
  }),
  travel: z.object({
    perKmCents: z.number().int().min(0),
    maxKmPerShift: z.number().int().min(0).nullable(),
    travelTimeMode: z.enum(['NONE', 'PREVAILING', 'FLAT']),
    travelTimeFlatCentsPerHr: z.number().int().min(0).nullable(),
    gstApplicable: z.boolean(),
  }),
});

export interface RateCardActionState {
  error?: string;
}

export async function saveRateCardAction(
  _prev: RateCardActionState,
  formData: FormData,
): Promise<RateCardActionState> {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('rateCard') ?? '{}'));
  } catch {
    return { error: 'Something went wrong reading the form. Try again.' };
  }

  const parsed = rateCardSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the rate card and try again.' };
  }
  const data = parsed.data;

  const existing = await db.rateCard.findFirst({ where: { orgId: org.id, status: 'ACTIVE' } });

  const rateCard = existing
    ? await db.rateCard.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          version: { increment: 1 },
          classificationStrategy: data.classificationStrategy,
          roundingIncrementMin: data.roundingIncrementMin,
          roundingMode: data.roundingMode,
          minimumEngagementMin: data.minimumEngagementMin,
        },
      })
    : await db.rateCard.create({
        data: {
          orgId: org.id,
          name: data.name,
          status: 'ACTIVE',
          effectiveFrom: new Date(),
          classificationStrategy: data.classificationStrategy,
          roundingIncrementMin: data.roundingIncrementMin,
          roundingMode: data.roundingMode,
          minimumEngagementMin: data.minimumEngagementMin,
        },
      });

  for (const band of DEFAULT_TIME_BANDS) {
    await db.timeBand.upsert({
      where: { rateCardId_key: { rateCardId: rateCard.id, key: band.key } },
      update: { startMinuteOfDay: band.startMinuteOfDay, endMinuteOfDay: band.endMinuteOfDay },
      create: {
        rateCardId: rateCard.id,
        key: band.key,
        startMinuteOfDay: band.startMinuteOfDay,
        endMinuteOfDay: band.endMinuteOfDay,
      },
    });
  }

  // The rate lines are a full replace each save — simpler and safer than diffing
  // against a small, wizard-managed set, and shifts already priced keep their own
  // frozen snapshot regardless of what happens to the rate card afterwards.
  await db.rateLine.deleteMany({ where: { rateCardId: rateCard.id } });
  if (data.rateLines.length > 0) {
    await db.rateLine.createMany({
      data: data.rateLines.map((line) => ({ rateCardId: rateCard.id, ...line })),
    });
  }

  await db.sleepoverConfig.upsert({
    where: { rateCardId: rateCard.id },
    update: data.sleepover,
    create: { rateCardId: rateCard.id, ...data.sleepover },
  });

  await db.travelConfig.upsert({
    where: { rateCardId: rateCard.id },
    update: data.travel,
    create: { rateCardId: rateCard.id, ...data.travel },
  });

  await markOnboardingStepComplete(user.id, org.id, 'rates');
  redirect('/onboarding/invite');
}
