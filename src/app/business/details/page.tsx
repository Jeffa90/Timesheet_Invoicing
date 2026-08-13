import { redirect } from 'next/navigation';
import { BusinessForm } from '@/components/business-form';
import { AU_STATES } from '@/lib/pricing/defaults';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';

export default async function BusinessDetailsPage() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const onboarding = await getOnboardingState(user.id, org.id);
  if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business details</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What appears on every invoice your workers send you. Update this any time — it doesn&apos;t
          change invoices already issued, since each one keeps the details it had on the day it was
          generated.
        </p>
      </div>

      <BusinessForm
        mode="manage"
        submitLabel="Save details"
        states={AU_STATES}
        defaults={{
          name: org.name,
          legalName: org.legalName ?? '',
          abn: org.abn ?? '',
          gstRegistered: org.gstRegistered,
          addressLine1: org.addressLine1 ?? '',
          suburb: org.suburb ?? '',
          state: org.state ?? 'NSW',
          postcode: org.postcode ?? '',
          email: org.email ?? '',
          phone: org.phone ?? '',
          invoiceTermsDays: org.invoiceTermsDays,
        }}
      />
    </div>
  );
}
