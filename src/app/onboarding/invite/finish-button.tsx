import { finishInviteStepAction } from '@/lib/actions/invites';

export function FinishButton() {
  return (
    <form action={finishInviteStepAction}>
      <button type="submit" className="btn-primary w-full">
        Finish setup
      </button>
      <p className="mt-2 text-center text-xs text-ink-faint">
        You can invite more workers, add services, or adjust rates from settings at any time.
      </p>
    </form>
  );
}
