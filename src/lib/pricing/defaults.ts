import type { RateCardSnapshot, TimeBandDef } from './types';

/**
 * NDIS defaults.
 *
 * These are STARTING POINTS presented in the setup wizard for the business to confirm,
 * never silently applied. The Pricing Arrangements and Price Limits are reissued each
 * 1 July, so anything here is a snapshot with a date attached rather than a constant.
 *
 * Figures marked `null` are deliberately not guessed — the wizard requires the business
 * to enter them, because a wrong default that looks authoritative is worse than a blank.
 */

export const NDIS_PRICE_SNAPSHOT_LABEL = '2025-26 NDIS Pricing Arrangements and Price Limits';
export const NDIS_PRICE_SNAPSHOT_SOURCE =
  'https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements';

/**
 * Standard NDIS time-of-day bands. These tile the full 24 hours, which the
 * segmentation code relies on.
 */
export const DEFAULT_TIME_BANDS: TimeBandDef[] = [
  { key: 'NIGHT', startMinuteOfDay: 0, endMinuteOfDay: 6 * 60 },
  { key: 'DAY', startMinuteOfDay: 6 * 60, endMinuteOfDay: 20 * 60 },
  { key: 'EVENING', startMinuteOfDay: 20 * 60, endMinuteOfDay: 24 * 60 },
];

/**
 * A single band spanning the whole day, for rate cards billing one rate per
 * day type with no morning/evening/night split. segmentInterval still cuts
 * at every local midnight regardless, so this produces exactly one segment
 * per calendar day — no engine changes needed, this is the only piece that
 * differs from DEFAULT_TIME_BANDS.
 */
export const DEFAULT_DAILY_TIME_BAND: TimeBandDef[] = [{ key: 'DAY', startMinuteOfDay: 0, endMinuteOfDay: 24 * 60 }];

/** Sleepover defaults straight from the guide: a continuous 8-hour span including 2 active hours. */
export const DEFAULT_SLEEPOVER_SPAN_HOURS = 8;
export const DEFAULT_SLEEPOVER_INCLUDED_ACTIVE_HOURS = 2;

/**
 * Published price limits for "Assistance With Self-Care Activities - Standard",
 * national (non-remote), as at the 2025-26 guide. Used as the cap for
 * PERCENT_OF_CAP rates and for the "exceeds NDIS cap" warning.
 *
 * `null` means we have not verified a figure and the business must supply it.
 */
export interface CapSnapshot {
  weekdayDayCents: number;
  weekdayEveningCents: number;
  weekdayNightCents: number | null;
  saturdayCents: number;
  sundayCents: number;
  publicHolidayCents: number;
  sleepoverCents: number | null;
}

export const DEFAULT_CAPS: CapSnapshot = {
  weekdayDayCents: 7023,
  weekdayEveningCents: 7738,
  weekdayNightCents: null, // confirm against the current guide during setup
  saturdayCents: 9883,
  sundayCents: 12743,
  publicHolidayCents: 15603,
  sleepoverCents: null, // confirm against the current guide during setup
};

/** A rate card skeleton with sensible rules but no rates — the wizard fills those in. */
export function emptyRateCard(overrides: Partial<RateCardSnapshot> = {}): RateCardSnapshot {
  return {
    id: 'draft',
    version: 1,
    bands: DEFAULT_TIME_BANDS,
    rates: [],
    sleepover: {
      enabled: true,
      spanHours: DEFAULT_SLEEPOVER_SPAN_HOURS,
      feeMethod: 'ABSOLUTE',
      feeCents: 0,
      includedActiveHours: DEFAULT_SLEEPOVER_INCLUDED_ACTIVE_HOURS,
      // The guide describes claiming the third and later active hours at Saturday rates
      // on a weekday. Businesses can switch this to PREVAILING if their agreement differs.
      excessActiveDayType: 'SATURDAY',
      gstApplicable: false,
    },
    travel: {
      perKmCents: 0,
      maxKmPerShift: null,
      travelTimeMode: 'NONE',
      gstApplicable: false,
    },
    rounding: { minuteIncrement: 1, mode: 'NEAREST' },
    minimumEngagementMinutes: 0,
    classificationStrategy: 'SEGMENTED',
    serviceTypeGst: {},
    ...overrides,
  };
}

/** Australian states and territories, for the public holiday calendar. */
export const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;
export type AuState = (typeof AU_STATES)[number];

export const AU_TIMEZONES: Record<AuState, string> = {
  NSW: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  WA: 'Australia/Perth',
  TAS: 'Australia/Hobart',
  NT: 'Australia/Darwin',
  ACT: 'Australia/Sydney',
};
