import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { signOutAction } from '@/lib/actions/auth';
import { getPrimaryAdminOrg, getSessionUser, hasWorkerAccess } from '@/lib/session';
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

// Only shown to someone who's actually a worker somewhere (see
// hasWorkerAccess) — otherwise these are dead ends for a business-only
// account, symmetric to how BUSINESS_NAV is gated below.
const WORKER_NAV = [
  { href: '/', label: 'Log a shift' },
  { href: '/shifts', label: 'My Shifts' },
  { href: '/invoice', label: 'My Invoices' },
  { href: '/profile', label: 'Profile' },
] as const;

// Only shown to someone who actually runs a business — otherwise these are
// dead ends (both pages redirect to the setup wizard for anyone else).
const BUSINESS_NAV = [
  { href: '/business/services', label: 'Services' },
  { href: '/rates', label: 'Rates' },
  { href: '/business/rate-cards', label: 'Rate cards' },
  { href: '/business/team', label: 'Team' },
  { href: '/business/invoices', label: 'Invoices' },
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const adminOrg = user ? await getPrimaryAdminOrg(user.id) : null;
  const isWorker = user ? await hasWorkerAccess(user.id) : false;

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

            {user && (
              <nav aria-label="Main" className="flex items-center gap-1">
                {isWorker &&
                  WORKER_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunk hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  ))}
                {adminOrg && (
                  <>
                    {isWorker && <span aria-hidden className="mx-1 h-5 w-px bg-surface-line" />}
                    {BUSINESS_NAV.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunk hover:text-ink"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </>
                )}
                <Link
                  href="/help"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunk hover:text-ink"
                >
                  Help
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunk hover:text-ink"
                  >
                    Log out
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>

        <main id="main" className="mx-auto max-w-5xl px-4 py-6 pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
