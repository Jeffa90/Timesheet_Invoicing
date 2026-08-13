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
  acn?: string;
  addressLines?: string[];
  email?: string;
  phone?: string;
  /** Only ever set on the `from` party — folded into fromSnapshot at generation
   * time so a reissued invoice always shows the payment details it showed on
   * the day it was sent, same as every other frozen field on this type. */
  bankDetails?: { bsb: string; accountNumber: string; accountName: string };
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
  /** Which shift this line came from, so it can be persisted as a real foreign key. */
  shiftId?: string;
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
  shiftId?: string;
  /**
   * Prefixed onto every line this shift produces. The pricing engine's own
   * line descriptions are day-type and time only (e.g. "Weekday — 9am to
   * 12:30pm") since the engine never sees service type names, only opaque
   * ids for rate lookups — on a business with more than one service (e.g.
   * Personal Care and Admin Hours), lines from different services would
   * otherwise be indistinguishable on the invoice itself.
   */
  serviceTypeName?: string;
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
  /**
   * Override the billing period instead of inferring it from the included
   * shifts — e.g. a fixed fortnightly cycle that should read "1 Aug - 14 Aug"
   * even if no shift happens to land exactly on either boundary day.
   */
  periodStart?: string;
  periodEnd?: string;
}

export function buildInvoice(options: BuildInvoiceOptions): InvoiceDoc {
  const { shifts, from, to, number, issueDate, termsDays, timezone } = options;

  const lines: InvoiceDocLine[] = shifts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((shift) => shift.result.lines.map((line) => toDocLine(shift.date, line, shift.serviceTypeName, shift.shiftId)));

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
    periodStart: options.periodStart ?? dates[0] ?? issueDate,
    periodEnd: options.periodEnd ?? dates[dates.length - 1] ?? issueDate,
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

function toDocLine(date: string, line: PricedLine, serviceTypeName: string | undefined, shiftId?: string): InvoiceDocLine {
  return {
    serviceDate: date,
    description: serviceTypeName ? `${serviceTypeName}: ${line.description}` : line.description,
    ndisLineItemCode: line.ndisLineItemCode,
    quantity: line.quantity,
    unit: line.unit,
    unitRateCents: line.unitRateCents,
    amountCents: line.amountCents,
    gstCents: line.gstCents,
    shiftId,
  };
}

export function formatInvoiceDate(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toFormat('d LLLL yyyy');
}

/** dd/MM/yyyy — used only in the invoice document's own header metadata table. */
export function formatInvoiceDateShort(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toFormat('dd/LL/yyyy');
}

/**
 * Every date-only field on an invoice (issue/due/period/service dates) is
 * read back for display via `date.toISOString().slice(0, 10)` — the UTC
 * calendar date of the stored instant. Anchoring the write at UTC midnight
 * (rather than midnight in the org's timezone) is what makes that round trip
 * lossless: for any positive UTC offset — which covers every Australian
 * timezone — midnight-local falls on the *previous* UTC calendar day, so
 * anchoring there would silently shift every invoice date back by one day.
 */
export function calendarDateToUtcMidnight(iso: string): Date {
  return DateTime.fromISO(iso, { zone: 'utc' }).toJSDate();
}

/** Next number in a worker's own sequence, e.g. INV-0007. */
export function nextInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}
