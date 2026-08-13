import { DateTime } from 'luxon';
import type { BandKey, DayType, PublicHolidayDef, TimeBandDef, UtcInterval } from './types';
import { PricingError } from './types';

/**
 * Interval algebra and shift segmentation.
 *
 * Everything here works on Luxon DateTimes carrying a real instant plus a zone.
 * Two rules keep daylight saving honest:
 *
 *   1. Band boundaries are WALL-CLOCK. 6am is 6am whether or not the clocks moved,
 *      so boundaries are derived with `.set({ hour, minute })`, never by adding
 *      elapsed minutes to midnight.
 *   2. Durations are ELAPSED. The gap between two instants is the real time worked,
 *      so an overnight shift across the April changeover genuinely bills 25 hours
 *      and one across October bills 23.
 */

export interface ZonedInterval {
  start: DateTime;
  end: DateTime;
}

export interface Segment extends ZonedInterval {
  dayType: DayType;
  bandKey: BandKey;
  minutes: number;
}

export function parseUtc(iso: string, zone: string): DateTime {
  const dt = DateTime.fromISO(iso, { zone, setZone: false }).setZone(zone);
  if (!dt.isValid) {
    throw new PricingError(`Invalid datetime "${iso}" for zone "${zone}": ${dt.invalidReason}`);
  }
  return dt;
}

export function toInterval(raw: UtcInterval, zone: string): ZonedInterval {
  const start = parseUtc(raw.startUtc, zone);
  const end = parseUtc(raw.endUtc, zone);
  if (end <= start) {
    throw new PricingError(`Interval end (${raw.endUtc}) must be after start (${raw.startUtc}).`);
  }
  return { start, end };
}

/** Elapsed whole minutes between two instants. DST-correct by construction. */
export function minutesBetween(start: DateTime, end: DateTime): number {
  return Math.round(end.diff(start, 'minutes').minutes);
}

/** Rebuild an instant from epoch millis, keeping `reference`'s zone. */
function atMillis(reference: DateTime, millis: number): DateTime {
  return reference.plus({ milliseconds: millis - reference.toMillis() });
}

/**
 * The instant at a given wall-clock minute-of-day on the local day containing `dayStart`.
 * 1440 resolves to the following local midnight.
 */
export function atWallClock(dayStart: DateTime, minuteOfDay: number): DateTime {
  if (minuteOfDay >= 1440) {
    return dayStart.startOf('day').plus({ days: 1 }).startOf('day');
  }
  return dayStart.startOf('day').set({
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    second: 0,
    millisecond: 0,
  });
}

export function dayTypeFor(dt: DateTime, holidays: Set<string>): DayType {
  if (holidays.has(dt.toFormat('yyyy-MM-dd'))) return 'PUBLIC_HOLIDAY';
  // Luxon weekday: 1 = Monday ... 6 = Saturday, 7 = Sunday
  if (dt.weekday === 6) return 'SATURDAY';
  if (dt.weekday === 7) return 'SUNDAY';
  return 'WEEKDAY';
}

export function bandFor(dt: DateTime, bands: TimeBandDef[]): BandKey {
  const minuteOfDay = dt.hour * 60 + dt.minute;
  for (const band of bands) {
    if (minuteOfDay >= band.startMinuteOfDay && minuteOfDay < band.endMinuteOfDay) {
      return band.key;
    }
  }
  throw new PricingError(
    `No time band covers ${dt.toFormat('HH:mm')}. Bands must tile the full 24 hours.`,
  );
}

export function holidaySet(holidays: PublicHolidayDef[]): Set<string> {
  return new Set(holidays.map((h) => h.date));
}

/**
 * Remove `cuts` from `base`, returning what remains. Used to carve unpaid breaks
 * and the flat-rate sleepover window out of the billable hourly span.
 */
