import React from 'react';
import { Plus, X } from 'lucide-react';
import type { ChargeKind } from '../types';
import type { ChargeInput } from '../backend';
import { formatRupiah } from '../utils/quotationEngine';
import { RupiahInput } from './DiscountInput';
import { cx } from './ui';

export const CHARGE_KIND_LABEL: Record<ChargeKind, string> = {
  INSTALL: 'Jasa pasang',
  SHIPPING: 'Ongkos kirim',
  OTHER: 'Biaya lain',
};

export const chargesTotal = (charges: ChargeInput[] | undefined) => (charges ?? []).reduce((s, c) => s + (c.amount || 0), 0);

/**
 * Additional charges outside the catalog (R6): jasa pasang, ongkir, lainnya.
 * Subject to PPN, not discounted. Empty rows are ignored when saving.
 */
export function ChargesEditor({
  charges,
  onChange,
  readOnly,
}: {
  charges: ChargeInput[];
  onChange: (c: ChargeInput[]) => void;
  readOnly?: boolean;
}) {
  const set = (i: number, p: Partial<ChargeInput>) => onChange(charges.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  if (readOnly) {
    if (!charges.length) return <p className="text-xs text-ink-3">Tidak ada biaya tambahan.</p>;
    return (
      <ul className="space-y-1 text-[13px]">
        {charges.map((c, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="text-ink-2">{c.label || CHARGE_KIND_LABEL[c.kind]}</span>
            <span className="tabular-nums">{formatRupiah(c.amount)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {charges.map((c, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-lg border border-line p-2">
          <div className="flex min-w-0 gap-1.5">
            <select
              aria-label="Jenis biaya"
              value={c.kind}
              onChange={e => {
                const kind = e.target.value as ChargeKind;
                const wasDefault = !c.label || Object.values(CHARGE_KIND_LABEL).includes(c.label);
                set(i, { kind, label: wasDefault ? (kind === 'OTHER' ? '' : CHARGE_KIND_LABEL[kind]) : c.label });
              }}
              className="h-8 shrink-0 rounded-md border border-line-strong bg-surface px-1.5 text-xs focus:border-link focus:outline-none"
            >
              {(Object.keys(CHARGE_KIND_LABEL) as ChargeKind[]).map(k => (
                <option key={k} value={k}>
                  {CHARGE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              aria-label="Keterangan biaya"
              value={c.label}
              placeholder="Keterangan, mis. Ongkir ke Bandung"
              onChange={e => set(i, { label: e.target.value })}
              className={cx(
                'h-8 min-w-0 flex-1 rounded-md border bg-surface px-2 text-xs focus:border-link focus:outline-none',
                !c.label.trim() && c.amount > 0 ? 'border-amber-400' : 'border-line-strong'
              )}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(charges.filter((_, idx) => idx !== i))}
            className="row-span-2 self-start rounded p-1 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
            aria-label="Hapus biaya"
          >
            <X className="size-4" />
          </button>
          <RupiahInput label={`Jumlah ${c.label || CHARGE_KIND_LABEL[c.kind]}`} value={c.amount} onChange={amount => set(i, { amount })} className="w-full" />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...charges, { kind: 'INSTALL', label: CHARGE_KIND_LABEL.INSTALL, amount: 0 }])}
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-link hover:text-link-strong cursor-pointer"
      >
        <Plus className="size-3.5" /> Tambah biaya (jasa pasang, ongkir, …)
      </button>
    </div>
  );
}

/** Rows worth saving: a label and a positive amount. */
export const cleanCharges = (charges: ChargeInput[]) =>
  charges.filter(c => c.amount > 0 && c.label.trim()).map(c => ({ ...c, label: c.label.trim() }));
