import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { ServicesForm } from './form';

export default async function ServicesStepPage() {
  const { org } = await getOnboardingContext();
  if (!org) redirect('/onboarding/business');

  const serviceTypes = await db.serviceType.findMany({
    where: { orgId: org.id, active: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">What supports do your workers deliver?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Add each NDIS support you bill for. The NDIS line item code is optional but makes
          invoices easier to reconcile against your own NDIS claims.
        </p>
      </div>

      <ServicesForm
        initial={
          serviceTypes.length > 0
            ? serviceTypes.map((s) => ({
                id: s.id,
                name: s.name,
                ndisLineItemCode: s.ndisLineItemCode ?? '',
                gstApplicable: s.gstApplicable,
                flatRate: s.flatRate,
              }))
            : [
                {
                  name: 'Assistance With Self-Care Activities - Standard',
                  ndisLineItemCode: '01_011_0107_1_1',
                  gstApplicable: false,
                  flatRate: false,
                },
              ]
        }
      />
    </div>
  );
}
