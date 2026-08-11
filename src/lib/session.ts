import { redirect } from 'next/navigation';
import { auth } from './auth';
import { db } from './db';

/** The signed-in user's session, or null. Read-only — does not redirect. */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** The signed-in user's session, redirecting to /login if there isn't one. */
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * The org a signed-in admin/owner is currently setting up or running. Picks the
 * most recently created ACTIVE membership with admin rights. A user who owns
 * several businesses is out of scope for this app's first version — the model
 * supports it (Membership is many-to-many), but the UI only surfaces one at a time.
 */
export async function getPrimaryAdminOrg(userId: string) {
  const membership = await db.membership.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN', 'COORDINATOR'] } },
    orderBy: { invitedAt: 'desc' },
    include: { org: true },
  });
  return membership?.org ?? null;
}

/**
 * Whether `userId` is an active admin-rights member of `orgId` specifically —
 * not just their "primary" org (see getPrimaryAdminOrg above, which is a UI
 * shortcut for someone who runs one business, not a general authorization
 * check). Use this wherever an action needs to verify access to a particular
 * business, e.g. before letting someone mark one of its invoices paid.
 */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return Boolean(membership && membership.status === 'ACTIVE' && ['OWNER', 'ADMIN', 'COORDINATOR'].includes(membership.role));
}

/** Every business a signed-in worker currently has an active engagement with. */
export async function getWorkerEngagements(userId: string) {
  return db.engagement.findMany({
    where: { userId, active: true },
    include: { org: true, rateCard: { include: { bands: true, rates: true, sleepover: true, travel: true } } },
    orderBy: { startDate: 'desc' },
  });
}

export async function getOnboardingState(userId: string, orgId: string) {
  return db.onboardingState.findUnique({ where: { userId_orgId: { userId, orgId } } });
}

export const ONBOARDING_STEPS = ['business', 'services', 'rates', 'invite'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingComplete(completedSteps: string[]): boolean {
  return ONBOARDING_STEPS.every((step) => completedSteps.includes(step));
}
