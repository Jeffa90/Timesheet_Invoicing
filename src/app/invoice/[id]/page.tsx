import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { formatInvoiceDate, type InvoiceParty } from '@/lib/invoice';
import { formatCents, formatHours } from '@/lib/pricing/money';
import { isOrgAdmin, requireSessionUser } from '@/lib/session';
import { MarkPaidForm } from './mark-paid-form';
import { MarkUnpaidButton } from './mark-unpaid-button';
import { SendButton } from './send-button';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSessionUser();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, org: true },
  });

  const isOwner = invoice?.userId === user.id;
  const isBusinessViewer = invoice ? !isOwner && (await isOrgAdmin(user.id, invoice.orgId)) : false;
  if (!invoice || (!isOwner && !isBusinessViewer)) notFound();

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{invoice.isTaxInvoice ? 'Tax Invoice' : 'Invoice'}</h2>
            <p className="mt-1 text-ink-soft">{invoice.number}</p>
          </div>
          <div className="text-right text-ink-soft">
            <p>Issued {formatInvoiceDate(invoice.issueDate.toISOString().slice(0, 10), timezone)}</p>
            <p>Due {formatInvoiceDate(invoice.dueDate.toISOString().slice(0, 10), timezone)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 border-y border-surface-line py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">From</p>
            <p className="mt-1 font-semibold text-ink">{from.businessName ?? from.name}</p>
            <p className="text-ink-soft">{from.name}</p>
            {from.addressLines?.map((line) => (
              <p key={line} className="text-ink-soft">
                {line}
              </p>
            ))}
            {from.abn && <p className="text-ink-soft">ABN {from.abn}</p>}
            {from.acn && <p className="text-ink-soft">ACN {from.acn}</p>}
            {from.phone && <p className="text-ink-soft">{from.phone}</p>}
            {from.email && <p className="text-ink-soft">{from.email}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">To</p>
            <p className="mt-1 font-semibold text-ink">{to.businessName ?? to.name}</p>
            {to.abn && <p className="text-ink-soft">ABN {to.abn}</p>}
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

        {!invoice.isTaxInvoice && <p className="mt-4 text-xs text-ink-faint">No GST has been charged on this invoice.</p>}
      </div>

      <div className="mx-auto flex max-w-2xl justify-end gap-2">
        {isOwner && invoice.status === 'DRAFT' && <SendButton invoiceId={invoice.id} />}
        {isBusinessViewer && invoice.status === 'SENT' && <MarkPaidForm invoiceId={invoice.id} />}
        {isBusinessViewer && invoice.status === 'PAID' && <MarkUnpaidButton invoiceId={invoice.id} />}
      </div>
      <p className="mx-auto max-w-2xl text-right text-xs text-ink-faint">
        PDF export and email delivery aren&apos;t wired up yet — see the README.
      </p>
    </div>
  );
}
