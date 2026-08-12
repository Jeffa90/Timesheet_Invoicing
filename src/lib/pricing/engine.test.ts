import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_TIME_BAND, DEFAULT_TIME_BANDS } from './defaults';
import { priceShift } from './engine';
import type { PricingResult, PublicHolidayDef, RateCardSnapshot, ShiftInput } from './types';

const TZ = 'Australia/Sydney';
const SERVICE = 'self-care';

/**
 * Build a UTC instant from a Sydney wall-clock time. Tests are written in local
 * time because that is how a support worker experiences a shift; the conversion
 * (and therefore the DST offset) is derived rather than hand-computed.
 */
function syd(local: string): string {
  const dt = DateTime.fromISO(local, { zone: TZ });
  if (!dt.isValid) throw new Error(`Bad test time ${local}: ${dt.invalidReason}`);
  return dt.toUTC().toISO()!;
}

/** Round-number rates so expected totals are obvious by inspection. */
const RATES = {
  weekdayDay: 5000, // $50/h
  weekdayEvening: 6000, // $60/h
  weekdayNight: 7000, // $70/h
  saturday: 8000, // $80/h
  sunday: 10000, // $100/h
  publicHoliday: 12000, // $120/h
  sleepover: 20000, // $200 flat
};

function testCard(overrides: Partial<RateCardSnapshot> = {}): RateCardSnapshot {
  return {
    id: 'card-1',
    version: 1,
    bands: DEFAULT_TIME_BANDS,
    rates: [
      { serviceTypeId: SERVICE, dayType: 'WEEKDAY', bandKey: 'DAY', method: 'ABSOLUTE', amountCents: RATES.weekdayDay },
      { serviceTypeId: SERVICE, dayType: 'WEEKDAY', bandKey: 'EVENING', method: 'ABSOLUTE', amountCents: RATES.weekdayEvening },
      { serviceTypeId: SERVICE, dayType: 'WEEKDAY', bandKey: 'NIGHT', method: 'ABSOLUTE', amountCents: RATES.weekdayNight },
      { serviceTypeId: SERVICE, dayType: 'SATURDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.saturday },
      { serviceTypeId: SERVICE, dayType: 'SUNDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.sunday },
      { serviceTypeId: SERVICE, dayType: 'PUBLIC_HOLIDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.publicHoliday },
    ],
    sleepover: {
      enabled: true,
      spanHours: 8,
      feeMethod: 'ABSOLUTE',
      feeCents: RATES.sleepover,
      includedActiveHours: 2,
      excessActiveDayType: 'SATURDAY',
      gstApplicable: false,
    },
    travel: { perKmCents: 0, maxKmPerShift: null, travelTimeMode: 'NONE', gstApplicable: false },
    rounding: { minuteIncrement: 1, mode: 'NEAREST' },
    minimumEngagementMinutes: 0,
    classificationStrategy: 'SEGMENTED',
    serviceTypeGst: { [SERVICE]: false },
    ...overrides,
  };
}

function shift(startLocal: string, endLocal: string, extra: Partial<ShiftInput> = {}): ShiftInput {
  return {
    startUtc: syd(startLocal),
    endUtc: syd(endLocal),
    timezone: TZ,
    serviceTypeId: SERVICE,
    workerGstRegistered: true,
    ...extra,
  };
}

/** Compact view of the priced lines, for readable assertions. */
function summarise(result: PricingResult) {
  return result.lines.map((l) => ({
    kind: l.kind,
    hours: Number(l.quantity.toFixed(4)),
    rate: l.unitRateCents,
    amount: l.amountCents,
  }));
}

// ---------------------------------------------------------------------------

describe('band splitting', () => {
  it('prices a plain weekday day shift at one rate', () => {
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T17:00'), testCard());

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 8, rate: RATES.weekdayDay, amount: 40000 },
    ]);
    expect(result.totalCents).toBe(40000);
    expect(result.billableHours).toBe(8);
  });

  it('splits a shift crossing the 8pm evening boundary', () => {
    const result = priceShift(shift('2025-07-16T18:00', '2025-07-16T22:00'), testCard());

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 2, rate: RATES.weekdayDay, amount: 10000 },
      { kind: 'HOURLY', hours: 2, rate: RATES.weekdayEvening, amount: 12000 },
    ]);
    expect(result.totalCents).toBe(22000);
  });

  it('switches to the Saturday rate at midnight', () => {
    // Friday 10pm to Saturday 2am.
    const result = priceShift(shift('2025-07-18T22:00', '2025-07-19T02:00'), testCard());

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 2, rate: RATES.weekdayEvening, amount: 12000 },
      { kind: 'HOURLY', hours: 2, rate: RATES.saturday, amount: 16000 },
    ]);
  });

  it('applies the public holiday rate from midnight', () => {
    const holidays: PublicHolidayDef[] = [{ date: '2025-12-25', name: 'Christmas Day' }];
    const result = priceShift(shift('2025-12-24T22:00', '2025-12-25T02:00'), testCard(), holidays);

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 2, rate: RATES.weekdayEvening, amount: 12000 },
      { kind: 'HOURLY', hours: 2, rate: RATES.publicHoliday, amount: 24000 },
    ]);
  });

  it('carves an unpaid break out of the billable time', () => {
    const result = priceShift(
      shift('2025-07-16T09:00', '2025-07-16T17:00', {
        breaks: [{ startUtc: syd('2025-07-16T12:00'), endUtc: syd('2025-07-16T12:30'), paid: false }],
      }),
      testCard(),
    );

    expect(result.billableHours).toBe(7.5);
    expect(result.totalCents).toBe(37500);
    expect(result.lines).toHaveLength(2); // split either side of the break
  });

  it('leaves a paid break billable', () => {
    const result = priceShift(
      shift('2025-07-16T09:00', '2025-07-16T17:00', {
        breaks: [{ startUtc: syd('2025-07-16T12:00'), endUtc: syd('2025-07-16T12:30'), paid: true }],
      }),
      testCard(),
    );

    expect(result.billableHours).toBe(8);
    expect(result.totalCents).toBe(40000);
  });
});

