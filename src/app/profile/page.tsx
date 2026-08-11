import { db } from '@/lib/db';
import { AU_STATES } from '@/lib/pricing/defaults';
import { requireSessionUser } from '@/lib/session';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const user = await requireSessionUser();
  const profile = await db.workerProfile.findUnique({ where: { userId: user.id } });

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
    </div>
  );
}
