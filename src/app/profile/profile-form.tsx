'use client';

import { useActionState } from 'react';
import { saveWorkerProfileAction } from '@/lib/actions/worker-profile';

interface Defaults {
  businessName: string;
  abn: string;
  acn: string;
  gstRegistered: boolean;
  hasHecsDebt: boolean;
  phone: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  bankBsb: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export function ProfileForm({ states, defaults: d }: { states: readonly string[]; defaults: Defaults }) {
  const [state, formAction, pending] = useActionState(saveWorkerProfileAction, {});

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label className="label" htmlFor="businessName">
          Your business name (if you have one)
        </label>
        <input id="businessName" name="businessName" defaultValue={d.businessName} className="field" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="abn">
            ABN
          </label>
          <input id="abn" name="abn" defaultValue={d.abn} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="acn">
            ACN (if incorporated)
          </label>
          <input id="acn" name="acn" defaultValue={d.acn} className="field" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="gstRegistered" defaultChecked={d.gstRegistered} />
        GST registered
      </label>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="hasHecsDebt" defaultChecked={d.hasHecsDebt} />
        HECS/HELP debt
      </label>

      <div>
        <label className="label" htmlFor="phone">
          Phone
        </label>
        <input id="phone" name="phone" type="tel" defaultValue={d.phone} className="field" />
      </div>

      <div>
        <label className="label" htmlFor="addressLine1">
          Address
        </label>
        <input id="addressLine1" name="addressLine1" defaultValue={d.addressLine1} className="field" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="label" htmlFor="suburb">
            Suburb
          </label>
          <input id="suburb" name="suburb" defaultValue={d.suburb} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="state">
            State
          </label>
          <select id="state" name="state" defaultValue={d.state} className="field">
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="postcode">
            Postcode
          </label>
          <input id="postcode" name="postcode" defaultValue={d.postcode} className="field" />
        </div>
      </div>

      <fieldset className="rounded-lg border border-surface-line p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Bank details
        </legend>
        <p className="mb-2 px-1 text-xs text-ink-faint">Shown on your invoices so businesses know where to pay you.</p>
        <div className="grid grid-cols-3 gap-3">
          <input name="bankBsb" placeholder="BSB" defaultValue={d.bankBsb} className="field" />
          <input
            name="bankAccountNumber"
            placeholder="Account number"
            defaultValue={d.bankAccountNumber}
            className="field"
          />
          <input name="bankAccountName" placeholder="Account name" defaultValue={d.bankAccountName} className="field" />
        </div>
      </fieldset>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">
          Saved.
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
