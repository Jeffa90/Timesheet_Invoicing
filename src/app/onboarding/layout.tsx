import { ONBOARDING_STEPS } from '@/lib/session';
import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { OnboardingProgress } from './progress';

const STEP_LABELS: Record<(typeof ONBOARDING_STEPS)[number], string> = {
  business: 'Business details',
  services: 'Services',
  rates: 'Rate card',
  invite: 'Invite workers',
};

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { completedSteps } = await getOnboardingContext();

  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingProgress steps={ONBOARDING_STEPS.map((s) => ({ key: s, label: STEP_LABELS[s] }))} completed={completedSteps} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
