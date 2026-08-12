import type { Invoice, InvoiceLine } from '@prisma/client';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatInvoiceDate, formatInvoiceDateShort, type InvoiceParty } from '@/lib/invoice';
import { formatCents, formatHours } from '@/lib/pricing/money';

/**
 * Mirrors the layout of src/app/invoice/[id]/page.tsx. react-pdf has no
 * HTML/Tailwind renderer, so the structure is necessarily duplicated here —
 * but the formatting and business logic (date/money helpers, the from/to
 * snapshots, the priced lines) are the exact same functions and data the
 * HTML page uses, so the two never disagree on what a number says.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  masthead: { alignItems: 'flex-end', textAlign: 'right' },
  heading: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  partyName: { fontWeight: 700 },
  partySoft: { color: '#4b5563' },
  partyAbn: { fontWeight: 700, color: '#4b5563' },
  partyFaint: { color: '#6b7280', marginTop: 6 },
  divider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 16, paddingTop: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, color: '#4b5563' },
  metaLabel: { fontWeight: 500, color: '#1a1a1a' },
  metaValueEmphasize: { fontWeight: 700, color: '#1a1a1a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaBlock: { alignItems: 'flex-end', minWidth: 180 },
  table: { marginTop: 20 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 6,
  },
  colDate: { width: '15%', color: '#4b5563' },
  colDescription: { width: '45%' },
  colQty: { width: '13%', textAlign: 'right', color: '#4b5563' },
  colRate: { width: '13%', textAlign: 'right', color: '#4b5563' },
  colAmount: { width: '14%', textAlign: 'right', fontWeight: 500 },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalsBlock: { width: 200 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', color: '#4b5563', marginTop: 2 },
  totalsRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
    paddingTop: 4,
    fontSize: 12,
    fontWeight: 700,
  },
  paymentSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  paymentHeading: { fontWeight: 700, marginBottom: 6 },
  paymentRow: { flexDirection: 'row', gap: 8, marginTop: 1, color: '#4b5563' },
  paymentLabel: { width: 100 },
  notes: { marginTop: 12, color: '#4b5563' },
  footerNote: { marginTop: 12, fontSize: 8, color: '#6b7280' },
});

function PartyIdentityPdf({ party }: { party: InvoiceParty }) {
  const heading = party.businessName ?? party.name;
  const showLegalName = party.businessName && party.name !== party.businessName;

  return (
    <View>
      <Text style={styles.partyName}>{heading}</Text>
      {showLegalName && <Text style={styles.partySoft}>{party.name}</Text>}
      {party.abn && <Text style={styles.partyAbn}>ABN: {party.abn}</Text>}
      <View style={styles.partyFaint}>
        {party.acn && <Text>ACN {party.acn}</Text>}
        {party.addressLines?.map((line) => <Text key={line}>{line}</Text>)}
        {party.phone && <Text>{party.phone}</Text>}
        {party.email && <Text>{party.email}</Text>}
      </View>
    </View>
  );
}

function MetaRowPdf({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={emphasize ? styles.metaValueEmphasize : undefined}>{value}</Text>
    </View>
  );
}

export interface InvoicePdfProps {
  invoice: Invoice & { lines: InvoiceLine[] };
  from: InvoiceParty;
  to: InvoiceParty;
  timezone: string;
}

export function InvoicePdfDocument({ invoice, from, to, timezone }: InvoicePdfProps) {
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <Document title={invoice.number}>
      <Page size="A4" style={styles.page}>
        <View style={styles.masthead}>
          <Text style={styles.heading}>{invoice.isTaxInvoice ? 'Tax Invoice' : 'Invoice'}</Text>
          <PartyIdentityPdf party={from} />
        </View>

        <View style={[styles.row, styles.divider]}>
          <PartyIdentityPdf party={to} />
          <View style={styles.metaBlock}>
            <MetaRowPdf label="Invoice number" value={invoice.number} emphasize />
            <MetaRowPdf label="Invoice date" value={formatInvoiceDateShort(isoDate(invoice.issueDate), timezone)} />
            <MetaRowPdf label="Payment due" value={formatInvoiceDateShort(isoDate(invoice.dueDate), timezone)} />
            <View style={{ height: 8 }} />
            <MetaRowPdf label="Period start" value={formatInvoiceDateShort(isoDate(invoice.periodStart), timezone)} />
            <MetaRowPdf label="Period end" value={formatInvoiceDateShort(isoDate(invoice.periodEnd), timezone)} />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {invoice.lines.map((line, index) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={styles.colDate}>
                {(index === 0 || invoice.lines[index - 1].serviceDate?.getTime() !== line.serviceDate?.getTime()) &&
                line.serviceDate
                  ? formatInvoiceDate(isoDate(line.serviceDate), timezone)
                  : ''}
              </Text>
              <Text style={styles.colDescription}>{line.description}</Text>
              <Text style={styles.colQty}>{line.unit === 'NIGHT' || line.unit === 'EACH' ? '1' : formatHours(line.quantity)}</Text>
              <Text style={styles.colRate}>{formatCents(line.unitRateCents)}</Text>
              <Text style={styles.colAmount}>{formatCents(line.amountCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text>Subtotal (excl GST)</Text>
              <Text>{formatCents(invoice.subtotalCents)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total GST</Text>
              <Text>{formatCents(invoice.gstCents)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text>Amount due</Text>
              <Text>{formatCents(invoice.totalCents)} AUD</Text>
            </View>
          </View>
        </View>

        {from.bankDetails && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentHeading}>Please make payment to:</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Account name:</Text>
              <Text>{from.bankDetails.accountName}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>BSB:</Text>
              <Text>{from.bankDetails.bsb}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Account number:</Text>
              <Text>{from.bankDetails.accountNumber}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Reference:</Text>
              <Text>{invoice.number}</Text>
            </View>
          </View>
        )}

        {invoice.notes && <Text style={styles.notes}>{invoice.notes}</Text>}

        <Text style={styles.footerNote}>For any enquiries relating to this Invoice please contact {from.name}.</Text>
      </Page>
    </Document>
  );
}
