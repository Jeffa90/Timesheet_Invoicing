import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { toRateCardSnapshot } from '@/lib/rate-card-mapper';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';
import { RatesView } from './rates-view';

export default async function RatesPage() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  const [rateCard, serviceTypes, holidays] = await Promise.all([
    db.rateCard.findFirst({
      where: { orgId: org.id, status: 'ACTIVE' },
      include: { bands: true, rates: true, sleepover: true, travel: true },
    }),
    db.serviceType.findMany({ where: { orgId: org.id, active: true }, orderBy: { name: 'asc' } }),
    db.publicHoliday.findMany({ where: { state: org.state ?? undefined } }),
  ]);

  if (!rateCard) redirect('/onboarding/rates');

  const serviceTypeGst = Object.fromEntries(serviceTypes.map((s) => [s.id, s.gstApplicable]));

  return (
    <RatesView
      orgName={org.name}
      timezone={org.timezone}
      rateCard={toRateCardSnapshot(rateCard, serviceTypeGst)}
      serviceTypes={serviceTypes.map((s) => ({ id: s.id, name: s.name }))}
      holidays={holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name }))}
    />
  );
}
