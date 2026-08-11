'use client';

import { useActionState, useMemo, useState } from 'react';
import { saveRateCardAction } from '@/lib/actions/rate-card';
import { formatCents } from '@/lib/pricing/money';
import { MoneyInput } from './money-input';

export type DayType = 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'PUBLIC_HOLIDAY';
export type BandKey = 'DAY' | 'EVENING' | 'NIGHT';

export interface RateLineValue {
  serviceTypeId: string;
  serviceTypeName: string;
  dayType: DayType;
  bandKey: BandKey | null;
  method: 'ABSOLUTE' | 'PERCENT_OF_CAP';
  amountCents: number | null;
  percentOfCap: number | null;
  capCents: number | null;
}

interface SleepoverValue {
  enabled: boolean;
  spanHours: number;
  feeMethod: 'ABSOLUTE' | 'PERCENT_OF_CAP';
  feeCents: number | null;
  feePercentOfCap: number | null;
  feeCapCents: number | null;
  includedActiveHours: number;
  excessActiveDayType: DayType | 'PREVAILING';
  gstApplicable: boolean;
}

interface TravelValue {
  perKmCents: number;
  maxKmPerShift: number | null;
  travelTimeMode: 'NONE' | 'PREVAILING' | 'FLAT';
  travelTimeFlatCentsPerHr: number | null;
  gstApplicable: boolean;
}

interface Defaults {
  name: string;
  classificationStrategy: 'SEGMENTED' | 'SHIFT_START' | 'MAJORITY';
  roundingIncrementMin: number;
  roundingMode: 'NEAREST' | 'UP' | 'DOWN';
  minimumEngagementMin: number;
  sleepover: SleepoverValue;
  travel: TravelValue;
}

const DIM_LABEL: Record<string, string> = {
  'WEEKDAY:DAY': 'Weekday · daytime (6am–8pm)',
  'WEEKDAY:EVENING': 'Weekday · evening (8pm–midnight)',
  'WEEKDAY:NIGHT': 'Weekday · night (midnight–6am)',
  'SATURDAY:null': 'Saturday (all day)',
  'SUNDAY:null': 'Sunday (all day)',
  'PUBLIC_HOLIDAY:null': 'Public holiday (all day)',
};

