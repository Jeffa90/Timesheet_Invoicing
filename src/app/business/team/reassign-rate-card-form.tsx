'use client';

import { useActionState } from 'react';
import { reassignEngagementRateCardAction } from '@/lib/actions/invites';

export function ReassignRateCardForm({
  engagementId,
  currentRateCardId,
  rateCards,
}: {
  engagementId: string;
  currentRateCardId: string;
  rateCards: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(reassignEngagementRateCardAction.bind(null, engagementId), {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select name="rateCardId" defaultValue={currentRateCardId} className="field !min-h-0 py-1.5 text-sm">
        {rateCards.map((card) => (
          <option key={card.id} value={card.id}>
            {card.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-ghost shrink-0" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.error && (
        <p className="text-xs text-warn" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
