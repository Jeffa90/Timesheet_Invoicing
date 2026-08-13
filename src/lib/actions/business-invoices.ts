'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isOrgAdmin, requireSessionUser } from '@/lib/session';

export interface MarkPaidState {
  error?: string;
}

const schema = z.object({ paymentReference: z.string().trim().optional() });

/** Business side: records that an invoice has been paid. Payment tracking only — no approval gate. */
export async function markInvoicePaidAction(
  invoiceId: string,
  _prev: MarkPaidState,
  formData: FormData,
): Promise<MarkPaidState> {
  const user = await requireSessionUser();
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: 'That invoice could not be found.' };
  if (!(await isOrgAdmin(user.id, invoice.orgId))) return { error: "You don't have access to that business." };
  if (invoice.status !== 'SENT') return { error: 'Only a sent invoice can be marked as paid.' };

  const parsed = schema.safeParse({ paymentReference: formData.get('paymentReference') || undefined });

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: 'PAID', paidAt: new Date(), paymentReference: parsed.data?.paymentReference },
  });

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath('/business/invoices');
  return {};
}

/** Undo for a mistaken "mark as paid" — back to SENT (awaiting payment). */
export async function markInvoiceUnpaidAction(invoiceId: string) {
  const user = await requireSessionUser();
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || !(await isOrgAdmin(user.id, invoice.orgId)) || invoice.status !== 'PAID') return;

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: 'SENT', paidAt: null, paymentReference: null },
  });

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath('/business/invoices');
}
