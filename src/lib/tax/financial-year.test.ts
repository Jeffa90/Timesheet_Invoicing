import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { currentFinancialYear, financialYearFor, previousFinancialYear } from './financial-year';

describe('financialYearFor', () => {
  it('puts 30 June in the financial year that is about to end', () => {
    const date = DateTime.fromISO('2026-06-30T12:00:00', { zone: 'Australia/Sydney' });
    expect(financialYearFor(date, 'Australia/Sydney').startYear).toBe(2025);
  });

  it('puts 1 July in the financial year that has just started', () => {
    const date = DateTime.fromISO('2026-07-01T00:00:00', { zone: 'Australia/Sydney' });
    expect(financialYearFor(date, 'Australia/Sydney').startYear).toBe(2026);
  });

  it('uses wall-clock in the given zone, not the UTC calendar date', () => {
    // 30 June 14:30 UTC is still "30 June" in UTC, but Sydney (UTC+10 in July,
    // outside NSW's DST window) has already ticked over to 1 July 00:30.
    const instant = DateTime.fromISO('2026-06-30T14:30:00Z');
    expect(instant.toUTC().toISODate()).toBe('2026-06-30');
    expect(financialYearFor(instant, 'Australia/Sydney').startYear).toBe(2026);
  });

  it('is not hardcoded to Sydney — Perth (UTC+8, no DST) gets its own correct boundary', () => {
    const justBefore = DateTime.fromISO('2026-06-30T23:59:00', { zone: 'Australia/Perth' });
    const justAfter = DateTime.fromISO('2026-07-01T00:01:00', { zone: 'Australia/Perth' });
    expect(financialYearFor(justBefore, 'Australia/Perth').startYear).toBe(2025);
    expect(financialYearFor(justAfter, 'Australia/Perth').startYear).toBe(2026);
  });
});

describe('currentFinancialYear', () => {
  it('matches financialYearFor(DateTime.now(), timezone)', () => {
    const viaHelper = currentFinancialYear('Australia/Sydney');
    const viaDirect = financialYearFor(DateTime.now(), 'Australia/Sydney');
    expect(viaHelper).toEqual(viaDirect);
  });
});

describe('previousFinancialYear', () => {
  it('is contiguous with the window it was derived from', () => {
    const current = financialYearFor(DateTime.fromISO('2026-08-11', { zone: 'Australia/Sydney' }), 'Australia/Sydney');
    const previous = previousFinancialYear(current, 'Australia/Sydney');

    expect(previous.startYear).toBe(current.startYear - 1);
    expect(previous.endUtc).toBe(current.startUtc);
    expect(previous.label).toBe('2025–26');
    expect(current.label).toBe('2026–27');
  });
});
