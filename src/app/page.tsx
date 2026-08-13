import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OrgSwitcher } from '@/components/org-switcher';
import { loadShiftLoggerProps } from '@/lib/shift-logger-context';
import { getOnboardingState, getPrimaryAdminOrg, isOnboardingComplete, requireSessionUser } from '@/lib/session';
import { ShiftLogger } from './shift-logger';

export default async function LogShiftPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await requireSessionUser();
  const { org } = await searchParams;

  const adminOrg = await getPrimaryAdminOrg(user.id);
  if (adminOrg) {
    const onboarding = await getOnboardingState(user.id, adminOrg.id);
    if (!isOnboardingComplete(onboarding?.completedSteps ?? [])) redirect('/onboarding');
  }

  const context = await loadShiftLoggerProps(user.id, org);

  if (context.kind === 'no-engagements') {
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

  if (context.kind === 'no-profile') {
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

  return (
    <div className="space-y-4">
      <OrgSwitcher engagements={context.props.engagements} activeOrgId={context.props.activeOrgId} />
      <ShiftLogger {...context.props} />
    </div>
  );
}
