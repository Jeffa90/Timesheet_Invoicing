import { redirect } from 'next/navigation';
import { RateCardForm } from '@/components/rate-card-form';
import { db } from '@/lib/db';
import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { buildRateCardFormProps } from '@/lib/rate-card-form-defaults';

export default async function RatesStepPage({ searchParams }: { searchParams: Promise<{ daily?: string }> }) {
  const { org } = await getOnboardingContext();
  if (!org) redirect('/onboarding/business');

  const serviceTypes = await db.serviceType.findMany({ where: { orgId: org.id, active: true }, orderBy: { name: 'asc' } });
  if (serviceTypes.length === 0) redirect('/onboarding/services');

  const existingCard = await db.rateCard.findFirst({
    where: { orgId: org.id, status: 'ACTIVE' },
    include: { rates: true, sleepover: true, travel: true },
  });

  // The ?daily= query param lets the "daily rates" checkbox force a fresh
  // server render (and therefore fresh dimensions) before anything is saved —
  // the form's own client state only reads its initial props once, so a
  // purely client-side toggle would never reshape the visible rows.
  const { daily } = await searchParams;
  const dailyRatesOnly = daily === 'true' ? true : daily === 'false' ? false : (existingCard?.dailyRatesOnly ?? false);

  const { rateLines, defaults } = buildRateCardFormProps({
    defaultName: `${org.name} — subcontractor rates`,
    serviceTypes,
    existingCard,
    dailyRatesOnly,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set your rates</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What you pay your subcontractors for each support, time of day and day type. Rates set
          as a percentage follow the NDIS price limit automatically; flat rates stay fixed until
          you change them here.
        </p>
      </div>

      <RateCardForm key={dailyRatesOnly ? 'daily' : 'banded'} rateLines={rateLines} defaults={defaults} />
    </div>
  );
}
