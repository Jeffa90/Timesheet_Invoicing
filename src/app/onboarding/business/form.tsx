'use client';

import { useActionState } from 'react';
import { saveOrganisationAction } from '@/lib/actions/organisation';

interface Defaults {
  name: string;
  legalName: string;
  abn: string;
  gstRegistered: boolean;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  invoiceTermsDays: number;
}

export function BusinessForm({ states, defaults }: { states: readonly string[]; defaults: Defaults | null }) {
  const [state, formAction, pending] = useActionState(saveOrganisationAction, {});
  const d = defaults ?? {
    name: '',
    legalName: '',
    abn: '',
    gstRegistered: false,
    addressLine1: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    invoiceTermsDays: 14,
  };

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label className="label" htmlFor="name">
          Business name
        </label>
        <input id="name" name="name" required defaultValue={d.name} className="field" />
      </div>

      <div>
        <label className="label" htmlFor="legalName">
          Legal / registered name (if different)
        </label>
        <input id="legalName" name="legalName" defaultValue={d.legalName} className="field" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="abn">
            ABN
          </label>
          <input id="abn" name="abn" required defaultValue={d.abn} className="field" />
        </div>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="gstRegistered" defaultChecked={d.gstRegistered} />
            GST registered
          </label>
        </div>
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

      <div>
        <label className="label" htmlFor="invoiceTermsDays">
          Default invoice payment terms (days)
        </label>
        <input
          id="invoiceTermsDays"
          name="invoiceTermsDays"
          type="number"
          min={0}
          max={90}
          defaultValue={d.invoiceTermsDays}
          className="field max-w-[8rem]"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
