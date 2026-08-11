import { DateTime } from 'luxon';
import type { Cents, PricedLine, PricingResult, Unit } from './pricing/types';

/**
 * Assembling an invoice from priced shifts.
 *
 * Australian tax invoice rules drive two decisions here:
 *   * The heading is "Tax Invoice" only when GST actually applies. A worker who is
 *     not GST-registered, or who only delivers GST-free supports, issues an "Invoice"
 *     with no GST line at all.
 *   * Both parties' details are captured on the document rather than referenced, so
 *     a reissued PDF always shows what it showed on the day it was sent. Invoices at
 *     or above $1,000 must carry the buyer's identity or ABN, and since a fortnight of
 *     support work is routinely above that, the buyer ABN is always included.
 */

export interface InvoiceParty {
  name: string;
  businessName?: string;
  abn?: string;
  addressLines?: string[];
  email?: string;
}

export interface InvoiceDocLine {
  serviceDate: string; // yyyy-MM-dd
  description: string;
  ndisLineItemCode?: string;
  quantity: number;
  unit: Unit;
  unitRateCents: Cents;
  amountCents: Cents;
  gstCents: Cents;
}

export interface InvoiceDoc {
  number: string;
  isTaxInvoice: boolean;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  from: InvoiceParty;
  to: InvoiceParty;
  lines: InvoiceDocLine[];
  subtotalCents: Cents;
  gstCents: Cents;
  totalCents: Cents;
  bankDetails?: { bsb: string; accountNumber: string; accountName: string };
  notes?: string;
}

export interface PricedShift {
  /** Local calendar date the shift started, yyyy-MM-dd. */
  date: string;
  result: PricingResult;
}

export interface BuildInvoiceOptions {
  shifts: PricedShift[];
  from: InvoiceParty;
  to: InvoiceParty;
  number: string;
  issueDate: string;
  termsDays: number;
  timezone: string;
  bankDetails?: InvoiceDoc['bankDetails'];
  notes?: string;
}

export function buildInvoice(options: BuildInvoiceOptions): InvoiceDoc {
  const { shifts, from, to, number, issueDate, termsDays, timezone } = options;

  const lines: InvoiceDocLine[] = shifts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((shift) => shift.result.lines.map((line) => toDocLine(shift.date, line)));

  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const gstCents = lines.reduce((sum, l) => sum + l.gstCents, 0);

  const dates = shifts.map((s) => s.date).sort();
  const issued = DateTime.fromISO(issueDate, { zone: timezone });

  return {
    number,
    // Only a supply that actually carries GST makes this a tax invoice.
    isTaxInvoice: gstCents > 0,
    issueDate,
    dueDate: issued.plus({ days: termsDays }).toFormat('yyyy-MM-dd'),
    periodStart: dates[0] ?? issueDate,
    periodEnd: dates[dates.length - 1] ?? issueDate,
    from,
    to,
    lines,
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents,
    bankDetails: options.bankDetails,
    notes: options.notes,
  };
}

function toDocLine(date: string, line: PricedLine): InvoiceDocLine {
  return {
    serviceDate: date,
    description: line.description,
    ndisLineItemCode: line.ndisLineItemCode,
    quantity: line.quantity,
    unit: line.unit,
    unitRateCents: line.unitRateCents,
    amountCents: line.amountCents,
    gstCents: line.gstCents,
  };
}

export function formatInvoiceDate(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toFormat('d LLLL yyyy');
}

/** Next number in a worker's own sequence, e.g. INV-0007. */
export function nextInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}
