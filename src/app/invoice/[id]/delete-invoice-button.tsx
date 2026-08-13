'use client';

import { useTransition } from 'react';
import { deleteInvoiceAction } from '@/lib/actions/invoices';

export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        if (!window.confirm('Delete this invoice? Its shifts will become available to invoice again.')) return;
        startTransition(() => deleteInvoiceAction(invoiceId));
      }}
    >
      <button type="submit" className="text-sm font-medium text-warn underline" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete invoice'}
      </button>
    </form>
  );
}
