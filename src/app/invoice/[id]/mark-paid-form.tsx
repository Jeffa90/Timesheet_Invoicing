'use client';

import { useActionState } from 'react';
import { markInvoicePaidAction } from '@/lib/actions/business-invoices';

export function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState(markInvoicePaidAction.bind(null, invoiceId), {});

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      <input
        name="paymentReference"
        placeholder="Payment reference (optional)"
        className="field w-56 !min-h-0 py-2 text-sm"
      />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Mark as paid'}
      </button>
      {state.error && (
        <p className="w-full text-right text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
