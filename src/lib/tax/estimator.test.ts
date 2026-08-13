import { describe, expect, it } from 'vitest';
import { cliffLevyCents, estimateTaxSetAside, marginalTaxCents } from './estimator';
import { DEFAULT_TAX_CONFIG, HECS_REPAYMENT_BRACKETS_2026_27, INCOME_TAX_BRACKETS_2026_27 } from './defaults';

describe('marginalTaxCents', () => {
  it('taxes nothing at zero income', () => {
    expect(marginalTaxCents(0, INCOME_TAX_BRACKETS_2026_27)).toBe(0);
  });

  it('taxes exactly $4,020 at the top of the 15% bracket ($45,000)', () => {
    // 15% of ($45,000 - $18,200) = 15% of $26,800 = $4,020
    expect(marginalTaxCents(45_000_00, INCOME_TAX_BRACKETS_2026_27)).toBe(4_020_00);
  });

  it('taxes each slice at its own rate deep in the top bracket ($200,000)', () => {
    // $4,020 (to $45k) + 30% of $90,000 (to $135k) = $31,020
    // + 37% of $55,000 (to $190k) = $20,350 -> $51,370
    // + 45% of $10,000 (above $190k) = $4,500 -> $55,870
    expect(marginalTaxCents(200_000_00, INCOME_TAX_BRACKETS_2026_27)).toBe(55_870_00);
  });

  it('applies the HECS base-plus-marginal formula above the second threshold', () => {
    // 15% of ($129,717 - $69,528) = $9,028.35, then +17% of the excess over $129,717
    const atSecondThreshold = marginalTaxCents(129_717_00, HECS_REPAYMENT_BRACKETS_2026_27);
    expect(atSecondThreshold).toBe(9_028_35);
    expect(marginalTaxCents(139_717_00, HECS_REPAYMENT_BRACKETS_2026_27)).toBe(9_028_35 + 1_700_00);
  });
});

describe('cliffLevyCents', () => {
  const threshold = DEFAULT_TAX_CONFIG.medicareLevyThreshold;

  it('charges nothing below the threshold', () => {
    expect(cliffLevyCents(20_000_00, threshold)).toBe(0);
  });

  it('charges the rate on the WHOLE income once at the threshold, not just the excess', () => {
    // This is the case that would be wrong if computed as a marginal slice:
    // 2% of the full $28,011, not 2% of ($28,011 - $28,011) = $0.
    expect(cliffLevyCents(28_011_00, threshold)).toBe(56_022);
  });

  it('charges the rate on the whole income well above the threshold', () => {
    // 2% of $80,000 = $1,600 — NOT 2% of ($80,000 - $28,011) = $1,039.78
    expect(cliffLevyCents(80_000_00, threshold)).toBe(1_600_00);
  });
});

describe('estimateTaxSetAside', () => {
  it('includes all four lines, summing to the total, when every flag is on', () => {
    const result = estimateTaxSetAside(
      { incomeCents: 80_000_00, gstCollectedCents: 8_000_00, gstRegistered: true, hasHecsDebt: true },
      DEFAULT_TAX_CONFIG,
    );

    expect(result.lines.map((l) => l.key)).toEqual(['INCOME_TAX', 'MEDICARE_LEVY', 'HECS', 'GST_COLLECTED']);
    const sum = result.lines.reduce((s, l) => s + l.amountCents, 0);
    expect(result.totalSetAsideCents).toBe(sum);
    expect(result.totalSetAsideCents).toBe(25_690_80);
  });

  it('omits the HECS line when the worker has no HECS debt, even in a HECS-liable income range', () => {
    const result = estimateTaxSetAside(
      { incomeCents: 80_000_00, gstCollectedCents: 0, gstRegistered: false, hasHecsDebt: false },
      DEFAULT_TAX_CONFIG,
    );

    expect(result.lines.map((l) => l.key)).not.toContain('HECS');
  });

  it('omits the GST line when not GST-registered, even if a nonzero gstCollectedCents is passed', () => {
    const result = estimateTaxSetAside(
      { incomeCents: 50_000_00, gstCollectedCents: 5_000_00, gstRegistered: false, hasHecsDebt: false },
      DEFAULT_TAX_CONFIG,
    );

    expect(result.lines.map((l) => l.key)).not.toContain('GST_COLLECTED');
  });

  it('never lets GST collected leak into the income-tax/Medicare base', () => {
    // Tiny income, huge GST figure — if GST were folded into the taxable base,
    // income tax and the Medicare levy would both be nonzero here. They must not be.
    const result = estimateTaxSetAside(
      { incomeCents: 10_000_00, gstCollectedCents: 50_000_00, gstRegistered: true, hasHecsDebt: false },
      DEFAULT_TAX_CONFIG,
    );

    expect(result.lines.find((l) => l.key === 'INCOME_TAX')?.amountCents).toBe(0);
    expect(result.lines.find((l) => l.key === 'MEDICARE_LEVY')?.amountCents).toBe(0);
    expect(result.lines.find((l) => l.key === 'GST_COLLECTED')?.amountCents).toBe(50_000_00);
    expect(result.totalSetAsideCents).toBe(50_000_00);
  });
});
