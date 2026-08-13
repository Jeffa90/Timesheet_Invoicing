import { db } from '@/lib/db';
import { AU_STATES } from '@/lib/pricing/defaults';
import { getWorkerEngagements, requireSessionUser } from '@/lib/session';
import { EmployerDetailsCard } from './employer-details-card';
import { ProfileForm } from './profile-form';
import { TaxEstimateCard } from './tax-estimate-card';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const user = await requireSessionUser();
  const { fy } = await searchParams;
  const [profile, engagements] = await Promise.all([
    db.workerProfile.findUnique({ where: { userId: user.id } }),
    getWorkerEngagements(user.id),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your invoice details</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What appears on every invoice you send, wherever you subcontract. Update this any
          time — it doesn&apos;t change invoices you&apos;ve already issued.
        </p>
      </div>

      <ProfileForm
        states={AU_STATES}
        defaults={{
          businessName: profile?.businessName ?? '',
          abn: profile?.abn ?? '',
          acn: profile?.acn ?? '',
          gstRegistered: profile?.gstRegistered ?? false,
          hasHecsDebt: profile?.hasHecsDebt ?? false,
          phone: profile?.phone ?? '',
          addressLine1: profile?.addressLine1 ?? '',
          suburb: profile?.suburb ?? '',
          state: profile?.state ?? 'NSW',
          postcode: profile?.postcode ?? '',
          bankBsb: profile?.bankBsb ?? '',
          bankAccountNumber: profile?.bankAccountNumber ?? '',
          bankAccountName: profile?.bankAccountName ?? '',
        }}
      />

      {profile && (
        <TaxEstimateCard
          userId={user.id}
          gstRegistered={profile.gstRegistered}
          hasHecsDebt={profile.hasHecsDebt}
          state={profile.state}
          viewingPrevious={fy === 'previous'}
        />
      )}

      {engagements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {engagements.length === 1 ? 'The business you invoice' : 'The businesses you invoice'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            What each business currently has on file — this is what a new invoice to them would use
            today. If this looks wrong, ask them to update it on their end; you can&apos;t edit it
            here. Note it won&apos;t match an invoice you&apos;ve already generated if they changed
            something afterward — each invoice keeps whatever was true on the day it was issued.
          </p>
          <div className="mt-3 space-y-3">
            {engagements.map((e) => (
              <EmployerDetailsCard key={e.id} org={e.org} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
