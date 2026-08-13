'use client';

import { useActionState, useMemo, useState } from 'react';
import { generateInvoiceAction } from '@/lib/actions/invoices';
import { formatCents } from '@/lib/pricing/money';

interface PendingShift {
  /** Local calendar date the shift started, yyyy-MM-dd. */
  date: string;
  totalCents: number;
}

export function GenerateForm({
  orgId,
  orgName,
  pendingShifts,
}: {
  orgId: string;
  orgName: string;
  pendingShifts: PendingShift[];
}) {
  const [state, formAction, pending] = useActionState(generateInvoiceAction, {});
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const included = useMemo(
    () =>
      pendingShifts.filter(
        (s) => (!periodStart || s.date >= periodStart) && (!periodEnd || s.date <= periodEnd),
      ),
    [pendingShifts, periodStart, periodEnd],
  );
  const includedTotalCents = included.reduce((sum, s) => sum + s.totalCents, 0);
  const hasPeriod = Boolean(periodStart || periodEnd);

  return (
    <form action={formAction} className="card space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <h2 className="font-semibold text-ink">Ready to invoice</h2>
      <p className="text-sm text-ink-soft">
        {included.length} logged {included.length === 1 ? 'shift' : 'shifts'} for {orgName}, totalling{' '}
        <span className="font-semibold text-ink">{formatCents(includedTotalCents)}</span>
        {hasPeriod && included.length !== pendingShifts.length && ' within the period below'}.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="periodStart">
            Period start
          </label>
          <input
            id="periodStart"
            type="date"
            name="periodStart"
            className="field"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="periodEnd">
            Period end
          </label>
          <input
            id="periodEnd"
            type="date"
            name="periodEnd"
            className="field"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-ink-faint">
        Leave both blank to invoice every logged shift, with the period shown on the invoice set to
        their date range. Enter a period to only invoice shifts within it and show that exact period
        on the invoice — handy for a fixed fortnightly cycle.
      </p>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending || included.length === 0}>
        {pending ? 'Generating…' : 'Generate invoice'}
      </button>
    </form>
  );
}