describe('line descriptions', () => {
  it('does not append a trailing date to a segment that ends exactly at midnight', () => {
    // Friday 10pm to Saturday 2am — the first segment ends exactly at midnight,
    // which is the ordinary case for almost any multi-band or multi-day-type
    // shift, not just genuine overnight spans. It must read as an unremarkable
    // same-night boundary, not "to 12:00am 19 Jul".
    const result = priceShift(shift('2025-07-18T22:00', '2025-07-19T02:00'), testCard());

    expect(result.lines[0].description).toBe('Weekday evening — 10:00pm to 12:00am');
    expect(result.lines[1].description).toBe('Saturday night — 12:00am to 2:00am');
  });

  it('appends the end date to a sleepover line that genuinely spans two calendar days', () => {
    const result = priceShift(
      shift('2025-07-18T20:00', '2025-07-19T08:00', {
        sleepover: {
          windowStartUtc: syd('2025-07-18T22:00'),
          windowEndUtc: syd('2025-07-19T06:00'),
        },
      }),
      testCard(),
    );

    const sleepover = result.lines.find((l) => l.kind === 'SLEEPOVER');
    expect(sleepover?.description).toBe('Night-time sleepover — 10:00pm to 6:00am 19 Jul');
  });
});

describe('daily-rate cards', () => {
  const dailyCard = testCard({
    bands: DEFAULT_DAILY_TIME_BAND,
    rates: [
      { serviceTypeId: SERVICE, dayType: 'WEEKDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.weekdayDay },
      { serviceTypeId: SERVICE, dayType: 'SATURDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.saturday },
      { serviceTypeId: SERVICE, dayType: 'SUNDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.sunday },
      { serviceTypeId: SERVICE, dayType: 'PUBLIC_HOLIDAY', bandKey: null, method: 'ABSOLUTE', amountCents: RATES.publicHoliday },
    ],
  });

  it('bills a shift spanning evening and night at the single weekday rate, as one line', () => {
    // Would be two HOURLY lines (day + evening) on a banded card — see
    // 'splits a shift crossing the 8pm evening boundary' above.
    const result = priceShift(shift('2025-07-16T18:00', '2025-07-16T22:00'), dailyCard);

    expect(summarise(result)).toEqual([{ kind: 'HOURLY', hours: 4, rate: RATES.weekdayDay, amount: 20000 }]);
  });

  it('still splits at a day-type change, just without a band label', () => {
    const result = priceShift(shift('2025-07-18T22:00', '2025-07-19T02:00'), dailyCard);

    expect(result.lines[0].description).toBe('Weekday — 10:00pm to 12:00am');
    expect(result.lines[1].description).toBe('Saturday — 12:00am to 2:00am');
  });
});

describe('overnight sleepover', () => {
  it("prices the user's worked example: 8pm Friday to 8am Saturday", () => {
    // Hourly until 10pm, flat sleepover 10pm-6am, hourly again from 6am at the
    // Saturday rate because the shift has crossed midnight.
    const result = priceShift(
      shift('2025-07-18T20:00', '2025-07-19T08:00', {
        sleepover: {
          windowStartUtc: syd('2025-07-18T22:00'),
          windowEndUtc: syd('2025-07-19T06:00'),
        },
      }),
      testCard(),
    );

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 2, rate: RATES.weekdayEvening, amount: 12000 },
      { kind: 'HOURLY', hours: 2, rate: RATES.saturday, amount: 16000 },
      { kind: 'SLEEPOVER', hours: 1, rate: RATES.sleepover, amount: 20000 },
    ]);
    expect(result.totalCents).toBe(48000);
    expect(result.billableHours).toBe(4); // the flat span is not hourly time
    expect(result.warnings).toHaveLength(0);
  });

  it('includes active support within the allowance at no extra charge', () => {
    const result = priceShift(
      shift('2025-07-18T20:00', '2025-07-19T08:00', {
        sleepover: {
          windowStartUtc: syd('2025-07-18T22:00'),
          windowEndUtc: syd('2025-07-19T06:00'),
          activeSupport: [{ startUtc: syd('2025-07-19T01:00'), endUtc: syd('2025-07-19T02:00') }],
        },
      }),
      testCard(),
    );

    expect(result.lines.filter((l) => l.kind === 'ACTIVE_SUPPORT')).toHaveLength(0);
    expect(result.totalCents).toBe(48000);
  });

  it('bills only active support beyond the two included hours', () => {
    // 1h + 2.5h = 3.5h active. Two hours are included, so 1.5h bills separately,
    // taken from the end of the night and charged at the Saturday rate.
    const result = priceShift(
      shift('2025-07-18T20:00', '2025-07-19T08:00', {
        sleepover: {
          windowStartUtc: syd('2025-07-18T22:00'),
          windowEndUtc: syd('2025-07-19T06:00'),
          activeSupport: [
            { startUtc: syd('2025-07-18T23:00'), endUtc: syd('2025-07-19T00:00') },
            { startUtc: syd('2025-07-19T01:00'), endUtc: syd('2025-07-19T03:30') },
          ],
        },
      }),
      testCard(),
    );

    const active = result.lines.filter((l) => l.kind === 'ACTIVE_SUPPORT');
    expect(active).toHaveLength(1);
    expect(active[0].quantity).toBe(1.5);
    expect(active[0].unitRateCents).toBe(RATES.saturday);
    expect(active[0].amountCents).toBe(12000);
    expect(result.totalCents).toBe(60000);
  });

  it('warns when the sleepover window is shorter than the required span', () => {
    const result = priceShift(
      shift('2025-07-18T20:00', '2025-07-19T08:00', {
        sleepover: {
          windowStartUtc: syd('2025-07-18T23:00'),
          windowEndUtc: syd('2025-07-19T04:00'),
        },
      }),
      testCard(),
    );

    expect(result.warnings.map((w) => w.code)).toContain('SLEEPOVER_SPAN_SHORT');
  });

  it('rejects a sleepover window that escapes the shift', () => {
    expect(() =>
      priceShift(
        shift('2025-07-18T20:00', '2025-07-19T08:00', {
          sleepover: {
            windowStartUtc: syd('2025-07-18T19:00'),
            windowEndUtc: syd('2025-07-19T06:00'),
          },
        }),
        testCard(),
      ),
    ).toThrow(/inside the shift/);
  });
});

