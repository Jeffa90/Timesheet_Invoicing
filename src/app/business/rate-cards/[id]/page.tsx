import { notFound, redirect } from 'next/navigation';
import { RateCardForm } from '@/components/rate-card-form';
import { db } from '@/lib/db';
import { buildRateCardFormProps } from '@/lib/rate-card-form-defaults';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';
import { DeleteRateCardButton } from './delete-rate-card-button';

export default async function EditRateCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ daily?: string }>;
}) {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  const { id } = await params;
  const [serviceTypes, existingCard] = await Promise.all([
    db.serviceType.findMany({ where: { orgId: org.id, active: true }, orderBy: { name: 'asc' } }),
    db.rateCard.findFirst({ where: { id, orgId: org.id }, include: { rates: true, sleepover: true, travel: true } }),
  ]);
  if (!existingCard) notFound();

  const { daily } = await searchParams;
  const dailyRatesOnly = daily === 'true' ? true : daily === 'false' ? false : existingCard.dailyRatesOnly;

  const { rateLines, defaults } = buildRateCardFormProps({
    defaultName: existingCard.name,
    serviceTypes,
    existingCard,
    dailyRatesOnly,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{existingCard.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">Changes apply to shifts logged from now on — already-priced shifts keep their original rate.</p>
      </div>

      <RateCardForm
        key={dailyRatesOnly ? 'daily' : 'banded'}
        rateLines={rateLines}
        defaults={defaults}
        mode="edit"
        rateCardId={existingCard.id}
        basePath={`/business/rate-cards/${existingCard.id}`}
        submitLabel="Save changes"
      />

      <div className="card">
        <DeleteRateCardButton rateCardId={existingCard.id} />
      </div>
    </div>
  );
}
