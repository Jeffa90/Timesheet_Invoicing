import type { Cents } from './types';

/** GST rate in Australia. Applied only where both the worker and the item are taxable. */
export const GST_RATE = 0.1;

/**
 * Round half away from zero.
 *
 * JavaScript's Math.round rounds -0.5 to -0 (half up towards positive infinity),
 * which would quietly under-bill credits and adjustments. Billing wants symmetry.
 */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Price a duration at an hourly rate.
 *
 * Takes whole minutes rather than fractional hours so there is no float drift:
 * 7h20m at $70.23/h is (440 * 7023) / 60, rounded once, not 7.3333... * 7023.
 */
export function amountForMinutes(minutes: number, centsPerHour: Cents): Cents {
  return roundHalfUp((minutes * centsPerHour) / 60);
}

/** GST on a line. Returns 0 when the line is not taxable. */
export function gstFor(amountCents: Cents, gstApplicable: boolean): Cents {
  return gstApplicable ? roundHalfUp(amountCents * GST_RATE) : 0;
}

/** Percentage of an NDIS price cap, e.g. 80% of $70.23 -> 5618 cents. */
export function percentOfCap(capCents: Cents, percent: number): Cents {
  return roundHalfUp((capCents * percent) / 100);
}

export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Hours to a human string: 2 -> "2h", 2.5 -> "2h 30m", 0.25 -> "15m". */
export function formatHours(hours: number): string {
  const totalMinutes = roundHalfUp(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
