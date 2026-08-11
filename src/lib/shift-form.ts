import { DateTime } from 'luxon';
import type { ShiftExpense, ShiftInput, UtcInterval } from './pricing/types';

/**
 * Turns what a worker types on their phone into the engine's input.
 *
 * The only real subtlety is that an overnight shift is entered as one date plus two
 * clock times. Any time at or before the shift start belongs to the following day,
 * so "8:00pm to 8:00am" spans midnight rather than running backwards.
 */

export interface TimeRangeValue {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface ShiftFormValues {
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string;
  hasUnpaidBreak: boolean;
  breakStart: string;
  breakMinutes: number;
  isOvernight: boolean;
  sleepoverStart: string;
  sleepoverEnd: string;
  activeSupport: TimeRangeValue[];
  travelKm: number;
  expenses: ShiftExpense[];
}

export const EMPTY_FORM: ShiftFormValues = {
  date: '',
  startTime: '20:00',
  endTime: '08:00',
  hasUnpaidBreak: false,
  breakStart: '12:00',
  breakMinutes: 30,
  isOvernight: true,
  sleepoverStart: '22:00',
  sleepoverEnd: '06:00',
  activeSupport: [],
  travelKm: 0,
  expenses: [],
};

/** Resolve `HH:mm` on the shift's date, rolling to the next day if it falls before `notBefore`. */
function resolve(date: string, time: string, zone: string, notBefore?: DateTime): DateTime {
  let dt = DateTime.fromISO(`${date}T${time}`, { zone });
  if (notBefore && dt < notBefore) dt = dt.plus({ days: 1 });
  return dt;
}

export class ShiftFormError extends Error {}

export function buildShiftInput(
  values: ShiftFormValues,
  timezone: string,
  serviceTypeId: string,
  workerGstRegistered: boolean,
): ShiftInput {
  if (!values.date) throw new ShiftFormError('Choose the date the shift started.');

  const start = resolve(values.date, values.startTime, timezone);
  if (!start.isValid) throw new ShiftFormError('That start time is not valid.');

  // An end at or before the start means the shift ran past midnight.
  let end = DateTime.fromISO(`${values.date}T${values.endTime}`, { zone: timezone });
  if (!end.isValid) throw new ShiftFormError('That finish time is not valid.');
  if (end <= start) end = end.plus({ days: 1 });

  const shift: ShiftInput = {
    startUtc: start.toUTC().toISO()!,
    endUtc: end.toUTC().toISO()!,
    timezone,
    serviceTypeId,
    workerGstRegistered,
  };

  if (values.hasUnpaidBreak && values.breakMinutes > 0) {
    const breakStart = resolve(values.date, values.breakStart, timezone, start);
    const breakEnd = breakStart.plus({ minutes: values.breakMinutes });
    if (breakStart < start || breakEnd > end) {
      throw new ShiftFormError('The unpaid break has to fall inside the shift.');
    }
    shift.breaks = [
      { startUtc: breakStart.toUTC().toISO()!, endUtc: breakEnd.toUTC().toISO()!, paid: false },
    ];
  }

  if (values.isOvernight) {
    const windowStart = resolve(values.date, values.sleepoverStart, timezone, start);
    const windowEnd = resolve(values.date, values.sleepoverEnd, timezone, windowStart);

    if (windowStart < start || windowEnd > end) {
      throw new ShiftFormError(
        'The sleepover window has to sit inside the shift. Check the start and finish times.',
      );
    }

    const activeSupport: UtcInterval[] = [];
    for (const period of values.activeSupport) {
      if (!period.start || !period.end) continue;
      const asStart = resolve(values.date, period.start, timezone, windowStart);
      const asEnd = resolve(values.date, period.end, timezone, asStart);
      if (asStart < windowStart || asEnd > windowEnd) {
        throw new ShiftFormError(
          'Active support has to fall within the sleepover window to be billed on top of the flat fee.',
        );
      }
      activeSupport.push({ startUtc: asStart.toUTC().toISO()!, endUtc: asEnd.toUTC().toISO()! });
    }

    shift.sleepover = {
      windowStartUtc: windowStart.toUTC().toISO()!,
      windowEndUtc: windowEnd.toUTC().toISO()!,
      activeSupport,
    };
  }

  if (values.travelKm > 0) shift.travelKm = values.travelKm;

  const expenses = values.expenses.filter((e) => e.description.trim() && e.amountCents > 0);
  if (expenses.length > 0) shift.expenses = expenses;

  return shift;
}

/** Today in the org's timezone, for defaulting the date field. */
export function todayIn(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
}
