import type { MarginalBracket, TaxEstimateConfig } from './types';

/**
 * Australian individual resident tax rates, Medicare levy, and HECS/HELP
 * repayment thresholds. Like NDIS_PRICE_SNAPSHOT_LABEL in pricing/defaults.ts,
 * these are legislated/indexed figures reissued each 1 July — a snapshot with
 * a date attached, not a constant. Review against the ATO's published rates
 * every financial year.
 *
 * Three deliberate simplifications are made below, and every one of them
 * points the same direction: the estimate comes out slightly HIGHER than the
 * worker's true liability, never lower. A worker who sets aside a bit more
 * than they strictly need is inconvenienced; one who sets aside too little
 * because we underestimated is not. When in doubt, overestimate.
 */

export const AU_TAX_SNAPSHOT_LABEL = 'FY2026–27 individual resident rates';
export const AU_TAX_SNAPSHOT_SOURCE = 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents';

export const INCOME_TAX_BRACKETS_2026_27: MarginalBracket[] = [
  { fromCents: 0, rate: 0 },
  { fromCents: 18_200_00, rate: 0.15 },
  { fromCents: 45_000_00, rate: 0.3 },
  { fromCents: 135_000_00, rate: 0.37 },
  { fromCents: 190_000_00, rate: 0.45 },
];
// Simplification: the Low Income Tax Offset (up to $700) is not modelled, so
// the estimate runs a little high for lower incomes — never low.

// The levy is a threshold cliff, not a marginal bracket table: once income
// reaches the threshold, ALL of it is levied at the rate (see cliffLevyCents
// in estimator.ts) — applying this as a marginal slice above the threshold,
// the way income tax works, would significantly understate the real levy.
export const MEDICARE_LEVY_THRESHOLD_2026_27: MarginalBracket = { fromCents: 28_011_00, rate: 0.02 };
// Simplification: the real levy phases in at 10% of the excess between
// $28,011 and $35,014 before reaching the full 2%; here it jumps straight to
// the full 2% at $28,011 instead, which overestimates that narrow band —
// same conservative direction as everywhere else in this file.

export const HECS_REPAYMENT_BRACKETS_2026_27: MarginalBracket[] = [
  { fromCents: 0, rate: 0 },
  { fromCents: 69_528_00, rate: 0.15 },
  { fromCents: 129_717_00, rate: 0.17 },
];
// Simplification: the ATO caps total HELP repayment at 10% of total income
// once it passes roughly $186k (a ceiling on this marginal formula, not a
// fourth bracket — the two cross over almost exactly there). That cap isn't
// modelled, so the 17% marginal rate keeps applying indefinitely instead,
// which overestimates HECS at very high incomes. Support-worker income
// through a single platform realistically never reaches that band anyway.

export const DEFAULT_TAX_CONFIG: TaxEstimateConfig = {
  incomeTaxBrackets: INCOME_TAX_BRACKETS_2026_27,
  medicareLevyThreshold: MEDICARE_LEVY_THRESHOLD_2026_27,
  hecsRepaymentBrackets: HECS_REPAYMENT_BRACKETS_2026_27,
  snapshotLabel: AU_TAX_SNAPSHOT_LABEL,
  snapshotSource: AU_TAX_SNAPSHOT_SOURCE,
};
