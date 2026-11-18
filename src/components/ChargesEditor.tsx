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
            <span className="tabular-nums">{c.amount > 0 ? formatRupiah(c.amount) : 'Termasuk'}</span>
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
            className="row-span-3 self-start rounded p-1 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
            aria-label="Hapus biaya"
          >
            <X className="size-4" />
          </button>
          <input
            aria-label={`Rincian ${c.label || CHARGE_KIND_LABEL[c.kind]}`}
            value={c.description ?? ''}
            placeholder="Rincian (opsional), mis. Videotron, panel, dan perapian kabel"
            onChange={e => set(i, { description: e.target.value })}
            className="h-8 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-xs focus:border-link focus:outline-none"
          />
          <div className="flex items-center gap-3">
            {c.included ? (
              <span className="flex h-9 flex-1 items-center rounded-md bg-canvas px-2.5 text-xs font-medium text-ink-2">Dicetak "Termasuk"</span>
            ) : (
              <RupiahInput label={`Jumlah ${c.label || CHARGE_KIND_LABEL[c.kind]}`} value={c.amount} onChange={amount => set(i, { amount })} className="min-w-0 flex-1" />
            )}
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-link)]"
                checked={!!c.included}
                onChange={e => set(i, { included: e.target.checked, amount: e.target.checked ? 0 : c.amount })}
              />
              Termasuk
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...charges, { kind: 'INSTALL', label: CHARGE_KIND_LABEL.INSTALL, amount: 0 }])}
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-link hover:text-link-strong cursor-pointer"
      >
        <Plus className="size-3.5" /> Tambah jasa/biaya (pasang, kirim, testing, …)
      </button>
    </div>
  );
}

/** Rows worth saving: a label and a positive amount, or marked "Termasuk" (0). */
export const cleanCharges = (charges: ChargeInput[]): ChargeInput[] =>
  charges
    .filter(c => c.label.trim() && (c.amount > 0 || c.included))
    .map(c => ({
      kind: c.kind,
      label: c.label.trim(),
      amount: c.included ? 0 : c.amount,
      ...(c.description?.trim() ? { description: c.description.trim() } : {}),
    }));

/** Saved charges into editor rows (0 = Termasuk). */
export const chargeRows = (charges: { kind: ChargeInput['kind']; label: string; amount: number; description?: string }[] | undefined): ChargeInput[] =>
  (charges ?? []).map(c => ({ kind: c.kind, label: c.label, amount: c.amount, description: c.description, included: c.amount === 0 }));
