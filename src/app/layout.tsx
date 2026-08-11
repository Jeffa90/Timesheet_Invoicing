import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shift & Invoice — NDIS timesheets',
  description:
    'Log NDIS support shifts, calculate overnight and sleepover billing automatically, and issue invoices.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#1f63ad',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const NAV = [
  { href: '/', label: 'Log a shift' },
  { href: '/rates', label: 'Rates' },
  { href: '/invoice', label: 'Invoice' },
  { href: '/help', label: 'Help' },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50
                     focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>

        <header className="border-b border-surface-line bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white"
              >
                SI
              </span>
              <span className="hidden sm:inline">Shift &amp; Invoice</span>
            </Link>

            <nav aria-label="Main" className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunk hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-5xl px-4 py-6 pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
