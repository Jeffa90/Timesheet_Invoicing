'use client';

import { useTransition } from 'react';
import { deleteShiftAction } from '@/lib/actions/shifts';

export function DeleteShiftButton({ shiftId }: { shiftId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="text-sm font-medium text-warn"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('Delete this shift? This can\'t be undone.')) return;
        startTransition(() => deleteShiftAction(shiftId));
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
