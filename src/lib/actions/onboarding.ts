import { db } from '@/lib/db';
import type { OnboardingStep } from '@/lib/session';

/** Records a step as done without duplicating it if the step is revisited and re-saved. */
export async function markOnboardingStepComplete(userId: string, orgId: string, step: OnboardingStep) {
  const existing = await db.onboardingState.findUnique({ where: { userId_orgId: { userId, orgId } } });
  const completedSteps = Array.from(new Set([...(existing?.completedSteps ?? []), step]));

  return db.onboardingState.upsert({
    where: { userId_orgId: { userId, orgId } },
    update: { completedSteps },
    create: { userId, orgId, completedSteps },
  });
}
