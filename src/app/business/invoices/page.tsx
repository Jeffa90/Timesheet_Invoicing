import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/pricing/money';
import { formatInvoiceDate } from '@/lib/invoice';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';

const STATUS_LABEL: Record<string, string> = { SENT: 'Pending payment', PAID: 'Paid' };
const STATUS_CLASS: Record<string, string> = {
  SENT: 'bg-warnbg text-warn',
  PAID: 'bg-good/10 text-good',
};

export default async function BusinessInvoicesPage() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  // A worker's invoice isn't visible to the business until they've sent it —
  // DRAFT is invisible here by design, same as it always has been.
  const invoices = await db.invoice.findMany({
    where: { orgId: org.id, status: { in: ['SENT', 'PAID'] } },
    include: { user: true },
    orderBy: { issueDate: 'desc' },
  });

  const pendingTotal = invoices.filter((i) => i.status === 'SENT').reduce((sum, i) => sum + i.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every invoice your subcontractors have sent to {org.name}.
        </p>
      </div>

      {invoices.length === 0 ? (
        <p className="card text-sm text-ink-soft">No invoices have been sent to you yet.</p>
      ) : (
        <>
          {pendingTotal > 0 && (
            <p className="card text-sm text-ink-soft">
              <span className="font-semibold text-ink">{formatCents(pendingTotal)}</span> pending payment across{' '}
              {invoices.filter((i) => i.status === 'SENT').length} invoice
              {invoices.filter((i) => i.status === 'SENT').length === 1 ? '' : 's'}.
            </p>
          )}

          <section className="card overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-line text-xs uppercase tracking-wide text-ink-faint">
                  <th className="pb-2 font-semibold">Invoice</th>
                  <th className="pb-2 font-semibold">From</th>
                  <th className="pb-2 font-semibold">Issued</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                  <th className="pb-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-surface-line/60">
                    <td className="py-2.5">
                      <Link href={`/invoice/${invoice.id}`} className="font-medium text-brand-600">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="py-2.5 text-ink-soft">{invoice.user.name}</td>
                    <td className="py-2.5 text-ink-soft">
                      {formatInvoiceDate(invoice.issueDate.toISOString().slice(0, 10), org.timezone)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-ink">
                      {formatCents(invoice.totalCents)}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[invoice.status] ?? 'bg-surface-line text-ink-soft'}`}
                      >
                        {STATUS_LABEL[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
