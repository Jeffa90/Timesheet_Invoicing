import { redirect } from 'next/navigation';
import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { ONBOARDING_STEPS, isOnboardingComplete } from '@/lib/session';

export default async function OnboardingIndexPage() {
  const { org, completedSteps } = await getOnboardingContext();

  if (!org) redirect('/onboarding/business');
  if (isOnboardingComplete(completedSteps)) redirect('/');

  const nextStep = ONBOARDING_STEPS.find((step) => !completedSteps.includes(step)) ?? 'business';
  switch (nextStep) {
    case 'services':
      redirect('/onboarding/services');
    case 'rates':
      redirect('/onboarding/rates');
    case 'invite':
      redirect('/onboarding/invite');
    default:
      redirect('/onboarding/business');
  }
}
