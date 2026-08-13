import { db } from '@/lib/db';
import { isOrgAdmin, requireSessionUser } from '@/lib/session';

/**
 * Loads an invoice for the current session user, enforcing the same access
 * rule everywhere an invoice can be viewed: the worker who owns it, or an
 * admin-rights member of the business it's addressed to. Returns null on any
 * mismatch so callers can 404 without leaking whether the id exists.
 */
export async function loadInvoiceForViewer(id: string) {
  const user = await requireSessionUser();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, org: true },
  });

  const isOwner = invoice?.userId === user.id;
  const isBusinessViewer = invoice ? !isOwner && (await isOrgAdmin(user.id, invoice.orgId)) : false;
  if (!invoice || (!isOwner && !isBusinessViewer)) return null;

  return { invoice, isOwner, isBusinessViewer };
}
