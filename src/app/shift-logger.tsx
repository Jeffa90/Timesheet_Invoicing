'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { saveShiftAction } from '@/lib/actions/shifts';
import { priceShift } from '@/lib/pricing/engine';
import { formatCents, formatHours } from '@/lib/pricing/money';
import type { PricingResult, PublicHolidayDef, RateCardSnapshot } from '@/lib/pricing/types';
import { EMPTY_FORM, type ShiftFormValues, buildShiftInput, todayIn } from '@/lib/shift-form';

interface ServiceTypeOption {
  id: string;
  name: string;
  /** No day/night/weekend variation, e.g. admin hours — the sleepover section is meaningless for these. */
  flatRate?: boolean;
}

interface EngagementOption {
  orgId: string;
  orgName: string;
  timezone: string;
}

/**
 * The pricing engine is pure TypeScript, so it runs here in the browser and the
 * total updates as the worker types — no round trip, and it still works offline.
 * "Save shift" re-prices the same input on the server (see actions/shifts.ts) and
 * stores that result as the authoritative one; this client figure is a preview.
 */
export function ShiftLogger({
  engagements,
  activeOrgId,
  timezone,
  serviceTypes,
  rateCard,
  holidays,
  gstRegistered,
}: {
  engagements: EngagementOption[];
  activeOrgId: string;
  timezone: string;
  serviceTypes: ServiceTypeOption[];
  rateCard: RateCardSnapshot;
  holidays: PublicHolidayDef[];
  gstRegistered: boolean;
}) {
  const [form, setForm] = useState<ShiftFormValues>(EMPTY_FORM);
  const [serviceTypeId, setServiceTypeId] = useState(serviceTypes[0]?.id ?? '');
  const [saveState, formAction, pending] = useActionState(saveShiftAction, {});

  const selectedServiceType = serviceTypes.find((s) => s.id === serviceTypeId);

  useEffect(() => {
    setForm((f) => (f.date ? f : { ...f, date: todayIn(timezone) }));
  }, [timezone]);

  // A flat-rate service type (e.g. admin hours) has no sleepover concept —
  // force the toggle off so switching into one never carries a stale window.
  useEffect(() => {
    if (selectedServiceType?.flatRate) setForm((f) => (f.isOvernight ? { ...f, isOvernight: false } : f));
  }, [selectedServiceType?.flatRate]);

  const { result, error } = useMemo(() => {
    if (!form.date || !serviceTypeId) return { result: null, error: null };
    try {
      const shift = buildShiftInput(form, timezone, serviceTypeId, gstRegistered);
      return { result: priceShift(shift, rateCard, holidays), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Something went wrong.' };
    }
  }, [form, serviceTypeId, timezone, gstRegistered, rateCard, holidays]);

  const set = <K extends keyof ShiftFormValues>(key: K, value: ShiftFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (serviceTypes.length === 0) {
    return (
      <p className="rounded-lg bg-warnbg px-4 py-3 text-sm text-warn">
        {engagements.find((e) => e.orgId === activeOrgId)?.orgName ?? 'This business'} hasn&apos;t set up any
        services yet, so there&apos;s nothing to log a shift against.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log a shift</h1>
          <p className="mt-1 text-sm text-ink-soft">
            For {engagements.find((e) => e.orgId === activeOrgId)?.orgName}. Overnight rates, the
            sleepover fee and weekend loadings are worked out for you.
          </p>
        </div>

        <section className="card space-y-4" aria-labelledby="when">
          <h2 id="when" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            When did you work?
          </h2>

          {serviceTypes.length > 1 && (
            <div>
              <label className="label" htmlFor="serviceType">
                Support
              </label>
              <select
                id="serviceType"
                className="field"
                value={serviceTypeId}
                onChange={(e) => setServiceTypeId(e.target.value)}
              >
                {serviceTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="date">
              Shift date
            </label>
            <input
              id="date"
              type="date"
              className="field"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="startTime">
                Started
              </label>
              <input
                id="startTime"
                type="time"
                className="field"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="endTime">
                Finished
              </label>
              <input
                id="endTime"
                type="time"
                className="field"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-faint">
                Earlier than the start time means the next morning.
              </p>
            </div>
          </div>
        </section>

        {!selectedServiceType?.flatRate && (
          <section className="card space-y-4" aria-labelledby="overnight">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="overnight" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                  Overnight sleepover
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Hourly billing stops when the sleepover starts and picks up again when it ends.
                </p>
              </div>
              <Toggle label="Overnight sleepover" checked={form.isOvernight} onChange={(v) => set('isOvernight', v)} />
            </div>

            {form.isOvernight && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="sleepStart">
                      Hourly billing stops
                    </label>
                    <input
                      id="sleepStart"
                      type="time"
                      className="field"
                      value={form.sleepoverStart}
                      onChange={(e) => set('sleepoverStart', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="sleepEnd">
                      Hourly billing resumes
                    </label>
                    <input
                      id="sleepEnd"
                      type="time"
                      className="field"
                      value={form.sleepoverEnd}
                      onChange={(e) => set('sleepoverEnd', e.target.value)}
                    />
                  </div>
                </div>

                <fieldset className="rounded-lg bg-surface-sunk p-3">
                  <legend className="px-1 text-sm font-medium text-ink-soft">Woken to provide support?</legend>
                  <p className="mb-3 px-1 text-xs text-ink-faint">
                    The first {formatHours(rateCard.sleepover.includedActiveHours)} are already covered by the
                    sleepover fee. Anything beyond that bills on top.
                  </p>

                  <div className="space-y-2">
                    {form.activeSupport.map((period, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="time"
                          aria-label={`Active support ${index + 1} start`}
                          className="field"
                          value={period.start}
                          onChange={(e) => {
                            const next = [...form.activeSupport];
                            next[index] = { ...next[index], start: e.target.value };
                            set('activeSupport', next);
                          }}
                        />
                        <span aria-hidden className="text-ink-faint">
                          –
                        </span>
                        <input
                          type="time"
                          aria-label={`Active support ${index + 1} end`}
                          className="field"
                          value={period.end}
                          onChange={(e) => {
                            const next = [...form.activeSupport];
                            next[index] = { ...next[index], end: e.target.value };
                            set('activeSupport', next);
                          }}
                        />
                        <button
                          type="button"
                          className="btn-ghost px-3"
                          onClick={() => set('activeSupport', form.activeSupport.filter((_, i) => i !== index))}
                        >
                          <span className="sr-only">Remove period {index + 1}</span>
                          <span aria-hidden>×</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-ghost mt-2 w-full"
                    onClick={() => set('activeSupport', [...form.activeSupport, { start: '01:00', end: '02:00' }])}
                  >
                    + Add a period
                  </button>
                </fieldset>
              </>
            )}
          </section>
        )}

        <section className="card space-y-4" aria-labelledby="extras">
          <h2 id="extras" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Breaks and travel
          </h2>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">Unpaid break</span>
            <Toggle label="Unpaid break" checked={form.hasUnpaidBreak} onChange={(v) => set('hasUnpaidBreak', v)} />
          </div>

          {form.hasUnpaidBreak && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="breakStart">
                  Break started
                </label>
                <input
                  id="breakStart"
                  type="time"
                  className="field"
                  value={form.breakStart}
                  onChange={(e) => set('breakStart', e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="breakMinutes">
                  Minutes
                </label>
                <input
                  id="breakMinutes"
                  type="number"
                  min={0}
                  step={5}
                  className="field"
                  value={form.breakMinutes}
                  onChange={(e) => set('breakMinutes', Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="travelKm">
              Travel (km)
            </label>
            <input
              id="travelKm"
              type="number"
              min={0}
              step={1}
              className="field"
              value={form.travelKm}
              onChange={(e) => set('travelKm', Number(e.target.value))}
            />
          </div>
        </section>

        <section className="card space-y-3" aria-labelledby="expenses">
          <h2 id="expenses" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Other expenses
          </h2>
          <p className="text-sm text-ink-soft">
            Anything else to bill for this shift — supplies, parking, activity costs.
          </p>

          <div className="space-y-2">
            {form.expenses.map((expense, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`Expense ${index + 1} description`}
                  placeholder="Description"
                  className="field min-w-0 flex-1"
                  value={expense.description}
                  onChange={(e) => {
                    const next = [...form.expenses];
                    next[index] = { ...next[index], description: e.target.value };
                    set('expenses', next);
                  }}
                />
                <MoneyInput
                  ariaLabel={`Expense ${index + 1} amount`}
                  className="field w-24 shrink-0"
                  cents={expense.amountCents || null}
                  onChangeCents={(cents) => {
                    const next = [...form.expenses];
                    next[index] = { ...next[index], amountCents: cents ?? 0 };
                    set('expenses', next);
                  }}
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
                  <input
                    type="checkbox"
                    checked={expense.gstApplicable}
                    onChange={(e) => {
                      const next = [...form.expenses];
                      next[index] = { ...next[index], gstApplicable: e.target.checked };
                      set('expenses', next);
                    }}
                  />
                  GST
                </label>
                <button
                  type="button"
                  className="btn-ghost px-3"
                  onClick={() => set('expenses', form.expenses.filter((_, i) => i !== index))}
                >
                  <span className="sr-only">Remove expense {index + 1}</span>
                  <span aria-hidden>×</span>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => set('expenses', [...form.expenses, { description: '', amountCents: 0, gstApplicable: false }])}
          >
            + Add an expense
          </button>
        </section>
      </div>

      <Breakdown
        result={result}
        error={error}
        formAction={formAction}
        pending={pending}
        saveState={saveState}
        hiddenFields={{
          orgId: activeOrgId,
          serviceTypeId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          hasUnpaidBreak: String(form.hasUnpaidBreak),
          breakStart: form.breakStart,
          breakMinutes: String(form.breakMinutes),
          isOvernight: String(form.isOvernight),
          sleepoverStart: form.sleepoverStart,
          sleepoverEnd: form.sleepoverEnd,
          activeSupport: JSON.stringify(form.activeSupport),
          travelKm: String(form.travelKm),
          expenses: JSON.stringify(form.expenses),
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Breakdown({
  result,
  error,
  formAction,
  pending,
  saveState,
  hiddenFields,
}: {
  result: PricingResult | null;
  error: string | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
  saveState: { error?: string; savedShiftId?: string; totalCents?: number };
  hiddenFields: Record<string, string>;
}) {
  return (
    <aside className="sticky bottom-0 lg:top-6 lg:bottom-auto" aria-live="polite" aria-label="What you will bill">
      <form action={formAction} className="card space-y-4">
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <div>
          <p className="text-sm font-medium text-ink-soft">You&apos;ll bill</p>
          <p className="text-3xl font-bold tracking-tight text-ink">
            {result ? formatCents(result.totalCents) : '—'}
          </p>
          {result && (
            <p className="text-sm text-ink-faint">
              {formatHours(result.billableHours)} billed hourly
              {result.gstCents > 0 && ` · includes ${formatCents(result.gstCents)} GST`}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {error}
          </p>
        )}

        {result && result.lines.length > 0 && (
          <div className="space-y-2 border-t border-surface-line pt-4">
            {result.lines.map((line, index) => (
              <div key={index} className="flex items-baseline justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{line.description}</p>
                  <p className="text-xs text-ink-faint">
                    {line.unit === 'NIGHT' || line.unit === 'EACH'
                      ? 'Flat fee'
                      : line.unit === 'KM'
                        ? `${line.quantity}km × ${formatCents(line.unitRateCents)}/km`
                        : `${formatHours(line.quantity)} × ${formatCents(line.unitRateCents)}/h`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatCents(line.amountCents)}</span>
              </div>
            ))}
          </div>
        )}

        {result && result.warnings.length > 0 && (
          <ul className="space-y-2 border-t border-surface-line pt-4">
            {result.warnings.map((warning, index) => (
              <li key={index} className="rounded-lg bg-warnbg px-3 py-2 text-xs text-warn">
                {warning.message}
              </li>
            ))}
          </ul>
        )}

        {saveState.error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {saveState.error}
          </p>
        )}

        {saveState.savedShiftId ? (
          <div className="rounded-lg bg-good/10 px-3 py-3 text-sm text-good">
            Shift saved — {formatCents(saveState.totalCents ?? 0)} added to your pending invoice.{' '}
            <Link href="/invoice" className="font-semibold underline">
              Go to invoicing
            </Link>
          </div>
        ) : (
          <button type="submit" className="btn-primary w-full" disabled={!result || pending}>
            {pending ? 'Saving…' : 'Save shift'}
          </button>
        )}
      </form>
    </aside>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-surface-line'}`}
      style={{ minHeight: '1.75rem' }}
    >
      <span
        aria-hidden
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`}
      />
    </button>
  );
}
