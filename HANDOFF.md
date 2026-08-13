# Project handoff — NDIS Timesheet & Invoicing

_Last updated: 2026-08-13, after the nav-gating fix below (see bugs-fixed item 15)._

This file exists so a fresh chat session can pick this project up without
re-deriving everything from scratch. If you're a Claude session reading this
cold: read this whole file before touching code.

## What this app is

A web app for NDIS (Australian disability support) subcontractors and the
small businesses that engage them. A business sets up rate cards (what they
pay for different shift types — weekday/Saturday/Sunday/public holiday,
day/evening/night, sleepovers, travel), invites workers, and workers log
shifts and generate invoices from them. Handles Australian specifics: GST
correctness (worker registration status × per-service GST-applicability),
NDIS price caps, public holidays, overnight sleepover billing.

## Stack & where things live

- Next.js 15 (App Router, Server Components/Actions) + TypeScript + Tailwind
- Prisma ORM + Postgres. Auth.js (NextAuth v5) with Credentials provider, JWT sessions
- Repo: `Jeffa90/Timesheet_Invoicing`, branch `claude/ndis-shift-tracker-f7324m`, PR #2
- Preview: https://timesheet-invoicing-git-claude-ndis-shift-tracker-f7324m-jeffa.vercel.app
- Production DB: Supabase Postgres. Local dev: whatever Postgres is running in the sandbox.
- Vitest for unit tests (`npx vitest run`), no E2E test suite committed — Playwright
  scripts were written ad hoc in the scratchpad during sessions and not kept.

## Environment gotchas already solved — don't rediscover these

- **`DATABASE_URL`** (used at runtime) must be Supabase's **Transaction pooler**:
  `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`
- **`DIRECT_URL`** (used only by `prisma migrate deploy` during the Vercel build) must be
  the **Session pooler** — same pooler host as above, **port 5432**, username still
  `postgres.<project-ref>` (not plain `postgres`). The "real" direct-connect host
  (`db.<project-ref>.supabase.co:5432`) is IPv6-only and unreachable from Vercel's
  build environment — using it fails with `P1001: Can't reach database server`.
- `package.json`'s `vercel-build` script is `prisma migrate deploy && next build` —
  migrations run automatically on every deploy, no manual step needed.
- If a Vercel deployment is building/showing the **wrong (stale) commit**, don't hunt
  for the right row in the Deployments list — push an empty commit
  (`git commit --allow-empty -m "..."`) to force a fresh deploy unambiguously tied to
  the current branch tip.
- Supabase free-tier projects can auto-pause after inactivity — check for a "Project
  paused" banner before assuming a connection string is wrong.
- Local Postgres in this sandbox stops between sessions/tool calls sometimes —
  `service postgresql start` before running the dev server or scripts against it.

## Feature set (all live on the branch above)

**Worker side**
- Log a shift (`/`) — pure client-side pricing engine gives instant preview, re-priced
  authoritatively on the server on save
- **My Shifts** (`/shifts`) — list every logged shift, checkbox-select ones to invoice,
  edit or delete anything not yet invoiced (invoiced ones are read-only)
- My Invoices (`/invoice`) — generate an invoice from all pending shifts, an optional
  date-period filter, or (from `/shifts`) an explicit hand-picked selection; view past
  invoices; download PDF; mark sent; delete (Draft/Sent only, not Paid)
- Profile (`/profile`) — ABN/ACN, address, GST registration, bank details, HECS flag
  (drives a non-custodial tax set-aside estimate)

**Business side**
- Business details, Services, Rate cards (**multiple per business now** — different
  pay "classes" of worker), Team (invite workers, assign/reassign their rate card),
  Rates (read-only view + test-a-shift tool), Invoices received (mark paid/unpaid)
- Onboarding wizard (`/onboarding/*`) for first-time setup; `/business/*` pages for
  ongoing management after setup is complete (added this session — previously the
  only way to add a rate card or service after initial setup was a hidden onboarding URL)

**Pricing engine** (`src/lib/pricing/`) — pure, no DB/clock/network calls, thoroughly
unit-tested (`engine.test.ts`, 32 tests). Handles day-type × time-band rate resolution,
sleepover fees with included/excess active-support hours, travel, ad-hoc expenses,
flat-rate services (e.g. "Admin Hours" — one $/h rate, no day/night split), and a
rate-card-level "daily rates only" mode (single rate per day type, no time bands at all).

## Bugs fixed this session (roughly chronological)

1. "Log another shift" stuck after a successful save (form remount bug)
2. Overnight shift invoice lines didn't show the date crossed midnight
3. Daily-rate mode added (schema + wizard + engine already supported it generically)
4. Invoice header/footer rebuilt to match a Hnry reference layout; bank details/notes
   were computed but never persisted or rendered — now they are
5. PDF export added (`@react-pdf/renderer`, mirrors the HTML layout)
6. Invoice deletion; custom billing periods (optional period filter separate from
   "all pending")
7. **Invoice date off-by-one**: dates were stored anchored at midnight in the org's
   timezone but read back via the UTC calendar date of that instant — for any
   Australian (positive UTC offset) timezone this silently shifted every invoice date
   back a day. Fixed by anchoring calendar-date-only fields at UTC midnight instead.
8. Multiple rate cards per business + Team page to assign/reassign workers to them
9. Rate card deletion (blocked with a specific error if a worker is still assigned or
   shifts have history against it)
10. **Redundant per-request DB query**: root layout and nearly every page each called
    `getPrimaryAdminOrg` separately — deduped with React's `cache()`, cutting a real
    DB round trip off almost every page load
