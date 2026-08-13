import { redirect } from 'next/navigation';
import { InviteForm } from '@/components/invite-form';
import { db } from '@/lib/db';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';
import { ReassignRateCardForm } from './reassign-rate-card-form';

export default async function TeamPage() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  const [rateCards, team, engagements] = await Promise.all([
    db.rateCard.findMany({ where: { orgId: org.id, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
    db.membership.findMany({ where: { orgId: org.id, role: 'WORKER' }, include: { user: true }, orderBy: { invitedAt: 'desc' } }),
    db.engagement.findMany({ where: { orgId: org.id } }),
  ]);

  const engagementByUserId = new Map(engagements.map((e) => [e.userId, e]));
  const rateCardOptions = rateCards.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Your subcontractors and which rate card each one is billed against. Reassigning someone
          only affects shifts they log from now on.
        </p>
      </div>

      {rateCards.length === 0 ? (
        <p className="card text-sm text-ink-soft">Set up a rate card before inviting your team.</p>
      ) : (
        <InviteForm rateCards={rateCardOptions} />
      )}

      {team.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-ink">Your team</h2>
          <ul className="divide-y divide-surface-line">
            {team.map((m) => {
              const engagement = engagementByUserId.get(m.userId);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    {m.user.name && m.user.name !== m.user.email && <p className="font-medium text-ink">{m.user.name}</p>}
                    <p className={m.user.name && m.user.name !== m.user.email ? 'text-ink-soft' : 'font-medium text-ink'}>
                      {m.user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        m.status === 'ACTIVE'
                          ? 'rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good'
                          : 'rounded-full bg-warnbg px-2 py-0.5 text-xs font-medium text-warn'
                      }
                    >
                      {m.status === 'ACTIVE' ? 'Active' : 'Invited'}
                    </span>
                    {engagement && (
                      <ReassignRateCardForm
                        key={engagement.rateCardId}
                        engagementId={engagement.id}
                        currentRateCardId={engagement.rateCardId}
                        rateCards={rateCardOptions}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
