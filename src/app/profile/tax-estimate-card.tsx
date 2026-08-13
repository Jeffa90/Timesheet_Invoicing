import Link from 'next/link';
import { db } from '@/lib/db';
import { AU_STATES, AU_TIMEZONES, type AuState } from '@/lib/pricing/defaults';
import { formatCentsWithSeparators } from '@/lib/pricing/money';
import { DEFAULT_TAX_CONFIG } from '@/lib/tax/defaults';
import { estimateTaxSetAside } from '@/lib/tax/estimator';
import { currentFinancialYear, previousFinancialYear } from '@/lib/tax/financial-year';

/** A worker's own state is a better proxy for their tax residency than whichever
 * business org they're currently engaged with — falls back to Sydney if unset. */
function resolveTimezone(state: string | null): string {
  if (state && (AU_STATES as readonly string[]).includes(state)) {
    return AU_TIMEZONES[state as AuState];
  }
  return AU_TIMEZONES.NSW;
}

/**
 * Estimates how much of a worker's year-to-date platform income to set aside
 * for tax. Cash basis: only invoices actually marked PAID, within the
 * financial year, count toward the figures below — SENT/DRAFT invoices show
 * as a separate "pending" line so a worker isn't blindsided later, but never
 * feed the tax math itself. This is informational only; we never hold or
 * move any money.
 */
export async function TaxEstimateCard({
  userId,
  gstRegistered,
  hasHecsDebt,
  state,
  viewingPrevious,
}: {
  userId: string;
  gstRegistered: boolean;
  hasHecsDebt: boolean;
  state: string | null;
  viewingPrevious: boolean;
}) {
  const timezone = resolveTimezone(state);
  const current = currentFinancialYear(timezone);
  const previous = previousFinancialYear(current, timezone);
  const window = viewingPrevious ? previous : current;

  const [paid, pending] = await Promise.all([
    db.invoice.aggregate({
      where: { userId, status: 'PAID', paidAt: { gte: new Date(window.startUtc), lt: new Date(window.endUtc) } },
      _sum: { subtotalCents: true, gstCents: true },
    }),
    db.invoice.aggregate({
      where: {
        userId,
        status: { in: ['SENT', 'DRAFT'] },
        issueDate: { gte: new Date(window.startUtc), lt: new Date(window.endUtc) },
      },
      _sum: { totalCents: true },
    }),
  ]);

  const incomeCents = paid._sum.subtotalCents ?? 0;
  const gstCollectedCents = paid._sum.gstCents ?? 0;
  const pendingCents = pending._sum.totalCents ?? 0;

  const result = estimateTaxSetAside({ incomeCents, gstCollectedCents, gstRegistered, hasHecsDebt }, DEFAULT_TAX_CONFIG);

  return (
    <section className="card space-y-4" aria-labelledby="tax-estimate">
      <div className="flex items-center justify-between gap-4">
        <h2 id="tax-estimate" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Tax set-aside estimate
        </h2>
        <div className="flex gap-1 text-xs font-medium">
          <Link
            href="/profile"
            className={`rounded-full px-2.5 py-1 ${!viewingPrevious ? 'bg-brand-100 text-brand-700' : 'text-ink-faint hover:bg-surface-sunk'}`}
          >
            {current.label}
          </Link>
          <Link
            href="/profile?fy=previous"
            className={`rounded-full px-2.5 py-1 ${viewingPrevious ? 'bg-brand-100 text-brand-700' : 'text-ink-faint hover:bg-surface-sunk'}`}
          >
            {previous.label}
          </Link>
        </div>
      </div>

      {incomeCents === 0 ? (
        <p className="text-sm text-ink-soft">No paid invoices yet for {window.label}.</p>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-ink-soft">Set this aside</p>
            <p className="text-3xl font-bold tracking-tight text-ink">{formatCentsWithSeparators(result.totalSetAsideCents)}</p>
            <p className="text-sm text-ink-faint">
              From {formatCentsWithSeparators(incomeCents)} paid so far in {window.label}.
            </p>
          </div>

          <div className="space-y-2 border-t border-surface-line pt-4">
            {result.lines.map((line) => (
              <div key={line.key} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{line.label}</span>
                <span className="font-medium tabular-nums text-ink">{formatCentsWithSeparators(line.amountCents)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {pendingCents > 0 && (
        <p className="text-xs text-ink-faint">
          Plus {formatCentsWithSeparators(pendingCents)} invoiced but not yet paid — not counted above.
        </p>
      )}

      <p className="rounded-lg bg-warnbg px-3 py-2 text-xs text-warn">
        This is an estimate based only on income earned through this app — not tax advice. It
        doesn&apos;t account for other income, deductions or offsets. Check the ATO or an
        accountant before relying on it.
      </p>
    </section>
  );
}
