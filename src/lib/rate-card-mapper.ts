import type { Prisma } from '@prisma/client';
import type { RateCardSnapshot } from './pricing/types';

type DbRateCard = Prisma.RateCardGetPayload<{
  include: { bands: true; rates: true; sleepover: true; travel: true };
}>;

/**
 * Converts the normalised database shape into the flat snapshot the pure pricing
 * engine expects. A shift always prices against a snapshot taken at save time
 * (see actions/shifts.ts), never a live reference to the RateCard row — that's what
 * makes the "editing a rate card can't rewrite history" guarantee hold.
 */
export function toRateCardSnapshot(card: DbRateCard, serviceTypeGst: Record<string, boolean>): RateCardSnapshot {
  return {
    id: card.id,
    version: card.version,
    bands: card.bands.map((b) => ({ key: b.key, startMinuteOfDay: b.startMinuteOfDay, endMinuteOfDay: b.endMinuteOfDay })),
    rates: card.rates.map((r) => ({
      serviceTypeId: r.serviceTypeId,
      dayType: r.dayType,
      bandKey: r.bandKey,
      method: r.method,
      amountCents: r.amountCents ?? undefined,
      percentOfCap: r.percentOfCap ?? undefined,
      capCents: r.capCents ?? undefined,
    })),
    sleepover: card.sleepover
      ? {
          enabled: card.sleepover.enabled,
          spanHours: card.sleepover.spanHours,
          feeMethod: card.sleepover.feeMethod,
          feeCents: card.sleepover.feeCents ?? undefined,
          feePercentOfCap: card.sleepover.feePercentOfCap ?? undefined,
          feeCapCents: card.sleepover.feeCapCents ?? undefined,
          includedActiveHours: card.sleepover.includedActiveHours,
          excessActiveDayType: card.sleepover.excessActiveDayType as RateCardSnapshot['sleepover']['excessActiveDayType'],
          gstApplicable: card.sleepover.gstApplicable,
          ndisLineItemCode: card.sleepover.ndisLineItemCode ?? undefined,
        }
      : {
          enabled: false,
          spanHours: 8,
          feeMethod: 'ABSOLUTE',
          includedActiveHours: 2,
          excessActiveDayType: 'SATURDAY',
          gstApplicable: false,
        },
    travel: card.travel
      ? {
          perKmCents: card.travel.perKmCents,
          maxKmPerShift: card.travel.maxKmPerShift,
          travelTimeMode: card.travel.travelTimeMode as RateCardSnapshot['travel']['travelTimeMode'],
          travelTimeFlatCentsPerHour: card.travel.travelTimeFlatCentsPerHr ?? undefined,
          gstApplicable: card.travel.gstApplicable,
        }
      : { perKmCents: 0, maxKmPerShift: null, travelTimeMode: 'NONE', gstApplicable: false },
    rounding: { minuteIncrement: card.roundingIncrementMin, mode: card.roundingMode },
    minimumEngagementMinutes: card.minimumEngagementMin,
    classificationStrategy: card.classificationStrategy,
    serviceTypeGst,
  };
}
