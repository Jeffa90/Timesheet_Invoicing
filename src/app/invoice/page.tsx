import { DateTime } from 'luxon';
import Link from 'next/link';
import { OrgSwitcher } from '@/components/org-switcher';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/pricing/money';
import { getWorkerEngagements, requireSessionUser } from '@/lib/session';
import { GenerateForm } from './generate-form';

export default async function InvoicePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await requireSessionUser();
  const { org } = await searchParams;
  const engagements = await getWorkerEngagements(user.id);

  if (engagements.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight">Nothing to invoice yet</h1>
        <p className="mt-3 text-sm text-ink-soft">
          You&apos;ll be able to generate an invoice once you have logged shifts against an active
          engagement.
        </p>
      </div>
    );
  }

  const activeEngagement = engagements.find((e) => e.orgId === org) ?? engagements[0];
  const activeOrgId = activeEngagement.orgId;
  const activeOrgName = activeEngagement.org.name;
  const engagementOptions = engagements.map((e) => ({ orgId: e.orgId, orgName: e.org.name }));

  const [workerProfile, pendingShifts, pastInvoices] = await Promise.all([
    db.workerProfile.findUnique({ where: { userId: user.id } }),
    db.shift.findMany({ where: { orgId: activeOrgId, userId: user.id, status: 'SUBMITTED' } }),
    db.invoice.findMany({ where: { orgId: activeOrgId, userId: user.id }, orderBy: { issueDate: 'desc' } }),
  ]);

  const pendingShiftSummaries = pendingShifts.map((shift) => ({
    date: DateTime.fromJSDate(shift.startUtc).setZone(shift.timezone).toFormat('yyyy-MM-dd'),
    totalCents: shift.totalCents,
  }));

  return (
    <div className="space-y-6">
      <OrgSwitcher engagements={engagementOptions} activeOrgId={activeOrgId} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoicing</h1>
        <p className="mt-1 text-sm text-ink-soft">For {activeOrgName}.</p>
      </div>

      {!workerProfile ? (
        <p className="card text-sm text-ink-soft">
          Add your invoice details first —{' '}
          <Link href="/profile" className="font-medium text-brand-600">
            set up your profile
          </Link>
          .
        </p>
      ) : pendingShifts.length > 0 ? (
        <GenerateForm orgId={activeOrgId} orgName={activeOrgName} pendingShifts={pendingShiftSummaries} />
      ) : (
        <p className="card text-sm text-ink-soft">
          No logged shifts are waiting to be invoiced.{' '}
          <Link href="/" className="font-medium text-brand-600">
            Log one
          </Link>
          .
        </p>
      )}

      {pastInvoices.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold text-ink">Past invoices</h2>
          <ul className="divide-y divide-surface-line">
            {pastInvoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between py-2.5 text-sm">
                <Link href={`/invoice/${invoice.id}`} className="font-medium text-brand-600">
                  {invoice.number}
                </Link>
                <span className="text-ink-soft">{formatCents(invoice.totalCents)}</span>
                <span
                  className={
                    invoice.status === 'PAID'
                      ? 'rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good'
                      : invoice.status === 'SENT'
                        ? 'rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700'
                        : 'rounded-full bg-surface-line px-2 py-0.5 text-xs font-medium text-ink-soft'
                  }
                >
                  {invoice.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
