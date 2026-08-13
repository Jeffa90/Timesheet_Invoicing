import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';

export default async function RateCardsPage() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  const rateCards = await db.rateCard.findMany({
    where: { orgId: org.id, status: 'ACTIVE' },
    include: { _count: { select: { engagements: { where: { active: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rate cards</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Different pay for different classes of worker — e.g. a higher rate card for senior
            support workers. Each worker on your team is assigned to exactly one.
          </p>
        </div>
        <Link href="/business/rate-cards/new" className="btn-primary shrink-0">
          Add a rate card
        </Link>
      </div>

      <section className="card divide-y divide-surface-line">
        {rateCards.map((card) => (
          <div key={card.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <Link href={`/business/rate-cards/${card.id}`} className="font-medium text-brand-600">
                {card.name}
              </Link>
              <p className="text-sm text-ink-soft">
                {card._count.engagements} worker{card._count.engagements === 1 ? '' : 's'} assigned
                {card.dailyRatesOnly && ' · daily rates'}
              </p>
            </div>
            <Link href={`/business/rate-cards/${card.id}`} className="btn-ghost shrink-0">
              Edit
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