export function subtractIntervals(base: ZonedInterval[], cuts: ZonedInterval[]): ZonedInterval[] {
  let remaining = [...base];
  for (const cut of cuts) {
    const next: ZonedInterval[] = [];
    for (const piece of remaining) {
      const overlapStart = Math.max(piece.start.toMillis(), cut.start.toMillis());
      const overlapEnd = Math.min(piece.end.toMillis(), cut.end.toMillis());
      if (overlapStart >= overlapEnd) {
        next.push(piece); // no overlap, keep whole
        continue;
      }
      if (piece.start.toMillis() < overlapStart) {
        next.push({ start: piece.start, end: atMillis(piece.start, overlapStart) });
      }
      if (overlapEnd < piece.end.toMillis()) {
        next.push({ start: atMillis(piece.end, overlapEnd), end: piece.end });
      }
    }
    remaining = next;
  }
  return remaining.filter((p) => p.end > p.start).sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

/** Intersection of two interval sets. Used to keep active support inside the sleepover window. */
export function intersectIntervals(a: ZonedInterval[], b: ZonedInterval[]): ZonedInterval[] {
  const out: ZonedInterval[] = [];
  for (const x of a) {
    for (const y of b) {
      const startMs = Math.max(x.start.toMillis(), y.start.toMillis());
      const endMs = Math.min(x.end.toMillis(), y.end.toMillis());
      if (startMs < endMs) {
        out.push({ start: atMillis(x.start, startMs), end: atMillis(x.end, endMs) });
      }
    }
  }
  return out.sort((p, q) => p.start.toMillis() - q.start.toMillis());
}

/** Merge overlapping or touching intervals so time is never double-counted. */
export function mergeIntervals(intervals: ZonedInterval[]): ZonedInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const out: ZonedInterval[] = [sorted[0]];
  for (const current of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (current.start.toMillis() <= last.end.toMillis()) {
      if (current.end.toMillis() > last.end.toMillis()) {
        out[out.length - 1] = { start: last.start, end: current.end };
      }
    } else {
      out.push(current);
    }
  }
  return out;
}

/**
 * Split an interval wherever its day type or time band changes: at every local
 * midnight, every band boundary, and therefore at every public-holiday transition.
 * Returns atomic segments over which the applicable rate is constant.
 */
export function segmentInterval(
  interval: ZonedInterval,
  bands: TimeBandDef[],
  holidays: Set<string>,
): Segment[] {
  const { start, end } = interval;
  const cutMillis = new Set<number>([start.toMillis(), end.toMillis()]);

  const boundaryMinutes = new Set<number>([0, 1440]);
  for (const band of bands) {
    boundaryMinutes.add(band.startMinuteOfDay);
    boundaryMinutes.add(band.endMinuteOfDay);
  }

  let day = start.startOf('day');
  const lastDay = end.startOf('day');
  // Guard against a pathological loop if a zone ever misbehaves; no real shift spans a year.
  for (let guard = 0; day <= lastDay && guard < 400; guard += 1) {
    for (const minute of boundaryMinutes) {
      const candidate = atWallClock(day, minute);
      if (candidate > start && candidate < end) cutMillis.add(candidate.toMillis());
    }
    day = day.plus({ days: 1 }).startOf('day');
  }

  const ordered = [...cutMillis].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const segStart = atMillis(start, ordered[i]);
    const segEnd = atMillis(start, ordered[i + 1]);
    const minutes = minutesBetween(segStart, segEnd);
    if (minutes <= 0) continue;
    segments.push({
      start: segStart,
      end: segEnd,
      minutes,
      dayType: dayTypeFor(segStart, holidays),
      bandKey: bandFor(segStart, bands),
    });
  }
  return segments;
}

/** Round a duration per the rate card's rounding rule. */
export function roundMinutes(
  minutes: number,
  increment: number,
  mode: 'NEAREST' | 'UP' | 'DOWN',
): number {
  if (increment <= 1) return Math.round(minutes);
  const quotient = minutes / increment;
  const rounded =
    mode === 'UP' ? Math.ceil(quotient) : mode === 'DOWN' ? Math.floor(quotient) : Math.round(quotient);
  return rounded * increment;
}

export function formatLocal(dt: DateTime): string {
  return dt.toFormat('ccc d LLL, h:mma').replace('AM', 'am').replace('PM', 'pm');
}

export function formatLocalTime(dt: DateTime): string {
  return dt.toFormat('h:mma').replace('AM', 'am').replace('PM', 'pm');
}

/**
 * "10:00pm to 7:30am" — with the end date appended when the range genuinely
 * spans two calendar days, so an overnight line isn't ambiguous about which
 * morning it ends on.
 *
 * A segment ending exactly at local midnight is treated as belonging to the
 * day that's ending, not the one starting: segmentInterval cuts at every
 * local midnight unconditionally, so most ordinary multi-band or
 * multi-day-type shifts produce a segment ending at 00:00 — without this
 * adjustment, those would get a spurious trailing date appended.
 */
export function formatRange(start: DateTime, end: DateTime): string {
  const startStr = formatLocalTime(start);
  const isMidnight = end.hour === 0 && end.minute === 0 && end.second === 0;
  const endDate = isMidnight ? end.minus({ minutes: 1 }).toISODate() : end.toISODate();
  const endStr = start.toISODate() === endDate ? formatLocalTime(end) : `${formatLocalTime(end)} ${end.toFormat('d LLL')}`;
  return `${startStr} to ${endStr}`;
}
