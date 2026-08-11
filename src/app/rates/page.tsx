'use client';

import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { DEMO_HOLIDAYS, DEMO_ORG, DEMO_RATE_CARD, DEMO_SERVICE_ID } from '@/lib/demo-data';
import { priceShift } from '@/lib/pricing/engine';
import { formatCents } from '@/lib/pricing/money';
import type { DayType } from '@/lib/pricing/types';

const TZ = DEMO_ORG.timezone;

const DAY_LABEL: Record<DayType, string> = {
  WEEKDAY: 'Weekday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
  PUBLIC_HOLIDAY: 'Public holiday',
};

export default function RatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rate card</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {DEMO_ORG.name}&apos;s current rates for Assistance With Self-Care Activities. Rates are
          shown against the published NDIS price limit so you can see at a glance if anything
          exceeds the cap.
        </p>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-surface-line text-xs uppercase tracking-wide text-ink-faint">
              <th className="pb-2 font-semibold">Day / band</th>
              <th className="pb-2 text-right font-semibold">Rate</th>
              <th className="pb-2 text-right font-semibold">NDIS cap</th>
              <th className="pb-2 text-right font-semibold">Of cap</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_RATE_CARD.rates.map((rate, index) => {
              const cents =
                rate.method === 'PERCENT_OF_CAP'
                  ? Math.round(((rate.capCents ?? 0) * (rate.percentOfCap ?? 0)) / 100)
                  : rate.amountCents ?? 0;
              const overCap = rate.capCents != null && cents > rate.capCents;
              return (
                <tr key={index} className="border-b border-surface-line/60">
                  <td className="py-2.5 text-ink">
                    {DAY_LABEL[rate.dayType]}
                    {rate.bandKey ? ` · ${rate.bandKey.toLowerCase()}` : ''}
                  </td>
                  <td className={`py-2.5 text-right tabular-nums font-medium ${overCap ? 'text-warn' : 'text-ink'}`}>
                    {formatCents(cents)}/h
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-ink-faint">
                    {rate.capCents != null ? `${formatCents(rate.capCents)}/h` : '—'}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-ink-faint">
                    {rate.method === 'PERCENT_OF_CAP' ? `${rate.percentOfCap}%` : overCap ? 'over cap' : '—'}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="pt-3 text-ink">Night-time sleepover</td>
              <td className="pt-3 text-right tabular-nums font-medium text-ink" colSpan={3}>
                {formatCents(DEMO_RATE_CARD.sleepover.feeCents ?? 0)} flat, 8-hour span, includes{' '}
                {DEMO_RATE_CARD.sleepover.includedActiveHours}h active support
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4 text-xs text-ink-faint">
          Rates set as a percentage of the NDIS cap update automatically whenever the price
          guide is re-imported. Flat rates are entered directly and never move on their own.
        </p>
      </section>

      <TestAShift />
    </div>
  );
}

/**
 * Lets an admin validate the rate card configuration before a single real shift is
 * logged against it — the same engine the worker's phone uses, run against sample times.
 */
function TestAShift() {
  const [start, setStart] = useState('20:00');
  const [end, setEnd] = useState('08:00');
  const [date, setDate] = useState('2026-08-07');
  const [overnight, setOvernight] = useState(true);

  const result = useMemo(() => {
    try {
      const s = DateTime.fromISO(`${date}T${start}`, { zone: TZ });
      let e = DateTime.fromISO(`${date}T${end}`, { zone: TZ });
      if (e <= s) e = e.plus({ days: 1 });
      const shiftInput = {
        startUtc: s.toUTC().toISO()!,
        endUtc: e.toUTC().toISO()!,
        timezone: TZ,
        serviceTypeId: DEMO_SERVICE_ID,
        sleepover: overnight
          ? {
              windowStartUtc: s.set({ hour: 22, minute: 0 }).toUTC().toISO()!,
              windowEndUtc: e.set({ hour: 6, minute: 0 }).toUTC().toISO()!,
            }
          : undefined,
      };
      return priceShift(shiftInput, DEMO_RATE_CARD, DEMO_HOLIDAYS);
    } catch {
      return null;
    }
  }, [start, end, date, overnight]);

  return (
    <section className="card space-y-4" aria-labelledby="test-shift">
      <div>
        <h2 id="test-shift" className="font-semibold text-ink">
          Test a shift
        </h2>
        <p className="text-sm text-ink-soft">
          Run a sample shift through this rate card before a worker relies on it.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="test-date">
            Date
          </label>
          <input id="test-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="test-start">
            Start
          </label>
          <input id="test-start" type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="test-end">
            Finish
          </label>
          <input id="test-end" type="time" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
        Overnight sleepover 10pm–6am
      </label>

      {result && (
        <div className="rounded-lg bg-surface-sunk p-4">
          <p className="text-sm text-ink-soft">Would bill</p>
          <p className="text-2xl font-bold text-ink">{formatCents(result.totalCents)}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {result.trace.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
