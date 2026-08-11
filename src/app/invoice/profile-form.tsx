'use client';

import { useActionState } from 'react';
import { saveWorkerProfileAction } from '@/lib/actions/worker-profile';

export function ProfileForm() {
  const [state, formAction, pending] = useActionState(saveWorkerProfileAction, {});

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold text-ink">Set up your invoice details</h2>
        <p className="mt-1 text-sm text-ink-soft">
          These appear on every invoice you send. You can leave the ABN and bank details blank
          for now and add them later.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <div>
          <label className="label" htmlFor="businessName">
            Your business name (if you have one)
          </label>
          <input id="businessName" name="businessName" className="field" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="abn">
              ABN
            </label>
            <input id="abn" name="abn" className="field" />
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" name="gstRegistered" />
              GST registered
            </label>
          </div>
        </div>

        <fieldset className="rounded-lg border border-surface-line p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Bank details (optional)
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <input name="bankBsb" placeholder="BSB" className="field" />
            <input name="bankAccountNumber" placeholder="Account number" className="field" />
            <input name="bankAccountName" placeholder="Account name" className="field" />
          </div>
        </fieldset>

        {state.error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </section>
  );
}
