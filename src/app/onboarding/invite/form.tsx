'use client';

import { useActionState, useState } from 'react';
import { inviteWorkerAction } from '@/lib/actions/invites';

export function InviteForm({ rateCards }: { rateCards: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(inviteWorkerAction, {});
  const [copied, setCopied] = useState(false);

  const fullUrl = state.inviteUrl && typeof window !== 'undefined' ? `${window.location.origin}${state.inviteUrl}` : state.inviteUrl;

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-ink">Send an invite</h2>
      <form action={formAction} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="inviteName">
              Name (optional)
            </label>
            <input id="inviteName" name="name" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="inviteEmail">
              Email
            </label>
            <input id="inviteEmail" name="email" type="email" required className="field" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="rateCardId">
            Rate card
          </label>
          <select id="rateCardId" name="rateCardId" required className="field" defaultValue={rateCards[0]?.id}>
            {rateCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </div>

        {state.error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sending…' : 'Create invite'}
        </button>
      </form>

      {fullUrl && (
        <div className="rounded-lg bg-surface-sunk p-3">
          <p className="text-sm text-ink-soft">
            Invite ready for <span className="font-medium text-ink">{state.invitedEmail}</span>. Email isn&apos;t
            wired up yet, so share this link with them directly:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly className="field flex-1 text-sm" value={fullUrl} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn-ghost shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
