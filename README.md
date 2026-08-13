# Shift &amp; Invoice — NDIS timesheet management and invoicing

A web app (installable as a PWA on phone, tablet or desktop) for NDIS support-work
subcontractors and the businesses they work for. A business configures its rates once;
workers log shift start/end times; overnight and sleepover billing is calculated
automatically; invoices are generated in a standardised, Australian tax-invoice-compliant
template.

This scope, its priorities, and the decisions behind them are captured in full at the top
of this repository's plan history. In short: **setup + shift logging + invoicing ships
first**, then approval workflow, then accounting export, then rostering, then compliance
tracking. That first slice is now fully wired end-to-end against a real database.

## Why overnight billing needs a real engine, not a spreadsheet formula

An NDIS overnight shift routinely isn't "12 hours at the overnight rate." It's hourly
billing until a configured time, a flat sleepover fee for a continuous window, hourly
billing again from a configured morning time — and every one of those segments can also
cross into a Saturday, Sunday or public holiday rate at midnight. Get this wrong and a
worker is short-paid or a business can't defend its own invoicing.

`src/lib/pricing/engine.ts` is a **pure function** — no database, no clock, no network —
that takes a shift and a rate card and returns an itemised breakdown. Being pure is what
makes it exhaustively testable: `src/lib/pricing/engine.test.ts` has 27 cases including
the exact 8pm–8am worked example from the original brief, active support beyond the
included sleepover allowance, and both the October and April daylight-saving transitions
(an overnight shift is genuinely 23 or 25 hours those nights — the engine uses
[Luxon](https://moment.github.io/luxon/) throughout specifically so that's correct
automatically rather than by accident). The same pure function runs client-side for the
live preview as a worker types, and again server-side as the authoritative price when a
shift is saved — never trusting the browser's number.

## Stack

- **Next.js (App Router) + TypeScript** — one codebase for the mobile shift-logging UI
  and the desktop rate-card/admin UI.
- **Auth.js v5** — email + password accounts, JWT sessions, middleware-gated routes.
- **Tailwind CSS** — utility styling, 44px minimum tap targets, `prefers-reduced-motion`
  respected.
- **PostgreSQL + Prisma** (`prisma/schema.prisma`) — the full data model: organisations,
  memberships, worker profiles, rate cards (versioned, with effective dates), service
  types, sleepover/travel configuration, shifts, timesheets, invoices and invoice lines.
- **Luxon** for all date/time handling — never the native `Date` for band or DST logic.
- **Integer cents** for all money, everywhere. Never floats.
- **Vitest** for the engine and invoice-assembly test suites.
- PWA manifest (`public/manifest.webmanifest`) so the app installs to a home screen.

## What's built and working end-to-end

Verified with a full scripted browser run: sign up → complete the setup wizard → invite a
worker → the worker accepts the invite and sets a password → logs a real overnight
sleepover shift → generates a real invoice with correct line items and totals, all
persisted in Postgres.

- **Auth** (`src/lib/auth.ts`, `src/middleware.ts`) — email/password signup and login,
  JWT sessions, every route gated except `/login`, `/signup` and `/invite/*`.
- **Setup wizard** (`src/app/onboarding/`) — business details → services → rate card
  (bands, per-day/band rates as flat `$` or `%` of the NDIS cap, sleepover config, travel,
  rounding and minimum-engagement rules) → invite workers. Progress is persisted
  (`OnboardingState`) so an abandoned wizard resumes where it left off.
- **Invites** (`src/lib/actions/invites.ts`, `src/app/invite/[token]/`) — a business
  assigns a worker to a rate card and gets a shareable link (no email service is wired up
  yet, see below). The invitee either sets a password to claim a new account, or logs in
  to an existing one and accepts from there.
- **Shift logging** (`src/app/page.tsx`, `src/app/shift-logger.tsx`) — pulls the worker's
  real engagement and rate card from the database, prices client-side for instant
  feedback, and re-prices server-side on save (`src/lib/actions/shifts.ts`), storing the
  full pricing result and the rate card version that produced it.
- **Rates admin** (`src/app/rates/`) — the business's real rate card against NDIS caps,
  plus a "test a shift" panel using the same engine.
- **Invoicing** (`src/app/invoice/`, `src/lib/actions/invoices.ts`) — a worker's own
  invoice details (ABN, GST status, bank details), generating an invoice from every
  logged-but-not-yet-invoiced shift, and a real invoice detail page
  (`src/app/invoice/[id]/`) reflecting what's actually stored.
- **The snapshot rule** (`prisma/schema.prisma`) — every shift stores the rate card
  version that priced it and its full pricing result; every invoice freezes both parties'
  details at issue. Editing a rate card later can never silently rewrite an invoice that's
  already gone out.
- `prisma/seed.ts` — seeds a demo organisation, worker and rate card for exploring the
  schema directly (e.g. via `prisma studio`) without going through signup.

## What's deliberately not built yet

PDF generation and email delivery (invoices can be generated and marked as sent, but
there's no attachment or inbox at the other end yet — that needs a transactional email
provider, e.g. Resend, which is scaffolded in `.env.example` but not wired), the NDIS
Support Catalogue import (rate caps are seeded from the 2025-26 guide's published figures,
not re-fetched), and the onboarding product tour / help-centre deep links described in the
original brief (the help page itself exists at `/help`). These are the next slice of
Phase 1 and are scoped, not speculative. Approval workflow, accounting export, rostering
and compliance tracking are later phases by design, per the agreed priority order.

Two figures in the wizard's rate defaults are explicit placeholders, called out in
`src/lib/pricing/defaults.ts` — the weekday night rate and the sleepover fee cap — because
the wizard, not a hardcoded default, is where a real business confirms these against the
current NDIS Pricing Arrangements and Price Limits.

## Getting started

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a real Postgres instance; set AUTH_SECRET
npm run db:migrate      # applies prisma/migrations
npm run db:seed         # optional: seeds a demo org/worker/rate card
npm run dev
```

Then visit `/signup` to create a business account and walk through the wizard, or
`/login` if you already have one. `AUTH_SECRET` can be generated with
`openssl rand -base64 32`.

```bash
npm test        # pricing engine + invoice assembly (31 tests)
npm run typecheck
npm run build
```

## Repository layout

```
src/
  app/
    onboarding/        Setup wizard: business -> services -> rates -> invite
    invite/[token]/     Invite acceptance (claim a new account or accept as an existing one)
    login/, signup/     Auth pages
    page.tsx, shift-logger.tsx   Shift logging, wired to the signed-in worker's engagement
    rates/               Real rate card admin + "test a shift"
    invoice/             Worker invoice details, generation, and per-invoice detail pages
  lib/
    pricing/            The engine: types, time algebra, engine, money, NDIS defaults
    actions/            Server actions: auth, organisation, service types, rate cards,
                         invites, shifts, invoices, worker profile
    auth.ts, session.ts  Auth.js config and session/org-context helpers
    db.ts                Prisma client singleton
    rate-card-mapper.ts  DB rate card -> the engine's flat snapshot shape
    invoice.ts           Priced shifts -> an invoice document
    shift-form.ts        Phone form values -> engine input
    demo-data.ts         Sample org/worker/rate-card, used by prisma/seed.ts
prisma/
  schema.prisma          Full Phase 1 data model
  migrations/             Applied migration history
  seed.ts                 Demo data seeding
```
