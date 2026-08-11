import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { toRateCardSnapshot } from '@/lib/rate-card-mapper';
import { getOnboardingState, getPrimaryAdminOrg, getWorkerEngagements, isOnboardingComplete, requireSessionUser } from '@/lib/session';
import { ShiftLogger } from './shift-logger';

export default async function LogShiftPage() {
  const user = await requireSessionUser();

  const adminOrg = await getPrimaryAdminOrg(user.id);
  if (adminOrg) {
    const onboarding = await getOnboardingState(user.id, adminOrg.id);
    if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');
  }

  const engagements = await getWorkerEngagements(user.id);

  if (engagements.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight">No active shifts to log yet</h1>
        {adminOrg ? (
          <div className="mt-3 space-y-3 text-sm text-ink-soft">
            <p>
              {adminOrg.name} is set up. Invite yourself or a subcontractor as a worker to start
              logging shifts against your rates.
            </p>
            <Link href="/onboarding/invite" className="btn-primary inline-flex">
              Invite a worker
            </Link>
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-ink-soft">
            <p>
              You&apos;re not currently engaged by a business on this app. Ask them for an invite
              link, or set up your own business if that&apos;s why you&apos;re here.
            </p>
            <Link href="/onboarding/business" className="btn-primary inline-flex">
              Set up a business
            </Link>
          </div>
        )}
      </div>
    );
  }

  const activeEngagement = engagements[0];
  const [workerProfile, serviceTypes, allServiceTypes, holidays] = await Promise.all([
    db.workerProfile.findUnique({ where: { userId: user.id } }),
    db.serviceType.findMany({ where: { orgId: activeEngagement.orgId, active: true }, orderBy: { name: 'asc' } }),
    db.serviceType.findMany({ where: { orgId: activeEngagement.orgId } }),
    db.publicHoliday.findMany({ where: { state: activeEngagement.org.state ?? undefined } }),
  ]);

  if (!workerProfile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight">Set up your profile first</h1>
        <p className="mt-3 text-sm text-ink-soft">
          We need your invoicing details — including whether you&apos;re registered for GST — before
          any shift can be priced correctly.
        </p>
        <Link href="/profile" className="btn-primary mt-4 inline-flex">
          Set up your profile
        </Link>
      </div>
    );
  }

  const serviceTypeGst = Object.fromEntries(allServiceTypes.map((s) => [s.id, s.gstApplicable]));

  return (
    <ShiftLogger
      engagements={engagements.map((e) => ({ orgId: e.orgId, orgName: e.org.name, timezone: e.org.timezone }))}
      activeOrgId={activeEngagement.orgId}
      timezone={activeEngagement.org.timezone}
      serviceTypes={serviceTypes.map((s) => ({ id: s.id, name: s.name, flatRate: s.flatRate }))}
      rateCard={toRateCardSnapshot(activeEngagement.rateCard, serviceTypeGst)}
      holidays={holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name }))}
      gstRegistered={workerProfile.gstRegistered}
    />
  );
}
