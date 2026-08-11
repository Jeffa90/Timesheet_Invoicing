'use client';

import { markInvoiceSentAction } from '@/lib/actions/invoices';

export function SendButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={markInvoiceSentAction.bind(null, invoiceId)}>
      <button type="submit" className="btn-primary">
        Mark as sent
      </button>
    </form>
  );
}
