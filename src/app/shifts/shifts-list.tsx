'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { generateInvoiceAction } from '@/lib/actions/invoices';
import { formatCents } from '@/lib/pricing/money';
import { DeleteShiftButton } from './delete-shift-button';

interface ShiftSummary {
  id: string;
  date: string;
  timeRange: string;
  serviceTypeName: string;
  totalCents: number;
  status: string;
}

const STATUS_LABEL: Record<string, string> = { SUBMITTED: 'Logged', INVOICED: 'Invoiced' };
const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: 'bg-surface-line text-ink-soft',
  INVOICED: 'bg-good/10 text-good',
};

export function ShiftsList({ orgId, shifts }: { orgId: string; shifts: ShiftSummary[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(generateInvoiceAction, {});

  const invoiceable = useMemo(() => shifts.filter((s) => s.status === 'SUBMITTED'), [shifts]);
  const selectedTotalCents = useMemo(
    () => shifts.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.totalCents, 0),
    [shifts, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = invoiceable.length > 0 && invoiceable.every((s) => selected.has(s.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(invoiceable.map((s) => s.id)));

  return (
    <form action={formAction} className="space-y-4 pb-24">
      <input type="hidden" name="orgId" value={orgId} />

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-surface-line text-xs uppercase tracking-wide text-ink-faint">
              <th className="w-10 pb-2">
                {invoiceable.length > 0 && (
                  <input type="checkbox" aria-label="Select all logged shifts" checked={allSelected} onChange={toggleAll} />
                )}
              </th>
              <th className="pb-2 font-semibold">Date</th>
              <th className="pb-2 font-semibold">Support</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
              <th className="pb-2 text-right font-semibold">Status</th>
              <th className="pb-2 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => {
              const editable = shift.status === 'SUBMITTED';
              return (
                <tr key={shift.id} className="border-b border-surface-line/60 align-top">
                  <td className="py-2.5">
                    {editable && (
                      <input
                        type="checkbox"
                        name="shiftIds"
                        value={shift.id}
                        checked={selected.has(shift.id)}
                        onChange={() => toggle(shift.id)}
                        aria-label={`Select shift on ${shift.date}`}
                      />
                    )}
                  </td>
                  <td className="py-2.5 text-ink">
                    <p className="font-medium">{shift.date}</p>
                    <p className="text-xs text-ink-faint">{shift.timeRange}</p>
                  </td>
                  <td className="py-2.5 text-ink-soft">{shift.serviceTypeName}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-ink">{formatCents(shift.totalCents)}</td>
                  <td className="py-2.5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[shift.status] ?? 'bg-surface-line text-ink-soft'}`}>
                      {STATUS_LABEL[shift.status] ?? shift.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    {editable && (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/shifts/${shift.id}/edit`} className="text-sm font-medium text-brand-600">
                          Edit
                        </Link>
                        <DeleteShiftButton shiftId={shift.id} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}

      {invoiceable.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-surface-line bg-white px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {selected.size === 0
                ? 'Select shifts to invoice them together.'
                : `${selected.size} shift${selected.size === 1 ? '' : 's'} selected — ${formatCents(selectedTotalCents)}`}
            </p>
            <button type="submit" className="btn-primary shrink-0" disabled={selected.size === 0 || pending}>
              {pending ? 'Generating…' : 'Generate invoice'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
