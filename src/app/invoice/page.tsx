import Link from 'next/link';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/pricing/money';
import { getWorkerEngagements, requireSessionUser } from '@/lib/session';
import { GenerateForm } from './generate-form';
import { ProfileForm } from './profile-form';

export default async function InvoicePage() {
  const user = await requireSessionUser();
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

  const activeOrgId = engagements[0].orgId;
  const activeOrgName = engagements[0].org.name;

  const [workerProfile, pendingShifts, pastInvoices] = await Promise.all([
    db.workerProfile.findUnique({ where: { userId: user.id } }),
    db.shift.findMany({ where: { orgId: activeOrgId, userId: user.id, status: 'SUBMITTED' } }),
    db.invoice.findMany({ where: { orgId: activeOrgId, userId: user.id }, orderBy: { issueDate: 'desc' } }),
  ]);

  const totalCents = pendingShifts.reduce((sum, s) => sum + s.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoicing</h1>
        <p className="mt-1 text-sm text-ink-soft">For {activeOrgName}.</p>
      </div>

      {!workerProfile ? (
        <ProfileForm />
      ) : pendingShifts.length > 0 ? (
        <GenerateForm orgId={activeOrgId} orgName={activeOrgName} shiftCount={pendingShifts.length} totalCents={totalCents} />
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
