import { DEFAULT_TIME_BANDS } from './pricing/defaults';
import type { PublicHolidayDef, RateCardSnapshot } from './pricing/types';

/**
 * Demo configuration so the app is explorable before a database is attached.
 *
 * The hourly caps are the published 2025-26 NDIS price limits for "Assistance With
 * Self-Care Activities - Standard". The two figures marked below are NOT sourced —
 * they are stand-ins so the demo runs, and the setup wizard makes the business
 * confirm every rate against the current guide before a real shift is priced.
 */

export const DEMO_SERVICE_ID = 'self-care';

export const DEMO_ORG = {
  name: 'Coastline Support Services',
  abn: '12 345 678 901',
  timezone: 'Australia/Sydney',
  state: 'NSW',
  gstRegistered: true,
};

export const DEMO_WORKER = {
  name: 'Sam Rivera',
  businessName: 'S. Rivera Support Work',
  abn: '98 765 432 109',
  gstRegistered: false, // so the demo issues an "Invoice", not a "Tax Invoice"
};

/** Rates a business might negotiate with a subcontractor: 80% of the NDIS cap. */
export const DEMO_RATE_CARD: RateCardSnapshot = {
  id: 'demo-card',
  version: 1,
  bands: DEFAULT_TIME_BANDS,
  rates: [
    {
      serviceTypeId: DEMO_SERVICE_ID,
      dayType: 'WEEKDAY',
      bandKey: 'DAY',
      method: 'PERCENT_OF_CAP',
      percentOfCap: 80,
      capCents: 7023,
      ndisLineItemCode: '01_011_0107_1_1',
    },
    {
      serviceTypeId: DEMO_SERVICE_ID,
      dayType: 'WEEKDAY',
      bandKey: 'EVENING',
      method: 'PERCENT_OF_CAP',
      percentOfCap: 80,
      capCents: 7738,
      ndisLineItemCode: '01_012_0107_1_1',
    },
    {
      serviceTypeId: DEMO_SERVICE_ID,
      dayType: 'WEEKDAY',
      bandKey: 'NIGHT',
      method: 'ABSOLUTE',
      amountCents: 6305, // placeholder — confirm the night cap during setup
      ndisLineItemCode: '01_002_0107_1_1',
    },
    {
      serviceTypeId: DEMO_SERVICE_ID,
      dayType: 'SATURDAY',
      bandKey: null,
      method: 'PERCENT_OF_CAP',
      percentOfCap: 80,
      capCents: 9883,
      ndisLineItemCode: '01_013_0107_1_1',
    },
    {
      serviceTypeId: DEMO_SERVICE_ID,
      dayType: 'SUNDAY',
      bandKey: null,
      method: 'PERCENT_OF_CAP',
      percentOfCap: 80,
      capCents: 12743,
      ndisLineItemCode: '01_014_0107_1_1',
    },
    {
      serviceTypeId: DEMO_SERVICE_ID,
      dayType: 'PUBLIC_HOLIDAY',
      bandKey: null,
      method: 'PERCENT_OF_CAP',
      percentOfCap: 80,
      capCents: 15603,
      ndisLineItemCode: '01_015_0107_1_1',
    },
  ],
  sleepover: {
    enabled: true,
    spanHours: 8,
    feeMethod: 'ABSOLUTE',
    feeCents: 22000, // placeholder — confirm the sleepover cap during setup
    includedActiveHours: 2,
    excessActiveDayType: 'SATURDAY',
    gstApplicable: false,
    ndisLineItemCode: '01_010_0107_1_1',
  },
  travel: {
    perKmCents: 100,
    maxKmPerShift: 50,
    travelTimeMode: 'NONE',
    gstApplicable: false,
  },
  rounding: { minuteIncrement: 1, mode: 'NEAREST' },
  minimumEngagementMinutes: 120,
  classificationStrategy: 'SEGMENTED',
  serviceTypeGst: { [DEMO_SERVICE_ID]: false }, // most NDIS supports are GST-free
};

/** Defaults offered when a worker ticks "overnight", as minutes from local midnight. */
export const DEMO_SLEEPOVER_DEFAULTS = { startMin: 22 * 60, endMin: 6 * 60 };

/** NSW public holidays. In production these are imported per state and kept current. */
export const DEMO_HOLIDAYS: PublicHolidayDef[] = [
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Boxing Day' },
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-26', name: 'Australia Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-04', name: 'Easter Saturday' },
  { date: '2026-04-05', name: 'Easter Sunday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-04-25', name: 'Anzac Day' },
  { date: '2026-06-08', name: "King's Birthday" },
  { date: '2026-10-05', name: 'Labour Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
];
