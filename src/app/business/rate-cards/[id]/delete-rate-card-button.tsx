'use client';

import { useActionState } from 'react';
import { deleteRateCardAction } from '@/lib/actions/rate-card';

export function DeleteRateCardButton({ rateCardId }: { rateCardId: string }) {
  const [state, formAction, pending] = useActionState(deleteRateCardAction.bind(null, rateCardId), {});

  return (
    <form
      action={(formData) => {
        if (!window.confirm('Delete this rate card? This can\'t be undone.')) return;
        formAction(formData);
      }}
      className="space-y-2"
    >
      <button type="submit" className="text-sm font-medium text-warn underline" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete rate card'}
      </button>
      {state.error && (
        <p className="text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
