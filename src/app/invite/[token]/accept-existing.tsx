'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { acceptInviteExistingAction } from '@/lib/actions/invites';

export function AcceptExisting({
  token,
  invitedEmail,
  sessionEmail,
}: {
  token: string;
  invitedEmail: string;
  sessionEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    async () => acceptInviteExistingAction(token),
    {} as { error?: string },
  );

  if (sessionEmail && sessionEmail.toLowerCase() === invitedEmail.toLowerCase()) {
    return (
      <form action={formAction} className="space-y-3">
        <p className="text-sm text-ink-soft">
          Logged in as <span className="font-medium text-ink">{sessionEmail}</span>.
        </p>
        {state.error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {state.error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Accepting…' : 'Accept invite'}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3 text-sm text-ink-soft">
      <p>
        This invite was sent to <span className="font-medium text-ink">{invitedEmail}</span>. Log in as that
        user to accept it.
      </p>
      <Link href={`/login?redirectTo=/invite/${token}`} className="btn-primary block text-center">
        Log in
      </Link>
    </div>
  );
}
