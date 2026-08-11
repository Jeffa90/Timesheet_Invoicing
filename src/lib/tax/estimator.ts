import { roundHalfUp } from '../pricing/money';
import type { Cents } from '../pricing/types';
import type { MarginalBracket, TaxEstimateConfig, TaxEstimateInput, TaxEstimateLine, TaxEstimateResult } from './types';

/**
 * Tax owed on `incomeCents` under a marginal bracket table: each slice of
 * income is taxed only at the rate for the bracket it falls in, not the top
 * rate reached. Sums in floats across brackets and rounds once at the end,
 * matching the rest of this app's money math (see amountForMinutes in
 * pricing/money.ts) rather than rounding per-bracket and compounding error.
 */
export function marginalTaxCents(incomeCents: Cents, brackets: MarginalBracket[]): Cents {
  if (incomeCents <= 0) return 0;

  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    if (incomeCents <= bracket.fromCents) break;

    const nextFrom = brackets[i + 1]?.fromCents ?? Infinity;
    const sliceTop = Math.min(incomeCents, nextFrom);
    const sliceAmount = sliceTop - bracket.fromCents;
    tax += sliceAmount * bracket.rate;
  }
  return roundHalfUp(tax);
}

/**
 * The Medicare levy is not a marginal-slice system like income tax: once
 * income reaches the threshold, the full rate applies to the WHOLE income,
 * not just the amount above it. (The real ATO rule also phases the levy in
 * more gently between a lower and upper threshold rather than jumping
 * straight to the full rate — that taper isn't modelled here, see
 * defaults.ts — but the cliff itself, at whichever single threshold is
 * configured, is the actual mechanism and must not be computed as a
 * marginal slice, or it would significantly underestimate the levy.)
 */
export function cliffLevyCents(incomeCents: Cents, threshold: MarginalBracket): Cents {
  return incomeCents >= threshold.fromCents ? roundHalfUp(incomeCents * threshold.rate) : 0;
}

/**
 * Estimates how much of a worker's year-to-date platform income they should
 * set aside for income tax, Medicare levy, HECS/HELP (if applicable), and
 * GST already collected (if registered). Pure and deterministic — no DB, no
 * clock — the caller is responsible for summing real invoice totals and
 * resolving the current financial year before calling this.
 *
 * GST is deliberately never added to `incomeCents` before this runs: it was
 * collected on the business's behalf, not earned, so taxing it as income
 * would overstate the bracket calculation. It still belongs in the
 * "set aside" total, just as its own separate line.
 */
export function estimateTaxSetAside(input: TaxEstimateInput, config: TaxEstimateConfig): TaxEstimateResult {
  const lines: TaxEstimateLine[] = [];

  const incomeTax = marginalTaxCents(input.incomeCents, config.incomeTaxBrackets);
  lines.push({ key: 'INCOME_TAX', label: 'Income tax', amountCents: incomeTax });

  const medicareLevy = cliffLevyCents(input.incomeCents, config.medicareLevyThreshold);
  lines.push({ key: 'MEDICARE_LEVY', label: 'Medicare levy', amountCents: medicareLevy });

  if (input.hasHecsDebt) {
    const hecs = marginalTaxCents(input.incomeCents, config.hecsRepaymentBrackets);
    lines.push({ key: 'HECS', label: 'HECS/HELP repayment', amountCents: hecs });
  }

  if (input.gstRegistered && input.gstCollectedCents > 0) {
    lines.push({ key: 'GST_COLLECTED', label: 'GST already collected', amountCents: input.gstCollectedCents });
  }

  const totalSetAsideCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

  return { incomeCents: input.incomeCents, lines, totalSetAsideCents };
}