export function RateCardForm({ rateLines, defaults }: { rateLines: RateLineValue[]; defaults: Defaults }) {
  const [lines, setLines] = useState(rateLines);
  const [meta, setMeta] = useState(defaults);
  const [state, formAction, pending] = useActionState(saveRateCardAction, {});

  const byService = useMemo(() => {
    const map = new Map<string, { name: string; rows: { line: RateLineValue; index: number }[] }>();
    lines.forEach((line, index) => {
      const entry = map.get(line.serviceTypeId) ?? { name: line.serviceTypeName, rows: [] };
      entry.rows.push({ line, index });
      map.set(line.serviceTypeId, entry);
    });
    return map;
  }, [lines]);

  const updateLine = (index: number, patch: Partial<RateLineValue>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const payload = JSON.stringify({
    ...meta,
    rateLines: lines.map(({ serviceTypeName: _serviceTypeName, ...rest }) => rest),
    sleepover: meta.sleepover,
    travel: meta.travel,
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="rateCard" value={payload} readOnly />

      <div className="card space-y-3">
        <label className="label" htmlFor="cardName">
          Rate card name
        </label>
        <input
          id="cardName"
          className="field"
          value={meta.name}
          onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
        />
      </div>

      {[...byService.entries()].map(([serviceTypeId, { name, rows }]) => (
        <section key={serviceTypeId} className="card space-y-3">
          <h2 className="font-semibold text-ink">{name}</h2>
          <div className="space-y-2">
            {rows.map(({ line, index }) => (
              <div key={index} className="grid grid-cols-[1fr_auto_7rem] items-center gap-2 sm:grid-cols-[1fr_auto_7rem_6rem]">
                <span className="text-sm text-ink-soft">{DIM_LABEL[`${line.dayType}:${line.bandKey}`]}</span>

                <select
                  aria-label={`Rate method for ${DIM_LABEL[`${line.dayType}:${line.bandKey}`]}`}
                  className="field !min-h-0 py-1.5 text-sm"
                  value={line.method}
                  onChange={(e) => updateLine(index, { method: e.target.value as RateLineValue['method'] })}
                >
                  <option value="ABSOLUTE">Flat $/h</option>
                  <option value="PERCENT_OF_CAP" disabled={line.capCents == null}>
                    % of NDIS cap
                  </option>
                </select>

                {line.method === 'ABSOLUTE' ? (
                  <MoneyInput
                    ariaLabel="Dollars per hour"
                    className="field !min-h-0 py-1.5 text-sm"
                    cents={line.amountCents}
                    onChangeCents={(cents) => updateLine(index, { amountCents: cents })}
                  />
                ) : (
                  <input
                    aria-label="Percent of NDIS cap"
                    type="number"
                    step="1"
                    min={0}
                    max={200}
                    className="field !min-h-0 py-1.5 text-sm"
                    value={line.percentOfCap ?? ''}
                    onChange={(e) => updateLine(index, { percentOfCap: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                )}

                <span className="hidden text-xs text-ink-faint sm:block">
                  {line.capCents != null ? `cap ${formatCents(line.capCents)}/h` : 'no cap on file'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card space-y-3">
        <h2 className="font-semibold text-ink">Night-time sleepover</h2>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={meta.sleepover.enabled}
            onChange={(e) => setMeta((m) => ({ ...m, sleepover: { ...m.sleepover, enabled: e.target.checked } }))}
          />
          We use sleepover shifts
        </label>

        {meta.sleepover.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="sleepFeeMethod">
                  Fee
                </label>
                <select
                  id="sleepFeeMethod"
                  className="field"
                  value={meta.sleepover.feeMethod}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, sleepover: { ...m.sleepover, feeMethod: e.target.value as 'ABSOLUTE' | 'PERCENT_OF_CAP' } }))
                  }
                >
                  <option value="ABSOLUTE">Flat $</option>
                  <option value="PERCENT_OF_CAP" disabled={meta.sleepover.feeCapCents == null}>
                    % of NDIS cap
                  </option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sleepFeeAmount">
                  {meta.sleepover.feeMethod === 'ABSOLUTE' ? 'Amount ($)' : 'Percent of cap'}
                </label>
                {meta.sleepover.feeMethod === 'ABSOLUTE' ? (
                  <MoneyInput
                    id="sleepFeeAmount"
                    className="field"
                    cents={meta.sleepover.feeCents}
                    onChangeCents={(cents) => setMeta((m) => ({ ...m, sleepover: { ...m.sleepover, feeCents: cents } }))}
                  />
                ) : (
                  <input
                    id="sleepFeeAmount"
                    type="number"
                    step="1"
                    min={0}
                    className="field"
                    value={meta.sleepover.feePercentOfCap ?? ''}
                    onChange={(e) =>
                      setMeta((m) => ({
                        ...m,
                        sleepover: { ...m.sleepover, feePercentOfCap: e.target.value === '' ? null : Number(e.target.value) },
                      }))
                    }
                  />
                )}
              </div>
            </div>
            {meta.sleepover.feeCapCents == null && meta.sleepover.feeMethod === 'ABSOLUTE' && (
              <p className="text-xs text-ink-faint">
                We don&apos;t have the current NDIS sleepover cap on file — check it against the latest Pricing
                Arrangements and Price Limits before relying on this figure.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="includedActive">
                  Active support included (hours)
                </label>
                <input
                  id="includedActive"
                  type="number"
                  step="0.5"
                  min={0}
                  max={8}
                  className="field"
                  value={meta.sleepover.includedActiveHours}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, sleepover: { ...m.sleepover, includedActiveHours: Number(e.target.value) } }))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="excessDayType">
                  Excess active support billed at
                </label>
                <select
                  id="excessDayType"
                  className="field"
                  value={meta.sleepover.excessActiveDayType}
                  onChange={(e) =>
                    setMeta((m) => ({
                      ...m,
                      sleepover: { ...m.sleepover, excessActiveDayType: e.target.value as SleepoverValue['excessActiveDayType'] },
                    }))
                  }
                >
                  <option value="SATURDAY">Saturday rate</option>
                  <option value="PREVAILING">Whatever the clock shows</option>
                  <option value="WEEKDAY">Weekday rate</option>
                  <option value="SUNDAY">Sunday rate</option>
                  <option value="PUBLIC_HOLIDAY">Public holiday rate</option>
                </select>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-ink">Travel</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="perKm">
              Per kilometre ($)
            </label>
            <MoneyInput
              id="perKm"
              className="field"
              cents={meta.travel.perKmCents}
              onChangeCents={(cents) => setMeta((m) => ({ ...m, travel: { ...m.travel, perKmCents: cents ?? 0 } }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="maxKm">
              Max km per shift (blank = no limit)
            </label>
            <input
              id="maxKm"
              type="number"
              min={0}
              className="field"
              value={meta.travel.maxKmPerShift ?? ''}
              onChange={(e) =>
                setMeta((m) => ({ ...m, travel: { ...m.travel, maxKmPerShift: e.target.value === '' ? null : Number(e.target.value) } }))
              }
            />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-ink">Timesheet rules</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="minEngagement">
              Minimum engagement (minutes)
            </label>
            <input
              id="minEngagement"
              type="number"
              min={0}
              className="field"
              value={meta.minimumEngagementMin}
              onChange={(e) => setMeta((m) => ({ ...m, minimumEngagementMin: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rounding">
              Round durations to
            </label>
            <select
              id="rounding"
              className="field"
              value={meta.roundingIncrementMin}
              onChange={(e) => setMeta((m) => ({ ...m, roundingIncrementMin: Number(e.target.value) }))}
            >
              <option value={1}>The minute</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>
        </div>
      </section>

      {state.error && (
        <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
