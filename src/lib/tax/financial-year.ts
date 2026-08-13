import { DateTime } from 'luxon';
import type { FinancialYearWindow } from './types';

/**
 * Australian financial years run 1 July – 30 June. Building each window from
 * an explicit calendar date (rather than "subtract a day from this year's
 * start and re-derive") means previousFinancialYear can't drift across leap
 * years or DST transitions.
 */
function windowFor(startYear: number, timezone: string): FinancialYearWindow {
  const start = DateTime.fromObject({ year: startYear, month: 7, day: 1 }, { zone: timezone }).startOf('day');
  const end = DateTime.fromObject({ year: startYear + 1, month: 7, day: 1 }, { zone: timezone }).startOf('day');

  return {
    startYear,
    label: `${startYear}–${String(startYear + 1).slice(-2)}`,
    startUtc: start.toUTC().toISO()!,
    endUtc: end.toUTC().toISO()!,
  };
}

/** Which Australian financial year a given instant falls in, by wall-clock in `timezone`. */
export function financialYearFor(date: DateTime, timezone: string): FinancialYearWindow {
  const local = date.setZone(timezone);
  const startYear = local.month >= 7 ? local.year : local.year - 1;
  return windowFor(startYear, timezone);
}

/** The financial year containing right now, by wall-clock in `timezone`. */
export function currentFinancialYear(timezone: string): FinancialYearWindow {
  return financialYearFor(DateTime.now(), timezone);
}

/** The financial year immediately before `window`, in the same timezone it was built with. */
export function previousFinancialYear(window: FinancialYearWindow, timezone: string): FinancialYearWindow {
  return windowFor(window.startYear - 1, timezone);
}
