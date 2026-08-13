import { redirect } from 'next/navigation';
import { InviteForm } from '@/components/invite-form';
import { db } from '@/lib/db';
import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { FinishButton } from './finish-button';

export default async function InviteStepPage() {
  const { org } = await getOnboardingContext();
  if (!org) redirect('/onboarding/business');

  const rateCards = await db.rateCard.findMany({ where: { orgId: org.id, status: 'ACTIVE' } });
  if (rateCards.length === 0) redirect('/onboarding/rates');

  const team = await db.membership.findMany({
    where: { orgId: org.id, role: 'WORKER' },
    include: { user: true },
    orderBy: { invitedAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invite your subcontractors</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Each worker gets a link to set up their own login and start logging shifts against the
          rate card you choose for them. You can invite more people any time — this doesn&apos;t
          have to happen all at once.
        </p>
      </div>

      <InviteForm rateCards={rateCards.map((c) => ({ id: c.id, name: c.name }))} />

      {team.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-ink">Your team</h2>
          <ul className="divide-y divide-surface-line">
            {team.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{m.user.email}</span>
                <span
                  className={
                    m.status === 'ACTIVE'
                      ? 'rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good'
                      : 'rounded-full bg-warnbg px-2 py-0.5 text-xs font-medium text-warn'
                  }
                >
                  {m.status === 'ACTIVE' ? 'Active' : 'Invited'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FinishButton />
    </div>
  );
}
