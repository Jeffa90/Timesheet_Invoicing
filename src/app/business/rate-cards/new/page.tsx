import { redirect } from 'next/navigation';
import { RateCardForm } from '@/components/rate-card-form';
import { db } from '@/lib/db';
import { buildRateCardFormProps } from '@/lib/rate-card-form-defaults';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';

export default async function NewRateCardPage({ searchParams }: { searchParams: Promise<{ daily?: string }> }) {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  const serviceTypes = await db.serviceType.findMany({ where: { orgId: org.id, active: true }, orderBy: { name: 'asc' } });
  if (serviceTypes.length === 0) redirect('/onboarding/services');

  const { daily } = await searchParams;
  const dailyRatesOnly = daily === 'true';

  const { rateLines, defaults } = buildRateCardFormProps({
    defaultName: 'New rate card',
    serviceTypes,
    existingCard: null,
    dailyRatesOnly,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add a rate card</h1>
        <p className="mt-1 text-sm text-ink-soft">
          A new class of pay you can assign to any worker on your team — e.g. a higher rate card
          for a senior support worker.
        </p>
      </div>

      <RateCardForm
        key={dailyRatesOnly ? 'daily' : 'banded'}
        rateLines={rateLines}
        defaults={defaults}
        mode="create"
        basePath="/business/rate-cards/new"
        submitLabel="Create rate card"
      />
    </div>
  );
}
