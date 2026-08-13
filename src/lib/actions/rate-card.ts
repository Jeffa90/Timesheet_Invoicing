'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { DEFAULT_DAILY_TIME_BAND, DEFAULT_TIME_BANDS } from '@/lib/pricing/defaults';
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
  dailyRatesOnly: z.boolean(),
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

const modeSchema = z.enum(['onboarding', 'create', 'edit']);

/**
 * Handles three distinct callers with one action, all sharing the same
 * band/rate-line/sleepover/travel write logic below:
 *  - 'onboarding' (default, no rateCardId): the setup wizard's original
 *    behaviour — find-or-create the org's one rate card, then continue to
 *    the invite step. Untouched so existing onboarding flows keep working.
 *  - 'create': a business adding another named rate card (e.g. a "Level 2"
 *    class of worker) alongside ones it already has — always inserts a new
 *    row, never touches an existing one.
 *  - 'edit': a business editing one specific existing rate card by id.
 */
export async function saveRateCardAction(
  _prev: RateCardActionState,
  formData: FormData,
): Promise<RateCardActionState> {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const mode = modeSchema.catch('onboarding').parse(formData.get('mode'));
  const rateCardId = mode === 'edit' ? String(formData.get('rateCardId') ?? '') : undefined;

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

  const existing =
    mode === 'edit'
      ? await db.rateCard.findFirst({ where: { id: rateCardId, orgId: org.id } })
      : mode === 'onboarding'
        ? await db.rateCard.findFirst({ where: { orgId: org.id, status: 'ACTIVE' } })
        : null; // 'create' always inserts a new row, regardless of what already exists

  if (mode === 'edit' && !existing) {
    return { error: 'That rate card could not be found.' };
  }

  const rateCard = existing
    ? await db.rateCard.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          dailyRatesOnly: data.dailyRatesOnly,
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
          dailyRatesOnly: data.dailyRatesOnly,
          status: 'ACTIVE',
          effectiveFrom: new Date(),
          classificationStrategy: data.classificationStrategy,
          roundingIncrementMin: data.roundingIncrementMin,
          roundingMode: data.roundingMode,
          minimumEngagementMin: data.minimumEngagementMin,
        },
      });

  // Full replace, same reasoning as the rate lines below: switching between
  // banded and daily mode changes which bands should exist at all (not just
  // their values), and upsert-by-key never removes a band that's no longer
  // wanted — a stale EVENING/NIGHT band left behind after switching to daily
  // mode wouldn't break rate resolution, but would needlessly re-fragment
  // every shift into 3 identically-priced line items at the old 6am/8pm
  // boundaries, since segmentInterval unions in every band's boundaries.
  await db.timeBand.deleteMany({ where: { rateCardId: rateCard.id } });
  const bands = data.dailyRatesOnly ? DEFAULT_DAILY_TIME_BAND : DEFAULT_TIME_BANDS;
  await db.timeBand.createMany({
    data: bands.map((band) => ({
      rateCardId: rateCard.id,
      key: band.key,
      startMinuteOfDay: band.startMinuteOfDay,
      endMinuteOfDay: band.endMinuteOfDay,
    })),
  });

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

  if (mode === 'onboarding') {
    await markOnboardingStepComplete(user.id, org.id, 'rates');
    redirect('/onboarding/invite');
  }
  redirect('/business/rate-cards');
}
