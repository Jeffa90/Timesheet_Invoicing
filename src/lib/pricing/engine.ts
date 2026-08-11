import { DateTime } from 'luxon';
import { amountForMinutes, formatCents, formatHours, gstFor, percentOfCap, roundHalfUp } from './money';
import {
  type Segment,
  type ZonedInterval,
  bandFor,
  dayTypeFor,
  formatLocal,
  formatLocalTime,
  holidaySet,
  intersectIntervals,
  mergeIntervals,
  minutesBetween,
  parseUtc,
  roundMinutes,
  segmentInterval,
  subtractIntervals,
  toInterval,
} from './time';
import {
  type Cents,
  type DayType,
  type PricedLine,
  type PricingResult,
  type PricingWarning,
  type PublicHolidayDef,
  type RateCardSnapshot,
  type RateDef,
  type ShiftInput,
  PricingError,
} from './types';

/**
 * Price a single shift.
 *
 * This function is PURE: no database, no network, no clock. Everything it needs is
 * passed in, so its behaviour is entirely determined by its arguments and it can be
 * exhaustively covered by table-driven tests. Keep it that way — the moment it reads
 * ambient state, historical invoices stop being reproducible.
 */
export function priceShift(
  shift: ShiftInput,
  card: RateCardSnapshot,
  holidays: PublicHolidayDef[] = [],
): PricingResult {
  const zone = shift.timezone;
  const holidayDates = holidaySet(holidays);
  const warnings: PricingWarning[] = [];
  const trace: string[] = [];
  const lines: PricedLine[] = [];

  const shiftSpan = toInterval({ startUtc: shift.startUtc, endUtc: shift.endUtc }, zone);
  trace.push(
    `Shift ${formatLocal(shiftSpan.start)} to ${formatLocal(shiftSpan.end)} (${zone}), ` +
      `${formatHours(minutesBetween(shiftSpan.start, shiftSpan.end) / 60)} elapsed.`,
  );

  // ---------------------------------------------------------------- sleepover
  const sleepoverWindow = shift.sleepover
    ? toInterval(
        { startUtc: shift.sleepover.windowStartUtc, endUtc: shift.sleepover.windowEndUtc },
        zone,
      )
    : null;

  if (sleepoverWindow) {
    if (
      sleepoverWindow.start < shiftSpan.start ||
      sleepoverWindow.end > shiftSpan.end
    ) {
      throw new PricingError('The sleepover window must sit inside the shift.');
    }
    const spanMinutes = minutesBetween(sleepoverWindow.start, sleepoverWindow.end);
    if (spanMinutes < card.sleepover.spanHours * 60) {
      warnings.push({
        code: 'SLEEPOVER_SPAN_SHORT',
        message:
          `The sleepover window is ${formatHours(spanMinutes / 60)}, short of the ` +
          `${card.sleepover.spanHours}-hour continuous span a night-time sleepover requires. ` +
          `Check whether this should be billed hourly instead.`,
      });
    }
    if (sleepoverWindow.start.toFormat('yyyy-MM-dd') === sleepoverWindow.end.toFormat('yyyy-MM-dd')) {
      warnings.push({
        code: 'SLEEPOVER_NOT_OVERNIGHT',
        message:
          'A night-time sleepover must start before midnight and finish after it. ' +
          'This window starts and ends on the same day.',
      });
    }
  }

  // -------------------------------------------------- billable hourly span
  // Hourly billing covers the shift minus unpaid breaks minus the flat sleepover window.
  const unpaidBreaks = (shift.breaks ?? [])
    .filter((b) => !b.paid)
    .map((b) => toInterval(b, zone));
  const carveOuts: ZonedInterval[] = [...unpaidBreaks];
  if (sleepoverWindow) carveOuts.push(sleepoverWindow);

  const billableSpans = subtractIntervals([shiftSpan], mergeIntervals(carveOuts));
  if (unpaidBreaks.length > 0) {
    const breakMinutes = unpaidBreaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end), 0);
    trace.push(`Deducted ${formatHours(breakMinutes / 60)} of unpaid breaks.`);
  }

  let segments: Segment[] = billableSpans.flatMap((span) =>
    segmentInterval(span, card.bands, holidayDates),
  );
  segments = applyClassificationStrategy(segments, card, trace);

  // -------------------------------------------------------- hourly line items
  let billableMinutes = 0;
  for (const segment of segments) {
    const rounded = roundMinutes(segment.minutes, card.rounding.minuteIncrement, card.rounding.mode);
    if (rounded <= 0) continue;
    billableMinutes += rounded;

    const { rateCents, def } = resolveRate(card, shift.serviceTypeId, segment.dayType, segment.bandKey, warnings);
    const amountCents = amountForMinutes(rounded, rateCents);
    const gstApplicable = isGstApplicable(card, shift.serviceTypeId);

    lines.push({
      kind: 'HOURLY',
      description: `${describeDayType(segment.dayType)} ${describeBand(segment.bandKey)} — ${formatLocalTime(segment.start)} to ${formatLocalTime(segment.end)}`,
      startLocal: segment.start.toISO() ?? undefined,
      endLocal: segment.end.toISO() ?? undefined,
      dayType: segment.dayType,
      bandKey: segment.bandKey,
      quantity: rounded / 60,
      unit: 'HOUR',
      unitRateCents: rateCents,
      amountCents,
      gstCents: gstFor(amountCents, gstApplicable),
      gstApplicable,
      ndisLineItemCode: def?.ndisLineItemCode,
    });

    trace.push(
      `${formatLocal(segment.start)}–${formatLocalTime(segment.end)}: ` +
        `${describeDayType(segment.dayType)} ${describeBand(segment.bandKey)}, ` +
        `${formatHours(rounded / 60)} × ${formatCents(rateCents)}/h = ${formatCents(amountCents)}`,
    );
  }

  // ------------------------------------------------------------ sleepover fee
  if (sleepoverWindow && card.sleepover.enabled) {
    const feeCents = resolveSleepoverFee(card, warnings);
    const gstApplicable = card.sleepover.gstApplicable;
    lines.push({
      kind: 'SLEEPOVER',
      description: `Night-time sleepover — ${formatLocalTime(sleepoverWindow.start)} to ${formatLocalTime(sleepoverWindow.end)}`,
      startLocal: sleepoverWindow.start.toISO() ?? undefined,
      endLocal: sleepoverWindow.end.toISO() ?? undefined,
      quantity: 1,
      unit: 'NIGHT',
      unitRateCents: feeCents,
      amountCents: feeCents,
      gstCents: gstFor(feeCents, gstApplicable),
      gstApplicable,
      ndisLineItemCode: card.sleepover.ndisLineItemCode,
    });
    trace.push(
      `${formatLocal(sleepoverWindow.start)}–${formatLocalTime(sleepoverWindow.end)}: ` +
        `sleepover flat fee ${formatCents(feeCents)}`,
    );

    // Active support beyond the included allowance bills on top of the flat fee.
    const activeLines = priceActiveSupport(shift, card, sleepoverWindow, holidayDates, warnings, trace);
    lines.push(...activeLines);
  }

  // --------------------------------------------------- minimum engagement
  if (billableMinutes > 0 && billableMinutes < card.minimumEngagementMinutes) {
    const shortfall = card.minimumEngagementMinutes - billableMinutes;
    const first = segments[0];
    const { rateCents } = resolveRate(card, shift.serviceTypeId, first.dayType, first.bandKey, warnings);
    const amountCents = amountForMinutes(shortfall, rateCents);
    const gstApplicable = isGstApplicable(card, shift.serviceTypeId);
    lines.push({
      kind: 'MINIMUM_TOPUP',
      description: `Minimum engagement top-up to ${formatHours(card.minimumEngagementMinutes / 60)}`,
      quantity: shortfall / 60,
      unit: 'HOUR',
      unitRateCents: rateCents,
      amountCents,
      gstCents: gstFor(amountCents, gstApplicable),
      gstApplicable,
    });
    warnings.push({
      code: 'BELOW_MINIMUM_ENGAGEMENT',
      message:
        `Worked time was ${formatHours(billableMinutes / 60)}, below the ` +
        `${formatHours(card.minimumEngagementMinutes / 60)} minimum. A top-up line was added.`,
    });
    billableMinutes = card.minimumEngagementMinutes;
  }

  // ------------------------------------------------------------------ travel
  lines.push(...priceTravel(shift, card, segments, warnings, trace));

  // ---------------------------------------------------------------- expenses
  for (const expense of shift.expenses ?? []) {
    lines.push({
      kind: 'EXPENSE',
      description: expense.description,
      quantity: 1,
      unit: 'EACH',
      unitRateCents: expense.amountCents,
      amountCents: expense.amountCents,
      gstCents: gstFor(expense.amountCents, expense.gstApplicable),
      gstApplicable: expense.gstApplicable,
    });
  }

  // ------------------------------------------------------------------ totals
  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const gstCents = lines.reduce((sum, l) => sum + l.gstCents, 0);

  return {
    lines,
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents,
    billableHours: billableMinutes / 60,
    warnings,
    trace,
    rateCardId: card.id,
    rateCardVersion: card.version,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyClassificationStrategy(
  segments: Segment[],
  card: RateCardSnapshot,
  trace: string[],
): Segment[] {
  if (card.classificationStrategy === 'SEGMENTED' || segments.length <= 1) return segments;

  const totalMinutes = segments.reduce((sum, s) => sum + s.minutes, 0);
  const start = segments[0].start;
  const end = segments[segments.length - 1].end;

  let chosen: Pick<Segment, 'dayType' | 'bandKey'>;
  if (card.classificationStrategy === 'SHIFT_START') {
    chosen = { dayType: segments[0].dayType, bandKey: segments[0].bandKey };
    trace.push(`Whole shift classified by its start time (${describeDayType(chosen.dayType)} ${describeBand(chosen.bandKey)}).`);
  } else {
    const tally = new Map<string, { minutes: number; seg: Segment }>();
    for (const seg of segments) {
      const key = `${seg.dayType}|${seg.bandKey}`;
      const entry = tally.get(key);
      if (entry) entry.minutes += seg.minutes;
      else tally.set(key, { minutes: seg.minutes, seg });
    }
    const winner = [...tally.values()].sort((a, b) => b.minutes - a.minutes)[0];
    chosen = { dayType: winner.seg.dayType, bandKey: winner.seg.bandKey };
    trace.push(`Whole shift classified by majority of hours (${describeDayType(chosen.dayType)} ${describeBand(chosen.bandKey)}).`);
  }

  return [{ start, end, minutes: totalMinutes, ...chosen }];
}

function resolveRate(
  card: RateCardSnapshot,
  serviceTypeId: string,
  dayType: DayType,
  bandKey: string | null,
  warnings: PricingWarning[],
): { rateCents: Cents; def?: RateDef } {
  const exact = card.rates.find(
    (r) => r.serviceTypeId === serviceTypeId && r.dayType === dayType && r.bandKey === bandKey,
  );
  // Saturday, Sunday and public holiday rates are usually defined once for the whole day.
  const allDay = card.rates.find(
    (r) => r.serviceTypeId === serviceTypeId && r.dayType === dayType && r.bandKey === null,
  );
  const def = exact ?? allDay;

  if (!def) {
    warnings.push({
      code: 'MISSING_RATE',
      message: `No rate is configured for ${describeDayType(dayType)} ${describeBand(bandKey)}. That time was billed at $0.00.`,
    });
    return { rateCents: 0 };
  }

  const rateCents =
    def.method === 'PERCENT_OF_CAP'
      ? percentOfCap(def.capCents ?? 0, def.percentOfCap ?? 0)
      : def.amountCents ?? 0;

  if (def.capCents != null && rateCents > def.capCents) {
    warnings.push({
      code: 'RATE_EXCEEDS_NDIS_CAP',
      message:
        `The ${describeDayType(dayType)} ${describeBand(bandKey)} rate of ${formatCents(rateCents)}/h ` +
        `exceeds the NDIS price limit of ${formatCents(def.capCents)}/h.`,
    });
  }

  return { rateCents, def };
}

function resolveSleepoverFee(card: RateCardSnapshot, warnings: PricingWarning[]): Cents {
  const { sleepover } = card;
  const fee =
    sleepover.feeMethod === 'PERCENT_OF_CAP'
      ? percentOfCap(sleepover.feeCapCents ?? 0, sleepover.feePercentOfCap ?? 0)
      : sleepover.feeCents ?? 0;

  if (sleepover.feeCapCents != null && fee > sleepover.feeCapCents) {
    warnings.push({
      code: 'RATE_EXCEEDS_NDIS_CAP',
      message: `The sleepover fee of ${formatCents(fee)} exceeds the NDIS price limit of ${formatCents(sleepover.feeCapCents)}.`,
    });
  }
  return fee;
}

/**
 * Active support during a sleepover.
 *
 * The flat fee already covers up to `includedActiveHours` of being woken. Only the
 * excess bills separately, and the allowance is consumed chronologically — the first
 * two hours of the night are the free ones, so the excess is taken from the end.
 */
function priceActiveSupport(
  shift: ShiftInput,
  card: RateCardSnapshot,
  sleepoverWindow: ZonedInterval,
  holidayDates: Set<string>,
  warnings: PricingWarning[],
  trace: string[],
): PricedLine[] {
  const raw = shift.sleepover?.activeSupport ?? [];
  if (raw.length === 0) return [];

  const zone = shift.timezone;
  const clipped = intersectIntervals(
    mergeIntervals(raw.map((i) => toInterval(i, zone))),
    [sleepoverWindow],
  );
  const totalMinutes = clipped.reduce((sum, i) => sum + minutesBetween(i.start, i.end), 0);
  const includedMinutes = Math.round(card.sleepover.includedActiveHours * 60);

  if (totalMinutes <= includedMinutes) {
    trace.push(
      `Active support ${formatHours(totalMinutes / 60)} is within the ` +
        `${formatHours(includedMinutes / 60)} included in the sleepover fee — no extra charge.`,
    );
    return [];
  }

  const excessMinutes = totalMinutes - includedMinutes;
  const excessIntervals = takeTrailingMinutes(clipped, excessMinutes);
  trace.push(
    `Active support totalled ${formatHours(totalMinutes / 60)}; ` +
      `${formatHours(includedMinutes / 60)} is included, so ${formatHours(excessMinutes / 60)} bills separately.`,
  );

  const lines: PricedLine[] = [];
  for (const interval of excessIntervals) {
    for (const segment of segmentInterval(interval, card.bands, holidayDates)) {
      const rounded = roundMinutes(segment.minutes, card.rounding.minuteIncrement, card.rounding.mode);
      if (rounded <= 0) continue;

      // The guide allows claiming excess active support at a nominated day type
      // (commonly Saturday rates on a weekday) rather than the prevailing night rate.
      const effectiveDayType =
        card.sleepover.excessActiveDayType === 'PREVAILING'
          ? segment.dayType
          : card.sleepover.excessActiveDayType;

      const { rateCents, def } = resolveRate(card, shift.serviceTypeId, effectiveDayType, segment.bandKey, warnings);
      const amountCents = amountForMinutes(rounded, rateCents);
      const gstApplicable = isGstApplicable(card, shift.serviceTypeId);

      lines.push({
        kind: 'ACTIVE_SUPPORT',
        description: `Active support during sleepover — ${formatLocalTime(segment.start)} to ${formatLocalTime(segment.end)}`,
        startLocal: segment.start.toISO() ?? undefined,
        endLocal: segment.end.toISO() ?? undefined,
        dayType: effectiveDayType,
        bandKey: segment.bandKey,
        quantity: rounded / 60,
        unit: 'HOUR',
        unitRateCents: rateCents,
        amountCents,
        gstCents: gstFor(amountCents, gstApplicable),
        gstApplicable,
        ndisLineItemCode: def?.ndisLineItemCode,
      });

      trace.push(
        `${formatLocalTime(segment.start)}–${formatLocalTime(segment.end)}: active support, ` +
          `${formatHours(rounded / 60)} × ${formatCents(rateCents)}/h = ${formatCents(amountCents)}`,
      );
    }
  }
  return lines;
}

/** Take the last `minutes` of an interval set, walking backwards through it. */
function takeTrailingMinutes(intervals: ZonedInterval[], minutes: number): ZonedInterval[] {
  const out: ZonedInterval[] = [];
  let remaining = minutes;
  for (let i = intervals.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const interval = intervals[i];
    const available = minutesBetween(interval.start, interval.end);
    if (available <= remaining) {
      out.unshift(interval);
      remaining -= available;
    } else {
      out.unshift({ start: interval.end.minus({ minutes: remaining }), end: interval.end });
      remaining = 0;
    }
  }
  return out;
}

function priceTravel(
  shift: ShiftInput,
  card: RateCardSnapshot,
  segments: Segment[],
  warnings: PricingWarning[],
  trace: string[],
): PricedLine[] {
  const lines: PricedLine[] = [];
  const { travel } = card;

  if (shift.travelKm && shift.travelKm > 0 && travel.perKmCents > 0) {
    let km = shift.travelKm;
    if (travel.maxKmPerShift != null && km > travel.maxKmPerShift) {
      warnings.push({
        code: 'TRAVEL_KM_CAPPED',
        message: `Travel of ${km}km was capped at the configured ${travel.maxKmPerShift}km per shift.`,
      });
      km = travel.maxKmPerShift;
    }
    const amountCents = roundHalfUp(km * travel.perKmCents);
    lines.push({
      kind: 'TRAVEL_KM',
      description: `Travel — ${km}km`,
      quantity: km,
      unit: 'KM',
      unitRateCents: travel.perKmCents,
      amountCents,
      gstCents: gstFor(amountCents, travel.gstApplicable),
      gstApplicable: travel.gstApplicable,
    });
    trace.push(`Travel ${km}km × ${formatCents(travel.perKmCents)}/km = ${formatCents(amountCents)}`);
  }

  if (shift.travelMinutes && shift.travelMinutes > 0 && travel.travelTimeMode !== 'NONE') {
    const rateCents =
      travel.travelTimeMode === 'FLAT'
        ? travel.travelTimeFlatCentsPerHour ?? 0
        : // PREVAILING: charge travel time at the rate of the first worked segment.
          resolveRate(
            card,
            shift.serviceTypeId,
            segments[0]?.dayType ?? 'WEEKDAY',
            segments[0]?.bandKey ?? 'DAY',
            warnings,
          ).rateCents;

    const amountCents = amountForMinutes(shift.travelMinutes, rateCents);
    lines.push({
      kind: 'TRAVEL_TIME',
      description: `Travel time — ${formatHours(shift.travelMinutes / 60)}`,
      quantity: shift.travelMinutes / 60,
      unit: 'HOUR',
      unitRateCents: rateCents,
      amountCents,
      gstCents: gstFor(amountCents, travel.gstApplicable),
      gstApplicable: travel.gstApplicable,
    });
    trace.push(
      `Travel time ${formatHours(shift.travelMinutes / 60)} × ${formatCents(rateCents)}/h = ${formatCents(amountCents)}`,
    );
  }

  return lines;
}

function isGstApplicable(card: RateCardSnapshot, serviceTypeId: string): boolean {
  return card.serviceTypeGst[serviceTypeId] ?? false;
}

function describeDayType(dayType: DayType): string {
  switch (dayType) {
    case 'SATURDAY':
      return 'Saturday';
    case 'SUNDAY':
      return 'Sunday';
    case 'PUBLIC_HOLIDAY':
      return 'Public holiday';
    default:
      return 'Weekday';
  }
}

function describeBand(bandKey: string | null): string {
  switch (bandKey) {
    case 'DAY':
      return 'daytime';
    case 'EVENING':
      return 'evening';
    case 'NIGHT':
      return 'night';
    default:
      return '';
  }
}

export { describeBand, describeDayType };
