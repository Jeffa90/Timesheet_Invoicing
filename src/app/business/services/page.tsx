import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ServicesForm } from '@/components/services-form';
import { db } from '@/lib/db';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';

export default async function BusinessServicesPage() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  const serviceTypes = await db.serviceType.findMany({
    where: { orgId: org.id, active: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The supports your workers can log shifts against — including flat-rate ones like admin
          hours, which get their own single $/h rate with no day/night variation. After adding a
          new one here, set its rate on each of your{' '}
          <Link href="/business/rate-cards" className="font-medium text-brand-600">
            rate cards
          </Link>
          .
        </p>
      </div>

      <ServicesForm
        mode="manage"
        submitLabel="Save services"
        initial={serviceTypes.map((s) => ({
          id: s.id,
          name: s.name,
          ndisLineItemCode: s.ndisLineItemCode ?? '',
          gstApplicable: s.gstApplicable,
          flatRate: s.flatRate,
        }))}
      />
    </div>
  );
}
