'use client';

import { useActionState, useId, useState } from 'react';
import { saveServiceTypesAction } from '@/lib/actions/service-types';

interface Row {
  id?: string;
  name: string;
  ndisLineItemCode: string;
  gstApplicable: boolean;
}

export function ServicesForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [state, formAction, pending] = useActionState(saveServiceTypesAction, {});
  const baseId = useId();

  const update = (index: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form action={formAction} className="card space-y-4">
      <input type="hidden" name="serviceTypes" value={JSON.stringify(rows)} readOnly />

      <div className="space-y-3">
        {rows.map((row, index) => (
          <fieldset key={index} className="rounded-lg border border-surface-line p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Support {index + 1}
            </legend>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor={`${baseId}-name-${index}`}>
                  Name
                </label>
                <input
                  id={`${baseId}-name-${index}`}
                  className="field"
                  value={row.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="label" htmlFor={`${baseId}-code-${index}`}>
                    NDIS line item code (optional)
                  </label>
                  <input
                    id={`${baseId}-code-${index}`}
                    className="field"
                    value={row.ndisLineItemCode}
                    onChange={(e) => update(index, { ndisLineItemCode: e.target.value })}
                  />
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={row.gstApplicable}
                      onChange={(e) => update(index, { gstApplicable: e.target.checked })}
                    />
                    GST applies
                  </label>
                </div>
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="text-sm font-medium text-warn"
                  onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              )}
            </div>
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => setRows((r) => [...r, { name: '', ndisLineItemCode: '', gstApplicable: false }])}
      >
        + Add another support
      </button>

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
