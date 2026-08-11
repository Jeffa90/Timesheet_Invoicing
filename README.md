# Shift &amp; Invoice — NDIS timesheet management and invoicing

A web app (installable as a PWA on phone, tablet or desktop) for NDIS support-work
subcontractors and the businesses they work for. A business configures its rates once;
workers log shift start/end times; overnight and sleepover billing is calculated
automatically; invoices are generated in a standardised, Australian tax-invoice-compliant
template and sent to both parties.

This scope, its priorities, and the decisions behind them are captured in full at the top
of this repository's plan history. In short: **setup + shift logging + invoicing ships
first**, then approval workflow, then accounting export, then rostering, then compliance
tracking.

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
automatically rather than by accident).

## Stack

- **Next.js (App Router) + TypeScript** — one codebase for the mobile shift-logging UI
  and the desktop rate-card/admin UI.
- **Tailwind CSS** — utility styling, 44px minimum tap targets, `prefers-reduced-motion`
  respected.
- **PostgreSQL + Prisma** (`prisma/schema.prisma`) — the full data model: organisations,
  memberships, worker profiles, rate cards (versioned, with effective dates), service
  types, sleepover/travel configuration, shifts, timesheets, invoices and invoice lines.
- **Luxon** for all date/time handling — never the native `Date` for band or DST logic.
- **Integer cents** for all money, everywhere. Never floats.
- **Vitest** for the engine and invoice-assembly test suites.
- PWA manifest (`public/manifest.webmanifest`) so the app installs to a home screen.

## What's built so far

- `src/lib/pricing/` — the engine: types, time/interval algebra (DST-correct
  segmentation, band splitting, sleepover carve-out), money helpers, and NDIS defaults
  (time bands, sleepover span/allowance) with **31 passing tests** across the engine and
  invoice assembly.
- `src/lib/invoice.ts` — turns priced shifts into an Australian tax-invoice document:
  headed "Tax Invoice" only when GST genuinely applies (many NDIS supports are GST-free,
  and a subcontractor may not be GST-registered at all), otherwise a plain "Invoice"
  with no GST line.
- `src/lib/shift-form.ts` — turns a worker's phone-friendly date + two clock times into
  the engine's UTC input, correctly rolling an end time before the start time to the
  following day.
- `prisma/schema.prisma` — the full Phase 1 data model, including the **snapshot rule**:
  every shift stores which rate card version priced it and its full pricing result, and
  every invoice freezes both parties' details at issue, so editing a rate card later can
  never silently rewrite an invoice that's already gone out.
- `prisma/seed.ts` — seeds a demo organisation, worker and rate card so the app is
  explorable against a real database immediately.
- Four pages, all functional against demo data (no database required to try them):
  - `/` — **log a shift**. Live running total and an itemised, plain-English breakdown
    as you type, computed client-side by the same engine the server uses.
  - `/rates` — the rate card grid, each rate shown against its NDIS price cap, plus a
    **"test a shift"** panel so an admin can validate configuration before a worker
    relies on it.
  - `/invoice` — a generated invoice preview from a sample fortnight of shifts,
    including an overnight sleepover.
  - `/help` — the in-app help centre, plus a "restart the tour" entry point for the
    onboarding walkthrough.

## What's deliberately not built yet

Real auth, the database wiring behind the UI (forms currently price shifts client-side
against demo data — the "Save shift" and "Send invoice" actions are stubbed), the
onboarding wizard's actual step flow, PDF generation, email delivery, and the NDIS
Support Catalogue import. These are the next slice of Phase 1 and are scoped, not
speculative — the data model and engine underneath them are already in place. Approval
workflow, accounting export, rostering and compliance tracking are later phases by
design, per the agreed priority order.

Two figures in the demo rate card are explicit placeholders, called out in
`src/lib/demo-data.ts` and `prisma/seed.ts` — the weekday night rate and the sleepover
fee — because the setup wizard, not a hardcoded default, is where a real business
confirms these against the current NDIS Pricing Arrangements and Price Limits.

## Getting started

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a real Postgres instance
npm run db:push        # or db:migrate once you're ready for real migrations
npm run db:seed
npm run dev
```

```bash
npm test        # pricing engine + invoice assembly (31 tests)
npm run typecheck
npm run build
```

## Repository layout

```
src/
  app/                 Next.js routes (/, /rates, /invoice, /help)
  lib/
    pricing/           The engine: types, time algebra, engine, money, NDIS defaults
    invoice.ts         Priced shifts -> an invoice document
    shift-form.ts       Phone form values -> engine input
    demo-data.ts        Sample org/worker/rate-card used by the UI without a database
prisma/
  schema.prisma        Full Phase 1 data model
  seed.ts              Demo data seeding
```