describe('daylight saving', () => {
  it('bills 11 hours across the October spring-forward night', () => {
    // NSW clocks jump 2am -> 3am on 5 Oct 2025, so 8pm-8am is 11 real hours.
    const result = priceShift(shift('2025-10-04T20:00', '2025-10-05T08:00'), testCard());

    expect(result.billableHours).toBe(11);
    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 4, rate: RATES.saturday, amount: 32000 }, // Sat 8pm-midnight
      { kind: 'HOURLY', hours: 5, rate: RATES.sunday, amount: 50000 }, // Sun midnight-6am, an hour short
      { kind: 'HOURLY', hours: 2, rate: RATES.sunday, amount: 20000 }, // Sun 6am-8am
    ]);
  });

  it('bills 13 hours across the April fall-back night', () => {
    // NSW clocks wind back 3am -> 2am on 5 Apr 2026, so 8pm-8am is 13 real hours.
    const result = priceShift(shift('2026-04-04T20:00', '2026-04-05T08:00'), testCard());

    expect(result.billableHours).toBe(13);
    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 4, rate: RATES.saturday, amount: 32000 },
      { kind: 'HOURLY', hours: 7, rate: RATES.sunday, amount: 70000 }, // the repeated hour is worked and paid
      { kind: 'HOURLY', hours: 2, rate: RATES.sunday, amount: 20000 },
    ]);
  });

  it('keeps band boundaries on the wall clock through a DST change', () => {
    // 1am-8am on the spring-forward morning. The night band must still end at 6am on
    // the clock even though only 4 real hours elapse between 1am and 6am — this is the
    // case that breaks any implementation that derives boundaries by adding elapsed
    // minutes to midnight instead of setting the wall-clock time.
    const result = priceShift(shift('2025-10-05T01:00', '2025-10-05T08:00'), testCard());
    const [night, day] = result.lines;

    expect(DateTime.fromISO(night.endLocal!, { zone: TZ }).hour).toBe(6);
    expect(DateTime.fromISO(day.startLocal!, { zone: TZ }).hour).toBe(6);
    expect(night.quantity).toBe(4); // 1am-6am, one hour skipped
    expect(day.quantity).toBe(2); // 6am-8am
    expect(result.billableHours).toBe(6);
  });
});

