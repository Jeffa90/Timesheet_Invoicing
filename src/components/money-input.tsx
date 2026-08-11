'use client';

import { useState } from 'react';

function centsToText(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}

function textToCents(text: string): number | null {
  const n = Number(text);
  return text.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100);
}

/**
 * A dollar-figure input backed by cents.
 *
 * Naively deriving the displayed string from `cents` on every render (via
 * `value={(cents / 100).toFixed(2)}`) steals the cursor: typing "7" instantly
 * reformats to "7.00", the cursor snaps to the end, and the next digit lands
 * in the wrong place. Instead this owns its own typed text — the parent's
 * `cents` value is only ever written to, never read back into the display —
 * and only snaps to a clean two-decimal format on blur, once the cursor
 * position no longer matters.
 */
export function MoneyInput({
  id,
  ariaLabel,
  cents,
  onChangeCents,
  className,
}: {
  id?: string;
  ariaLabel?: string;
  cents: number | null;
  onChangeCents: (cents: number | null) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => centsToText(cents));

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="number"
      step="0.01"
      min={0}
      className={className}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChangeCents(textToCents(e.target.value));
      }}
      onBlur={() => setText(centsToText(textToCents(text)))}
    />
  );
}
