'use client';

import { useMemo } from 'react';
import { DEMO_HOLIDAYS, DEMO_ORG, DEMO_RATE_CARD, DEMO_SERVICE_ID, DEMO_WORKER } from '@/lib/demo-data';
import { buildInvoice, formatInvoiceDate } from '@/lib/invoice';
import { priceShift } from '@/lib/pricing/engine';
import { formatCents, formatHours } from '@/lib/pricing/money';
import type { ShiftInput } from '@/lib/pricing/types';

const TZ = DEMO_ORG.timezone;

/** A week of sample shifts, including the overnight sleepover from the shift-logging demo. */
const SAMPLE_SHIFTS: { date: string; shift: ShiftInput }[] = [
  {
    date: '2026-08-04',
    shift: {
      startUtc: '2026-08-04T00:00:00Z',
      endUtc: '2026-08-04T07:00:00Z',
      timezone: TZ,
      serviceTypeId: DEMO_SERVICE_ID,
    },
  },
  {
    date: '2026-08-07',
    shift: {
      startUtc: '2026-08-07T10:00:00Z', // 8pm Friday Sydney
      endUtc: '2026-08-07T22:00:00Z', // 8am Saturday Sydney
      timezone: TZ,
      serviceTypeId: DEMO_SERVICE_ID,
      sleepover: {
        windowStartUtc: '2026-08-07T12:00:00Z', // 10pm
        windowEndUtc: '2026-08-07T20:00:00Z', // 6am
      },
    },
  },
];

export default function InvoicePreviewPage() {
  const invoice = useMemo(() => {
    const shifts = SAMPLE_SHIFTS.map(({ date, shift }) => ({
      date,
      result: priceShift(shift, DEMO_RATE_CARD, DEMO_HOLIDAYS),
    }));

    return buildInvoice({
      shifts,
      from: {
        name: DEMO_WORKER.name,
        businessName: DEMO_WORKER.businessName,
        abn: DEMO_WORKER.abn,
      },
      to: {
        name: DEMO_ORG.name,
        abn: DEMO_ORG.abn,
      },
      number: 'INV-0007',
      issueDate: '2026-08-11',
      termsDays: 14,
      timezone: TZ,
      bankDetails: { bsb: '062-000', accountNumber: '1234 5678', accountName: 'S. Rivera Support Work' },
      notes: 'Thanks for having me on the roster this fortnight!',
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoice preview</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Generated automatically from a fortnight of logged shifts, including the overnight
          example from the shift log. This is exactly what gets emailed to the business and to you.
        </p>
      </div>

      <div className="card mx-auto max-w-2xl bg-white p-8 text-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">
              {invoice.isTaxInvoice ? 'Tax Invoice' : 'Invoice'}
            </h2>
            <p className="mt-1 text-ink-soft">{invoice.number}</p>
          </div>
          <div className="text-right text-ink-soft">
            <p>Issued {formatInvoiceDate(invoice.issueDate, TZ)}</p>
            <p>Due {formatInvoiceDate(invoice.dueDate, TZ)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 border-y border-surface-line py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">From</p>
            <p className="mt-1 font-semibold text-ink">{invoice.from.businessName ?? invoice.from.name}</p>
            <p className="text-ink-soft">{invoice.from.name}</p>
            {invoice.from.abn && <p className="text-ink-soft">ABN {invoice.from.abn}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">To</p>
            <p className="mt-1 font-semibold text-ink">{invoice.to.businessName ?? invoice.to.name}</p>
            {invoice.to.abn && <p className="text-ink-soft">ABN {invoice.to.abn}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-left">
          <thead>
            <tr className="border-b border-surface-line text-xs uppercase tracking-wide text-ink-faint">
              <th className="pb-2 font-semibold">Date</th>
              <th className="pb-2 font-semibold">Description</th>
              <th className="pb-2 text-right font-semibold">Qty</th>
              <th className="pb-2 text-right font-semibold">Rate</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-b border-surface-line/60 align-top">
                <td className="py-2 pr-2 text-ink-soft">
                  {index === 0 || invoice.lines[index - 1].serviceDate !== line.serviceDate
                    ? formatInvoiceDate(line.serviceDate, TZ)
                    : ''}
                </td>
                <td className="py-2 pr-2 text-ink">{line.description}</td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {line.unit === 'NIGHT' ? '1' : formatHours(line.quantity)}
                </td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {formatCents(line.unitRateCents)}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-ink">
                  {formatCents(line.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-52 space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCents(invoice.subtotalCents)}</span>
          </div>
          {invoice.isTaxInvoice && (
            <div className="flex justify-between text-ink-soft">
              <span>GST</span>
              <span className="tabular-nums">{formatCents(invoice.gstCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-surface-line pt-1 text-base font-bold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(invoice.totalCents)}</span>
          </div>
        </div>

        {!invoice.isTaxInvoice && (
          <p className="mt-4 text-xs text-ink-faint">No GST has been charged on this invoice.</p>
        )}

        {invoice.bankDetails && (
          <div className="mt-6 border-t border-surface-line pt-4 text-ink-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Payment details</p>
            <p className="mt-1">
              {invoice.bankDetails.accountName} · BSB {invoice.bankDetails.bsb} · Acc{' '}
              {invoice.bankDetails.accountNumber}
            </p>
          </div>
        )}

        {invoice.notes && <p className="mt-4 text-ink-soft">{invoice.notes}</p>}
      </div>

      <div className="mx-auto flex max-w-2xl justify-end gap-2">
        <button type="button" className="btn-ghost">
          Download PDF
        </button>
        <button type="button" className="btn-primary">
          Send to business &amp; me
        </button>
      </div>
    </div>
  );
}
