import React, { useState } from 'react';
import { cx } from './ui';

/** Discount is stored as a percentage; rupiah input is converted with enough precision to round-trip. */
const toPercent = (amount: number, unitPrice: number) =>
  unitPrice > 0 ? Math.min(100, Math.max(0, Math.round((amount / unitPrice) * 100 * 1e6) / 1e6)) : 0;
const toAmount = (percent: number, unitPrice: number) => Math.round((unitPrice * percent) / 100);
const fmtPercent = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(2).replace(/\.?0+$/, '').replace('.', ','));
const parseNumber = (v: string) => Number(v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

/**
 * Per-item discount, typed either as % or as rupiah per unit (diskon custom).
 * Always reports a percentage to the caller.
 */
export function DiscountInput({
  percent,
  unitPrice,
  onChange,
  warn,
  label,
  compact,
}: {
  percent: number;
  unitPrice: number;
  onChange: (percent: number) => void;
  /** Highlights the field (e.g. above the allowed maximum). */
  warn?: boolean;
  label: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [draft, setDraft] = useState<string | null>(null);

  const shown =
    draft ?? (mode === 'percent' ? fmtPercent(percent) : percent ? toAmount(percent, unitPrice).toLocaleString('id-ID') : '0');

  const commit = (text: string) => {
    if (mode === 'percent') {
      const p = Math.min(100, Math.max(0, Number(text.replace(/[^\d,.]/g, '').replace(',', '.')) || 0));
      onChange(Math.round(p * 1e6) / 1e6);
    } else {
      onChange(toPercent(Math.max(0, parseNumber(text)), unitPrice));
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label={`${label} (${mode === 'percent' ? 'persen' : 'rupiah per unit'})`}
        inputMode={mode === 'percent' ? 'decimal' : 'numeric'}
        value={shown}
        onFocus={() => setDraft(shown === '0' ? '' : shown)}
        onChange={e => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
        className={cx(
          'h-8 rounded-md border px-2 text-right text-[13px] tabular-nums focus:outline-none focus:ring-3',
          mode === 'percent' ? (compact ? 'w-14' : 'w-16') : compact ? 'w-24' : 'w-28',
          warn ? 'border-amber-400 focus:ring-amber-200' : 'border-line-strong focus:border-link focus:ring-link/15'
        )}
      />
      <span className="inline-flex overflow-hidden rounded-md border border-line-strong text-[11px] font-semibold" role="group" aria-label="Satuan diskon">
        {(['percent', 'amount'] as const).map(m => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setDraft(null);
            }}
            className={cx(
              'h-8 px-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link/30',
              mode === m ? 'bg-link text-white' : 'bg-surface text-ink-2 hover:text-ink'
            )}
          >
            {m === 'percent' ? '%' : 'Rp'}
          </button>
        ))}
      </span>
    </span>
  );
}

/** Rupiah amount input (thousand separators), for the extra discount and other money fields. */
export function RupiahInput({
  value,
  onChange,
  label,
  className,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
  max?: number;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value ? value.toLocaleString('id-ID') : ''}
      placeholder="0"
      onChange={e => {
        const n = Number(e.target.value.replace(/\D/g, '')) || 0;
        onChange(max !== undefined ? Math.min(max, n) : n);
      }}
      className={cx(
        'h-8 rounded-md border border-line-strong px-2 text-right text-[13px] tabular-nums focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15',
        className
      )}
    />
  );
}
