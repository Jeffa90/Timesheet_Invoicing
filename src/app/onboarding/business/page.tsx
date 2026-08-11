import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { AU_STATES } from '@/lib/pricing/defaults';
import { BusinessForm } from './form';

export default async function BusinessStepPage() {
  const { org } = await getOnboardingContext();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tell us about your business</h1>
        <p className="mt-1 text-sm text-ink-soft">
          This appears on every invoice your subcontractors send you, and your state sets the
          public holiday calendar and default timezone used for shift pricing.
        </p>
      </div>

      <BusinessForm
        states={AU_STATES}
        defaults={
          org
            ? {
                name: org.name,
                legalName: org.legalName ?? '',
                abn: org.abn ?? '',
                gstRegistered: org.gstRegistered,
                addressLine1: org.addressLine1 ?? '',
                suburb: org.suburb ?? '',
                state: org.state ?? 'NSW',
                postcode: org.postcode ?? '',
                invoiceTermsDays: org.invoiceTermsDays,
              }
            : null
        }
      />
    </div>
  );
}