11. `/business/services` added (same gap as rate cards — no post-onboarding way to add
    a service before this)
12. **Login redirect bug**: logging in via the bare `/login` form (no `redirectTo`
    query param) defaulted to `/onboarding`, which assumes "no admin org" always means
    "you haven't set up your business yet" — true for a fresh signup, wrong for a
    worker, who'd get dumped into the business setup wizard with no explanation. Fixed
    by defaulting to `/` instead, which already routes every account type correctly.
13. My Shifts page added (see above)
14. **Invoice lines didn't show which service type they were for** — a business with
    more than one service (e.g. Personal Care + Admin Hours) got identical-looking
    lines regardless of which support each was for. Fixed by prefixing each line with
    its service name at the invoice-assembly layer (the pure pricing engine still only
    knows service types by opaque id, not name — this was deliberately NOT pushed into
    the engine).
15. **Business-only accounts saw worker nav tabs** ("Log a shift", "My Shifts", "My
    Invoices") they had no use for — confirmed by a screenshot the user sent of a real
    business profile's nav bar. Root cause: `WORKER_NAV` in `src/app/layout.tsx` was
    always rendered for any signed-in user, unlike `BUSINESS_NAV` which was already
    correctly gated on having an admin org. Fixed by adding `hasWorkerAccess()` in
    `src/lib/session.ts` (checks for an ACTIVE `Membership` with `role: 'WORKER'` —
    which only ever exists via accepting a worker invite) and gating `WORKER_NAV` on
    it, symmetric to how `BUSINESS_NAV` is gated on `adminOrg`. This was the first
    concrete evidence for open item 4 below (portal separation) — worth reading that
    item's update.

## Open items — needs the user's input, not yet resolved

1. **Business info "wrong" on an invoice** — user flagged this while reviewing a real
   invoice but hasn't said which field is actually incorrect or what it should say.
   Also worth remembering: invoices are frozen at generation time, so if they edited
   business/worker details *after* generating a given invoice, that invoice won't
   reflect the edit — they'd need to delete and regenerate it (deletion is supported).
2. **Bank details missing from a specific invoice** — very likely just means that
   worker's profile didn't have bank details saved *at the time that invoice was
   generated* (the payment section is correctly gated on `bankDetails` being present,
   verified working in a fresh test). Unconfirmed whether this is the actual cause.
3. **User may reset the production Supabase database** and re-do test data from
   scratch — mentioned but not yet asked for help executing. If asked again, the
   TRUNCATE script used earlier this session covered: `AuditLog, OnboardingState,
   InvoiceLine, Invoice, Timesheet, Shift, Participant, TravelConfig,
   SleepoverConfig, RateLine, TimeBand, RateCard, ServiceType, Engagement,
   WorkerProfile, Membership, Organisation, User` with `CASCADE` — deliberately
   leaves `PublicHoliday`/`NdisPriceLimit` (seeded reference data) untouched.
4. **Portal separation question** — user asked whether business and worker should be
   split into two separate portals/apps (inspired by Hnry). My recommendation, given
   but not agreed to or actioned: don't split the deployment — the existing
   single-codebase, role-gated nav already fully separates the experience for any
   real single-role user; what reads as clutter is from testing one account as both
   roles. Hnry isn't a fair comparison since their "business" side is a passive
   invoice recipient, not an active participant configuring rates/rosters like this
   app's businesses are.
   **Update**: that recommendation assumed the nav gating actually worked — it
   didn't. The user then sent a screenshot of a real business-profile account's nav
   bar showing worker tabs ("Log a shift", "My Shifts", "My Invoices") alongside the
   business tabs. Root cause was a real bug (see bugs-fixed item 15): `WORKER_NAV`
   was unconditionally rendered for every signed-in user, never actually gated the
   way `BUSINESS_NAV` was — so a business-only account really was seeing tabs it had
   no use for, not just an artifact of dual-role test accounts. That's now fixed. The
   underlying architecture question (one app vs. two) is still open and still worth
   the user's input, but re-evaluate it against the *fixed* nav, not the screenshot
   that prompted this — a lot of the "clutter" evidence is gone now.
5. **Rosters** — user mentioned businesses may need to plan/roster shifts in advance
   (forward-looking scheduling), distinct from the current after-the-fact shift
   logging. Raised in passing, not scoped or discussed further — a real potential
   feature if the user wants to pursue it.

## Working conventions established this session (worth keeping)

- Every DB schema change: additive-only migration via
  `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script`
  written into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then
  `prisma migrate deploy` (not `migrate dev`, which needs interactive confirmation
  unavailable in this sandbox).
- Server actions that serve multiple contexts (onboarding wizard vs later management)
  take a `mode` parameter rather than being duplicated — see `saveRateCardAction`,
  `saveServiceTypesAction`, `saveShiftAction` for the pattern.
- Shared, reused UI (RateCardForm, ServicesForm, InviteForm) lives in `src/components/`,
  not nested under whichever route first needed it.
- Before trusting a claim about "why is X slow/broken", verify against the actual
  code/logs rather than guessing — several issues this session (date bug, login
  redirect bug, redundant queries) were found this way, not by speculation.
- Playwright E2E scripts are written ad hoc per feature in the scratchpad
  (`/tmp/.../scratchpad/*.js`) using `/opt/pw-browsers/chromium` and
  `NODE_PATH=/opt/node22/lib/node_modules node <script>.js` (or the sandbox's own
  node_modules if playwright happens to be installed there) — not committed to the repo.
