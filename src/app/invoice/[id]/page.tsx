import { notFound } from 'next/navigation';
import { formatInvoiceDate, formatInvoiceDateShort, type InvoiceParty } from '@/lib/invoice';
import { loadInvoiceForViewer } from '@/lib/invoice-access';
import { formatCents, formatHours } from '@/lib/pricing/money';
import { MarkPaidForm } from './mark-paid-form';
import { MarkUnpaidButton } from './mark-unpaid-button';
import { SendButton } from './send-button';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadInvoiceForViewer(id);
  if (!loaded) notFound();
  const { invoice, isOwner, isBusinessViewer } = loaded;

  const from = invoice.fromSnapshot as unknown as InvoiceParty;
  const to = invoice.toSnapshot as unknown as InvoiceParty;
  const timezone = invoice.org.timezone;

  const statusLine =
    invoice.status === 'DRAFT'
      ? "Not sent yet — check the details below, then send it."
      : invoice.status === 'PAID'
        ? `Paid${invoice.paidAt ? ` ${formatInvoiceDate(invoice.paidAt.toISOString().slice(0, 10), timezone)}` : ''}${invoice.paymentReference ? ` · ${invoice.paymentReference}` : ''}`
        : invoice.status === 'SENT'
          ? `Sent${invoice.sentAt ? ` ${formatInvoiceDate(invoice.sentAt.toISOString().slice(0, 10), timezone)}` : ''} — pending payment`
          : invoice.status;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{invoice.number}</h1>
        <p className="mt-1 text-sm text-ink-soft">{statusLine}</p>
      </div>

      <div className="card mx-auto max-w-2xl bg-white p-8 text-sm">
        {/* Masthead: the heading and the worker's own identity read together as one block. */}
        <div className="text-right">
          <h2 className="text-2xl font-bold tracking-tight text-ink">{invoice.isTaxInvoice ? 'Tax Invoice' : 'Invoice'}</h2>
          <PartyIdentity party={from} />
        </div>

        {/* Who it's for, and the invoice's own metadata. */}
        <div className="mt-6 flex items-start justify-between gap-6 border-t border-surface-line pt-4">
          <PartyIdentity party={to} />
          <div className="shrink-0 text-right">
            <MetaRow label="Invoice number" value={invoice.number} emphasize />
            <MetaRow label="Invoice date" value={formatInvoiceDateShort(invoice.issueDate.toISOString().slice(0, 10), timezone)} />
            <MetaRow label="Payment due" value={formatInvoiceDateShort(invoice.dueDate.toISOString().slice(0, 10), timezone)} />
            <div className="h-2" />
            <MetaRow label="Period start" value={formatInvoiceDateShort(invoice.periodStart.toISOString().slice(0, 10), timezone)} />
            <MetaRow label="Period end" value={formatInvoiceDateShort(invoice.periodEnd.toISOString().slice(0, 10), timezone)} />
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
              <tr key={line.id} className="border-b border-surface-line/60 align-top">
                <td className="py-2 pr-2 text-ink-soft">
                  {(index === 0 || invoice.lines[index - 1].serviceDate?.getTime() !== line.serviceDate?.getTime()) &&
                  line.serviceDate
                    ? formatInvoiceDate(line.serviceDate.toISOString().slice(0, 10), timezone)
                    : ''}
                </td>
                <td className="py-2 pr-2 text-ink">{line.description}</td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {line.unit === 'NIGHT' || line.unit === 'EACH' ? '1' : formatHours(line.quantity)}
                </td>
                <td className="py-2 text-right tabular-nums text-ink-soft">{formatCents(line.unitRateCents)}</td>
                <td className="py-2 text-right tabular-nums font-medium text-ink">{formatCents(line.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal (excl GST)</span>
            <span className="tabular-nums">{formatCents(invoice.subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Total GST</span>
            <span className="tabular-nums">{formatCents(invoice.gstCents)}</span>
          </div>
          <div className="flex justify-between border-t border-surface-line pt-1 text-base font-bold text-ink">
            <span>Amount due</span>
            <span className="tabular-nums">{formatCents(invoice.totalCents)} AUD</span>
          </div>
        </div>

        {from.bankDetails && (
          <div className="mt-6 border-t border-surface-line pt-4">
            <p className="font-semibold text-ink">Please make payment to:</p>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink-soft">
              <span>Account name:</span>
              <span>{from.bankDetails.accountName}</span>
              <span>BSB:</span>
              <span>{from.bankDetails.bsb}</span>
              <span>Account number:</span>
              <span>{from.bankDetails.accountNumber}</span>
              <span>Reference:</span>
              <span>{invoice.number}</span>
            </div>
          </div>
        )}

        {invoice.notes && <p className="mt-4 text-ink-soft">{invoice.notes}</p>}

        <p className="mt-4 text-xs text-ink-faint">
          For any enquiries relating to this Invoice please contact {from.name}.
        </p>
      </div>

      <div className="mx-auto flex max-w-2xl justify-end gap-2">
        <a href={`/invoice/${invoice.id}/pdf`} className="btn btn-secondary">
          Download PDF
        </a>
        {isOwner && invoice.status === 'DRAFT' && <SendButton invoiceId={invoice.id} />}
        {isBusinessViewer && invoice.status === 'SENT' && <MarkPaidForm invoiceId={invoice.id} />}
        {isBusinessViewer && invoice.status === 'PAID' && <MarkUnpaidButton invoiceId={invoice.id} />}
      </div>
      <p className="mx-auto max-w-2xl text-right text-xs text-ink-faint">Email delivery isn&apos;t wired up yet — see the README.</p>
    </div>
  );
}

/**
 * A party's identity, in the order requested for every invoice: trading name
 * (bold) — the legal/personal name too, only if it differs — then the ABN
 * directly underneath with no gap, then a visual gap, then everything else.
 * Used for both the worker (in the masthead, right-aligned) and the business
 * (in the second row, left-aligned) so the two sides read consistently.
 */
function PartyIdentity({ party }: { party: InvoiceParty }) {
  const heading = party.businessName ?? party.name;
  const showLegalName = party.businessName && party.name !== party.businessName;

  return (
    <div>
      <p className="font-bold text-ink">{heading}</p>
      {showLegalName && <p className="text-ink-soft">{party.name}</p>}
      {party.abn && <p className="font-bold text-ink-soft">ABN: {party.abn}</p>}
      <div className="mt-2 space-y-0.5 text-ink-faint">
        {party.acn && <p>ACN {party.acn}</p>}
        {party.addressLines?.map((line) => <p key={line}>{line}</p>)}
        {party.phone && <p>{party.phone}</p>}
        {party.email && <p>{party.email}</p>}
      </div>
    </div>
  );
}

function MetaRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <p className="flex justify-between gap-4 text-ink-soft">
      <span className="font-medium text-ink">{label}:</span>
      <span className={emphasize ? 'font-bold text-ink' : 'tabular-nums'}>{value}</span>
    </p>
  );
}
