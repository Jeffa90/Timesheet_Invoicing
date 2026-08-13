import { renderToBuffer } from '@react-pdf/renderer';
import { notFound } from 'next/navigation';
import type { InvoiceParty } from '@/lib/invoice';
import { loadInvoiceForViewer } from '@/lib/invoice-access';
import { InvoicePdfDocument } from '@/lib/pdf/invoice-pdf';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadInvoiceForViewer(id);
  if (!loaded) notFound();
  const { invoice } = loaded;

  const from = invoice.fromSnapshot as unknown as InvoiceParty;
  const to = invoice.toSnapshot as unknown as InvoiceParty;

  const buffer = await renderToBuffer(
    <InvoicePdfDocument invoice={invoice} from={from} to={to} timezone={invoice.org.timezone} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
