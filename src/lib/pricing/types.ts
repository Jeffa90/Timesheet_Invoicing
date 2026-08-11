/**
 * Types for the shift pricing engine.
 *
 * Money is ALWAYS an integer number of cents. Never a float, never a string.
 * Times crossing the wire are ISO-8601 instants in UTC; the engine converts
 * them to the organisation's IANA timezone before doing any wall-clock work.
 */

/** An integer number of cents. */
export type Cents = number;

export type DayType = 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'PUBLIC_HOLIDAY';

/** Time-of-day bands. NDIS defaults: DAY 06:00-20:00, EVENING 20:00-24:00, NIGHT 00:00-06:00. */
export type BandKey = 'DAY' | 'EVENING' | 'NIGHT';

export type Unit = 'HOUR' | 'EACH' | 'KM' | 'NIGHT';

/**
 * How a shift spanning several bands is classified.
 * - SEGMENTED:   each portion bills at its own rate (default, and what the NDIS guide describes)
 * - SHIFT_START: the whole shift takes the band/day-type of its start time
 * - MAJORITY:    the whole shift takes the band where most of its minutes fall
 */
export type ClassificationStrategy = 'SEGMENTED' | 'SHIFT_START' | 'MAJORITY';

/**
 * Absolute dollar figure, or a percentage of the published NDIS price cap.
 * PERCENT_OF_CAP rates automatically follow the price guide when caps are re-imported.
 */
export type RateMethod = 'ABSOLUTE' | 'PERCENT_OF_CAP';

export interface UtcInterval {
  startUtc: string;
  endUtc: string;
}

export interface ShiftBreak extends UtcInterval {
  /** Paid breaks stay billable; unpaid breaks are carved out of the shift. */
  paid: boolean;
}

export interface SleepoverInput extends Record<string, unknown> {
  windowStartUtc: string;
  windowEndUtc: string;
  /** Periods the worker was woken to provide support during the sleepover window. */
  activeSupport?: UtcInterval[];
}

export interface ShiftExpense {
  description: string;
  amountCents: Cents;
  gstApplicable: boolean;
}

export interface ShiftInput {
  startUtc: string;
  endUtc: string;
  /** IANA zone, e.g. "Australia/Sydney". All band logic is wall-clock in this zone. */
  timezone: string;
  serviceTypeId: string;
  breaks?: ShiftBreak[];
  sleepover?: SleepoverInput;
  travelKm?: number;
  travelMinutes?: number;
  expenses?: ShiftExpense[];
}

export interface TimeBandDef {
  key: BandKey;
  /** Minutes from local midnight. Bands must tile 0..1440 without gaps or overlaps. */
  startMinuteOfDay: number;
  endMinuteOfDay: number;
}

export interface RateDef {
  serviceTypeId: string;
  dayType: DayType;
  /** null means the rate applies all day (typical for Saturday/Sunday/public holiday). */
  bandKey: BandKey | null;
  method: RateMethod;
  amountCents?: Cents;
  percentOfCap?: number;
  /** The published NDIS price limit for this line item, used by PERCENT_OF_CAP and cap warnings. */
  capCents?: Cents;
  ndisLineItemCode?: string;
}

export interface SleepoverConfig {
  enabled: boolean;
  /** The NDIS night-time sleepover span is a continuous 8 hours. */
  spanHours: number;
  feeMethod: RateMethod;
  feeCents?: Cents;
  feePercentOfCap?: number;
  feeCapCents?: Cents;
  /** Active support included in the flat fee before extra billing starts. NDIS default: 2. */
  includedActiveHours: number;
  /**
   * Day type used to price active support beyond the included allowance.
   * 'PREVAILING' uses whatever day type the clock actually falls in; the NDIS guide
   * describes claiming the third and later hours at Saturday rates on a weekday.
   */
  excessActiveDayType: DayType | 'PREVAILING';
  gstApplicable: boolean;
  ndisLineItemCode?: string;
}

export interface TravelConfig {
  perKmCents: Cents;
  /** null means uncapped. */
  maxKmPerShift: number | null;
  travelTimeMode: 'NONE' | 'PREVAILING' | 'FLAT';
  travelTimeFlatCentsPerHour?: Cents;
  gstApplicable: boolean;
}

export interface RoundingConfig {
  /** Round billable durations to this many minutes. 1 = to the minute. */
  minuteIncrement: number;
  mode: 'NEAREST' | 'UP' | 'DOWN';
}

export interface RateCardSnapshot {
  id: string;
  version: number;
  bands: TimeBandDef[];
  rates: RateDef[];
  sleepover: SleepoverConfig;
  travel: TravelConfig;
  rounding: RoundingConfig;
  /** Shortfall below this is billed as a visible top-up line, never a silent adjustment. */
  minimumEngagementMinutes: number;
  classificationStrategy: ClassificationStrategy;
  /** serviceTypeId -> whether GST applies. Many NDIS supports are GST-free. */
  serviceTypeGst: Record<string, boolean>;
}

export interface PublicHolidayDef {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  name: string;
}

export type LineKind =
  | 'HOURLY'
  | 'SLEEPOVER'
  | 'ACTIVE_SUPPORT'
  | 'TRAVEL_KM'
  | 'TRAVEL_TIME'
  | 'EXPENSE'
  | 'MINIMUM_TOPUP';

export interface PricedLine {
  kind: LineKind;
  description: string;
  /** Local ISO times, present on time-based lines so the invoice can show the actual clock. */
  startLocal?: string;
  endLocal?: string;
  dayType?: DayType;
  bandKey?: BandKey | null;
  quantity: number;
  unit: Unit;
  unitRateCents: Cents;
  amountCents: Cents;
  gstCents: Cents;
  gstApplicable: boolean;
  ndisLineItemCode?: string;
}

export interface PricingWarning {
  code:
    | 'RATE_EXCEEDS_NDIS_CAP'
    | 'BELOW_MINIMUM_ENGAGEMENT'
    | 'SLEEPOVER_SPAN_SHORT'
    | 'SLEEPOVER_NOT_OVERNIGHT'
    | 'TRAVEL_KM_CAPPED'
    | 'MISSING_RATE';
  message: string;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalCents: Cents;
  gstCents: Cents;
  totalCents: Cents;
  /** Billable hourly time, excluding the flat sleepover span. */
  billableHours: number;
  warnings: PricingWarning[];
  /** Plain-English explanation, rendered directly in the UI so workers can check the maths. */
  trace: string[];
  rateCardId: string;
  rateCardVersion: number;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}
