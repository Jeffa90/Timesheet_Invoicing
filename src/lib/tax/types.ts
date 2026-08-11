import type { Cents } from '../pricing/types';

/**
 * A marginal tax bracket. `fromCents` is the income level at which this rate
 * starts applying — only the slice of income above it (and below the next
 * bracket's `fromCents`) is taxed at `rate`. Brackets must be sorted
 * ascending by `fromCents`, and the first one is normally `{ fromCents: 0 }`.
 */
export interface MarginalBracket {
  fromCents: Cents;
  rate: number;
}

export interface TaxEstimateConfig {
  incomeTaxBrackets: MarginalBracket[];
  /**
   * Unlike income tax, the Medicare levy is not a marginal-slice system: once
   * income reaches this threshold, the full rate applies to the WHOLE income,
   * not just the amount above it (see cliffLevyCents in estimator.ts).
   */
  medicareLevyThreshold: MarginalBracket;
  hecsRepaymentBrackets: MarginalBracket[];
  /** Which financial year's published rates this config represents, e.g. "FY2026–27". */
  snapshotLabel: string;
  snapshotSource: string;
}

export interface TaxEstimateInput {
  /** Year-to-date income excluding GST — the base every bracket calculation runs against. */
  incomeCents: Cents;
  /** GST already collected on invoices — never part of the tax base, always its own line. */
  gstCollectedCents: Cents;
  gstRegistered: boolean;
  hasHecsDebt: boolean;
}

export type TaxEstimateLineKey = 'INCOME_TAX' | 'MEDICARE_LEVY' | 'HECS' | 'GST_COLLECTED';

export interface TaxEstimateLine {
  key: TaxEstimateLineKey;
  label: string;
  amountCents: Cents;
}

export interface TaxEstimateResult {
  incomeCents: Cents;
  lines: TaxEstimateLine[];
  totalSetAsideCents: Cents;
}

export interface FinancialYearWindow {
  /** The calendar year the FY starts in, e.g. 2026 for "2026–27". */
  startYear: number;
  label: string;
  /** UTC instant, inclusive. */
  startUtc: string;
  /** UTC instant, exclusive. */
  endUtc: string;
}
