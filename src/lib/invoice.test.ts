import { describe, expect, it } from 'vitest';
import { buildInvoice, nextInvoiceNumber } from './invoice';
import { priceShift } from './pricing/engine';
import type { PricingResult, RateCardSnapshot, ShiftInput } from './pricing/types';

const TZ = 'Australia/Sydney';
const SERVICE = 'self-care';

function card(gst: boolean): RateCardSnapshot {
  return {
    id: 'c1',
    version: 1,
    bands: [
      { key: 'NIGHT', startMinuteOfDay: 0, endMinuteOfDay: 360 },
      { key: 'DAY', startMinuteOfDay: 360, endMinuteOfDay: 1200 },
      { key: 'EVENING', startMinuteOfDay: 1200, endMinuteOfDay: 1440 },
    ],
    rates: [
      { serviceTypeId: SERVICE, dayType: 'WEEKDAY', bandKey: 'DAY', method: 'ABSOLUTE', amountCents: 5000 },
    ],
    sleepover: {
      enabled: true,
      spanHours: 8,
      feeMethod: 'ABSOLUTE',
      feeCents: 20000,
      includedActiveHours: 2,
      excessActiveDayType: 'SATURDAY',
      gstApplicable: false,
    },
    travel: { perKmCents: 0, maxKmPerShift: null, travelTimeMode: 'NONE', gstApplicable: false },
    rounding: { minuteIncrement: 1, mode: 'NEAREST' },
    minimumEngagementMinutes: 0,
    classificationStrategy: 'SEGMENTED',
    serviceTypeGst: { [SERVICE]: gst },
  };
}

function priced(gst: boolean): PricingResult {
  const shift: ShiftInput = {
    startUtc: '2025-07-16T00:00:00Z', // 10am Sydney
    endUtc: '2025-07-16T04:00:00Z', // 2pm Sydney
    timezone: TZ,
    serviceTypeId: SERVICE,
    workerGstRegistered: true,
  };
  return priceShift(shift, card(gst));
}

describe('buildInvoice', () => {
  const from = { name: 'Sam Rivera', abn: '98 765 432 109' };
  const to = { name: 'Coastline Support Services', abn: '12 345 678 901' };

  it('produces a plain Invoice when nothing is GST-applicable', () => {
    const invoice = buildInvoice({
      shifts: [{ date: '2025-07-16', result: priced(false) }],
      from,
      to,
      number: 'INV-0001',
      issueDate: '2025-07-20',
      termsDays: 14,
      timezone: TZ,
    });

    expect(invoice.isTaxInvoice).toBe(false);
    expect(invoice.gstCents).toBe(0);
    expect(invoice.totalCents).toBe(invoice.subtotalCents);
    expect(invoice.dueDate).toBe('2025-08-03');
  });

  it('produces a Tax Invoice when GST applies', () => {
    const invoice = buildInvoice({
      shifts: [{ date: '2025-07-16', result: priced(true) }],
      from,
      to,
      number: 'INV-0002',
      issueDate: '2025-07-20',
      termsDays: 14,
      timezone: TZ,
    });

    expect(invoice.isTaxInvoice).toBe(true);
    expect(invoice.gstCents).toBeGreaterThan(0);
    expect(invoice.totalCents).toBe(invoice.subtotalCents + invoice.gstCents);
  });

  it('sorts multiple shifts into date order and spans the period', () => {
    const invoice = buildInvoice({
      shifts: [
        { date: '2025-07-18', result: priced(false) },
        { date: '2025-07-14', result: priced(false) },
        { date: '2025-07-16', result: priced(false) },
      ],
      from,
      to,
      number: 'INV-0003',
      issueDate: '2025-07-20',
      termsDays: 7,
      timezone: TZ,
    });

    expect(invoice.periodStart).toBe('2025-07-14');
    expect(invoice.periodEnd).toBe('2025-07-18');
    expect(invoice.lines.map((l) => l.serviceDate)).toEqual([
      '2025-07-14',
      '2025-07-16',
      '2025-07-18',
    ]);
  });

  it('uses an explicit period override instead of the shift date range', () => {
    const invoice = buildInvoice({
      shifts: [{ date: '2025-07-16', result: priced(false) }],
      from,
      to,
      number: 'INV-0004',
      issueDate: '2025-07-20',
      termsDays: 7,
      timezone: TZ,
      periodStart: '2025-07-01',
      periodEnd: '2025-07-14',
    });

    expect(invoice.periodStart).toBe('2025-07-01');
    expect(invoice.periodEnd).toBe('2025-07-14');
  });
});

describe('nextInvoiceNumber', () => {
  it('pads the sequence', () => {
    expect(nextInvoiceNumber('INV', 7)).toBe('INV-0007');
    expect(nextInvoiceNumber('INV', 12345)).toBe('INV-12345');
  });
});
