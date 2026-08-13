import { getOnboardingState, getPrimaryAdminOrg, requireSessionUser } from '@/lib/session';

/** Shared server-side lookup used by every onboarding page and the wizard shell. */
export async function getOnboardingContext() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  const onboarding = org ? await getOnboardingState(user.id, org.id) : null;

  return {
    user,
    org,
    completedSteps: onboarding?.completedSteps ?? [],
  };
}
