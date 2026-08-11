'use client';

import { markInvoiceUnpaidAction } from '@/lib/actions/business-invoices';

export function MarkUnpaidButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={markInvoiceUnpaidAction.bind(null, invoiceId)}>
      <button type="submit" className="text-sm font-medium text-ink-faint underline hover:text-ink-soft">
        Mark as unpaid
      </button>
    </form>
  );
}
