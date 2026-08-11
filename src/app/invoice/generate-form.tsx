'use client';

import { useActionState } from 'react';
import { generateInvoiceAction } from '@/lib/actions/invoices';
import { formatCents } from '@/lib/pricing/money';

export function GenerateForm({
  orgId,
  orgName,
  shiftCount,
  totalCents,
}: {
  orgId: string;
  orgName: string;
  shiftCount: number;
  totalCents: number;
}) {
  const [state, formAction, pending] = useActionState(generateInvoiceAction, {});

  return (
    <form action={formAction} className="card space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <h2 className="font-semibold text-ink">Ready to invoice</h2>
      <p className="text-sm text-ink-soft">
        {shiftCount} logged {shiftCount === 1 ? 'shift' : 'shifts'} for {orgName}, totalling{' '}
        <span className="font-semibold text-ink">{formatCents(totalCents)}</span>.
      </p>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Generating…' : 'Generate invoice'}
      </button>
    </form>
  );
}