describe('rate resolution', () => {
  it('derives a rate as a percentage of the NDIS cap', () => {
    const card = testCard({
      rates: [
        {
          serviceTypeId: SERVICE,
          dayType: 'WEEKDAY',
          bandKey: 'DAY',
          method: 'PERCENT_OF_CAP',
          percentOfCap: 80,
          capCents: 7023,
        },
      ],
    });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T17:00'), card);

    expect(result.lines[0].unitRateCents).toBe(5618); // 80% of $70.23
    expect(result.totalCents).toBe(44944);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when a configured rate exceeds the NDIS cap', () => {
    const card = testCard({
      rates: [
        {
          serviceTypeId: SERVICE,
          dayType: 'WEEKDAY',
          bandKey: 'DAY',
          method: 'ABSOLUTE',
          amountCents: 9000,
          capCents: 7023,
        },
      ],
    });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T12:00'), card);

    expect(result.warnings.map((w) => w.code)).toContain('RATE_EXCEEDS_NDIS_CAP');
    expect(result.totalCents).toBe(27000); // still billed — the cap is a warning, not a block
  });

  it('warns and bills nothing when a rate is missing', () => {
    const card = testCard({ rates: [] });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T17:00'), card);

    expect(result.warnings.map((w) => w.code)).toContain('MISSING_RATE');
    expect(result.totalCents).toBe(0);
  });
});

