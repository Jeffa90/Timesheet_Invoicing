'use client';

import { useActionState } from 'react';
import { acceptInviteClaimAction } from '@/lib/actions/invites';

export function ClaimAccountForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteClaimAction.bind(null, token), {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <span className="label">Email</span>
        <p className="text-ink">{email}</p>
      </div>
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Choose a password
        </label>
        <input id="password" name="password" type="password" minLength={8} required className="field" />
        <p className="mt-1 text-xs text-ink-faint">At least 8 characters.</p>
      </div>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Setting up…' : 'Accept invite'}
      </button>
    </form>
  );
}
