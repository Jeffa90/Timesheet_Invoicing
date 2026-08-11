'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEMO_HOLIDAYS,
  DEMO_ORG,
  DEMO_RATE_CARD,
  DEMO_SERVICE_ID,
} from '@/lib/demo-data';
import { priceShift } from '@/lib/pricing/engine';
import { formatCents, formatHours } from '@/lib/pricing/money';
import type { PricingResult } from '@/lib/pricing/types';
import { EMPTY_FORM, type ShiftFormValues, buildShiftInput, todayIn } from '@/lib/shift-form';

const TZ = DEMO_ORG.timezone;

/**
 * The pricing engine is pure TypeScript, so it runs here in the browser and the
 * total updates as the worker types — no round trip, and it still works offline.
 * On save the server re-prices the same shift and stores that result as the
 * authoritative one; the client figure is a preview, never the source of truth.
 */
export default function LogShiftPage() {
  const [form, setForm] = useState<ShiftFormValues>(EMPTY_FORM);

  // Set the date after mount so the server and client render the same initial HTML.
  useEffect(() => {
    setForm((f) => (f.date ? f : { ...f, date: todayIn(TZ) }));
  }, []);

  const { result, error } = useMemo(() => {
    if (!form.date) return { result: null, error: null };
    try {
      const shift = buildShiftInput(form, TZ, DEMO_SERVICE_ID);
      return { result: priceShift(shift, DEMO_RATE_CARD, DEMO_HOLIDAYS), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Something went wrong.' };
    }
  }, [form]);

  const set = <K extends keyof ShiftFormValues>(key: K, value: ShiftFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log a shift</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Enter when you started and finished. Overnight rates, the sleepover fee and
            weekend loadings are worked out for you.
          </p>
        </div>

        <section className="card space-y-4" aria-labelledby="when">
          <h2 id="when" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            When did you work?
          </h2>

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
            <Toggle
              label="Overnight sleepover"
              checked={form.isOvernight}
              onChange={(v) => set('isOvernight', v)}
            />
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
                <legend className="px-1 text-sm font-medium text-ink-soft">
                  Woken to provide support?
                </legend>
                <p className="mb-3 px-1 text-xs text-ink-faint">
                  The first {formatHours(DEMO_RATE_CARD.sleepover.includedActiveHours)} are already
                  covered by the sleepover fee. Anything beyond that bills on top.
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
                        onClick={() =>
                          set(
                            'activeSupport',
                            form.activeSupport.filter((_, i) => i !== index),
                          )
                        }
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
                  onClick={() =>
                    set('activeSupport', [...form.activeSupport, { start: '01:00', end: '02:00' }])
                  }
                >
                  + Add a period
                </button>
              </fieldset>
            </>
          )}
        </section>

        <section className="card space-y-4" aria-labelledby="extras">
          <h2 id="extras" className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Breaks and travel
          </h2>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">Unpaid break</span>
            <Toggle
              label="Unpaid break"
              checked={form.hasUnpaidBreak}
              onChange={(v) => set('hasUnpaidBreak', v)}
            />
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
      </div>

      <Breakdown result={result} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Breakdown({ result, error }: { result: PricingResult | null; error: string | null }) {
  return (
    <aside
      className="sticky bottom-0 lg:top-6 lg:bottom-auto"
      aria-live="polite"
      aria-label="What you will bill"
    >
      <div className="card space-y-4">
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
                    {line.unit === 'NIGHT'
                      ? 'Flat fee'
                      : line.unit === 'KM'
                        ? `${line.quantity}km × ${formatCents(line.unitRateCents)}/km`
                        : `${formatHours(line.quantity)} × ${formatCents(line.unitRateCents)}/h`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCents(line.amountCents)}
                </span>
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

        <button type="button" className="btn-primary w-full" disabled={!result}>
          Save shift
        </button>
        <p className="text-center text-xs text-ink-faint">
          Saving is wired up when the database is attached — see the README.
        </p>
      </div>
    </aside>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-brand-600' : 'bg-surface-line'
      }`}
      style={{ minHeight: '1.75rem' }}
    >
      <span
        aria-hidden
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
}