describe('rules', () => {
  it('adds a visible top-up line below the minimum engagement', () => {
    const card = testCard({ minimumEngagementMinutes: 120 });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T10:00'), card);

    const topup = result.lines.find((l) => l.kind === 'MINIMUM_TOPUP');
    expect(topup?.quantity).toBe(1);
    expect(topup?.amountCents).toBe(5000);
    expect(result.totalCents).toBe(10000);
    expect(result.warnings.map((w) => w.code)).toContain('BELOW_MINIMUM_ENGAGEMENT');
  });

  it('rounds durations to the configured increment', () => {
    const card = testCard({ rounding: { minuteIncrement: 15, mode: 'NEAREST' } });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T17:10'), card);

    expect(result.billableHours).toBe(8.25); // 8h10m rounds to 8h15m
  });

  it('classifies the whole shift by its start time when configured', () => {
    const card = testCard({ classificationStrategy: 'SHIFT_START' });
    const result = priceShift(shift('2025-07-16T18:00', '2025-07-16T22:00'), card);

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 4, rate: RATES.weekdayDay, amount: 20000 },
    ]);
  });

  it('classifies the whole shift by majority of hours when configured', () => {
    const card = testCard({ classificationStrategy: 'MAJORITY' });
    // 1h daytime, 3h evening -> evening wins.
    const result = priceShift(shift('2025-07-16T19:00', '2025-07-16T23:00'), card);

    expect(summarise(result)).toEqual([
      { kind: 'HOURLY', hours: 4, rate: RATES.weekdayEvening, amount: 24000 },
    ]);
  });
});

describe('travel, expenses and GST', () => {
  it('bills travel per kilometre and caps it', () => {
    const card = testCard({
      travel: { perKmCents: 100, maxKmPerShift: 50, travelTimeMode: 'NONE', gstApplicable: false },
    });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T10:00', { travelKm: 80 }), card);

    const travel = result.lines.find((l) => l.kind === 'TRAVEL_KM');
    expect(travel?.quantity).toBe(50);
    expect(travel?.amountCents).toBe(5000);
    expect(result.warnings.map((w) => w.code)).toContain('TRAVEL_KM_CAPPED');
  });

  it('adds GST only where the service type is taxable', () => {
    const card = testCard({ serviceTypeGst: { [SERVICE]: true } });
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T17:00'), card);

    expect(result.subtotalCents).toBe(40000);
    expect(result.gstCents).toBe(4000);
    expect(result.totalCents).toBe(44000);
  });

  it('charges no GST for a worker who is not GST-registered, even on a taxable service type', () => {
    const card = testCard({ serviceTypeGst: { [SERVICE]: true } });
    const result = priceShift(
      shift('2025-07-16T09:00', '2025-07-16T17:00', { workerGstRegistered: false }),
      card,
    );

    expect(result.gstCents).toBe(0);
    expect(result.totalCents).toBe(result.subtotalCents);
  });

  it('leaves GST-free supports untaxed', () => {
    const result = priceShift(shift('2025-07-16T09:00', '2025-07-16T17:00'), testCard());

    expect(result.gstCents).toBe(0);
    expect(result.totalCents).toBe(result.subtotalCents);
  });

  it('carries expenses through with their own GST treatment', () => {
    const result = priceShift(
      shift('2025-07-16T09:00', '2025-07-16T10:00', {
        expenses: [{ description: 'Parking', amountCents: 1100, gstApplicable: true }],
      }),
      testCard(),
    );

    const expense = result.lines.find((l) => l.kind === 'EXPENSE');
    expect(expense?.amountCents).toBe(1100);
    expect(expense?.gstCents).toBe(110);
  });
});

describe('validation', () => {
  it('rejects a shift that ends before it starts', () => {
    expect(() => priceShift(shift('2025-07-16T17:00', '2025-07-16T09:00'), testCard())).toThrow(
      /must be after/,
    );
  });

  it('produces a human-readable trace for every shift', () => {
    const result = priceShift(
      shift('2025-07-18T20:00', '2025-07-19T08:00', {
        sleepover: {
          windowStartUtc: syd('2025-07-18T22:00'),
          windowEndUtc: syd('2025-07-19T06:00'),
        },
      }),
      testCard(),
    );

    expect(result.trace.join('\n')).toMatch(/sleepover flat fee \$200\.00/);
    expect(result.trace.length).toBeGreaterThan(3);
  });
});
