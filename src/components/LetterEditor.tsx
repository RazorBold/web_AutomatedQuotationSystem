import React, { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { DiscountMode, LetterSettings, PaymentTerm, TaxMode } from '../types';
import { defaultBank } from '../utils/letter';
import { useStore } from '../store/AppStore';
import { cx } from './ui';

const TAX_OPTIONS: { value: TaxMode; label: string; hint: string }[] = [
  { value: 'ADDED', label: 'PPN 11% dipisah', hint: 'Total, PPN 11%, Grand Total' },
  { value: 'INCLUDED', label: 'Harga sudah termasuk PPN', hint: 'Baris PPN tidak dicetak' },
  { value: 'EXCLUDED', label: 'Harga belum termasuk PPN', hint: 'Tanpa PPN sama sekali' },
];

const DISCOUNT_OPTIONS: { value: DiscountMode; label: string }[] = [
  { value: 'PERCENT', label: 'Persen' },
  { value: 'AMOUNT', label: 'Rupiah' },
  { value: 'HIDDEN', label: 'Sembunyikan' },
];

/** Total of the payment terms; the letter needs exactly 100%. */
export const paymentTotal = (p: PaymentTerm[]) => p.reduce((s, x) => s + (Number(x.percent) || 0), 0);

/** Problems that block saving, in plain words. */
export function letterProblems(l: LetterSettings): string[] {
  const out: string[] = [];
  const pay = l.paymentTerms.filter(p => p.label.trim() || p.percent);
  if (pay.some(p => !p.label.trim() || !(p.percent > 0))) out.push('Lengkapi keterangan dan persen setiap termin pembayaran.');
  else if (pay.length && paymentTotal(pay) !== 100) out.push(`Total termin pembayaran harus 100% (sekarang ${paymentTotal(pay)}%).`);
  return out;
}

/** What is saved: blank terms and empty payment rows dropped. */
export const cleanLetter = (l: LetterSettings): LetterSettings => ({
  ...l,
  terms: l.terms.map(t => t.trim()).filter(Boolean),
  paymentTerms: l.paymentTerms.filter(p => p.label.trim() || p.percent).map(p => ({ label: p.label.trim(), percent: Number(p.percent) || 0 })),
});

/**
 * "Format surat": how PPN and discounts appear, the Keterangan lines and the payment terms (DP).
 * Used by Sales when drafting and by Sales Support at review.
 */
export function LetterEditor({ value, onChange }: { value: LetterSettings; onChange: (v: LetterSettings) => void }) {
  const id = useId();
  const { settings } = useStore();
  const TERM_SUGGESTIONS = settings.templates.suggestions;
  const PAYMENT_PRESETS = settings.templates.paymentPresets;
  const banks = settings.banks;
  const fallbackBank = defaultBank(banks);
  // A copy on the letter that is no longer in the list still shows (and stays selectable).
  const bankOptions = value.bank && !banks.some(b => b.id === value.bank!.id) ? [...banks, value.bank] : banks;
  const bankId = value.bank?.id ?? '';
  const [custom, setCustom] = useState('');
  const set = (p: Partial<LetterSettings>) => onChange({ ...value, ...p });
  const setTerm = (i: number, text: string) => set({ terms: value.terms.map((t, idx) => (idx === i ? text : t)) });
  const setPay = (i: number, p: Partial<PaymentTerm>) => set({ paymentTerms: value.paymentTerms.map((x, idx) => (idx === i ? { ...x, ...p } : x)) });
  const suggestions = TERM_SUGGESTIONS.filter(s => !value.terms.some(t => t.trim().toLowerCase() === s.toLowerCase()));
  const payTotal = paymentTotal(value.paymentTerms);
  const addCustom = () => {
    if (!custom.trim()) return;
    set({ terms: [...value.terms, custom.trim()] });
    setCustom('');
  };

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      <fieldset>
        <legend className="font-semibold text-ink">PPN</legend>
        <div className="mt-2 flex flex-col gap-1.5">
          {TAX_OPTIONS.map(o => (
            <label
              key={o.value}
              className={cx(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                value.taxMode === o.value ? 'border-link bg-link-soft/50' : 'border-line hover:border-line-strong'
              )}
            >
              <input
                type="radio"
                name={`${id}-tax`}
                checked={value.taxMode === o.value}
                onChange={() => set({ taxMode: o.value })}
                className="mt-0.5 size-4 accent-[var(--color-link)]"
              />
              <span>
                <span className="block text-ink">{o.label}</span>
                <span className="block text-xs text-ink-3">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-ink">Diskon di surat</legend>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {DISCOUNT_OPTIONS.map(o => (
            <label
              key={o.value}
              className={cx(
                'flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center transition-colors',
                value.discountMode === o.value ? 'border-link bg-link-soft/50 font-semibold text-ink' : 'border-line text-ink-2 hover:border-line-strong'
              )}
            >
              <input type="radio" name={`${id}-disc`} checked={value.discountMode === o.value} onChange={() => set({ discountMode: o.value })} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          {value.discountMode === 'HIDDEN' ? 'Harga satuan langsung harga setelah diskon (harga nego).' : value.discountMode === 'AMOUNT' ? 'Kolom Discount berisi potongan rupiah per baris.' : 'Kolom Discount berisi persen.'}
        </p>
      </fieldset>

      <div>
        <p className="font-semibold text-ink">Keterangan</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {value.terms.map((t, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input
                aria-label={`Keterangan ${i + 1}`}
                value={t}
                onChange={e => setTerm(i, e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] focus:border-link focus:outline-none"
              />
              <button
                type="button"
                onClick={() => set({ terms: value.terms.filter((_, idx) => idx !== i) })}
                className="rounded p-1 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
                aria-label={`Hapus keterangan ${i + 1}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            aria-label="Keterangan baru"
            value={custom}
            placeholder="Tulis keterangan lain…"
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-dashed border-line-strong bg-surface px-2 text-[12.5px] focus:border-link focus:outline-none"
          />
          <button type="button" onClick={addCustom} className="rounded p-1 text-link hover:bg-link-soft cursor-pointer" aria-label="Tambah keterangan">
            <Plus className="size-4" />
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => set({ terms: [...value.terms, s] })}
                className="rounded-full border border-line px-2.5 py-1 text-left text-[11.5px] text-ink-2 hover:border-link hover:text-link cursor-pointer"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink-3">Pernyataan PPN dan rekening pembayaran selalu dicetak otomatis.</p>
      </div>

      <div>
        <p className="font-semibold text-ink">Termin pembayaran</p>
        {value.paymentTerms.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {value.paymentTerms.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <input
                  aria-label={`Termin ${i + 1}`}
                  value={p.label}
                  placeholder="Down Payment"
                  onChange={e => setPay(i, { label: e.target.value })}
                  className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] focus:border-link focus:outline-none"
                />
                <span className="relative">
                  <input
                    aria-label={`Persen termin ${i + 1}`}
                    inputMode="numeric"
                    value={p.percent || ''}
                    onChange={e => setPay(i, { percent: Math.min(100, Number(e.target.value.replace(/[^\d]/g, '')) || 0) })}
                    className="h-8 w-16 rounded-md border border-line-strong bg-surface pl-2 pr-6 text-right text-[12.5px] tabular-nums focus:border-link focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-3">%</span>
                </span>
                <button
                  type="button"
                  onClick={() => set({ paymentTerms: value.paymentTerms.filter((_, idx) => idx !== i) })}
                  className="rounded p-1 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
                  aria-label={`Hapus termin ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {value.paymentTerms.length > 0 && (
          <p className={cx('mt-1 text-xs tabular-nums', payTotal === 100 ? 'text-ink-3' : 'text-brand-strong')}>Total {payTotal}%{payTotal !== 100 && ' — harus 100%'}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PAYMENT_PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => set({ paymentTerms: p.terms.map(x => ({ ...x })) })}
              className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink-2 hover:border-link hover:text-link cursor-pointer"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set({ paymentTerms: [...value.paymentTerms, { label: '', percent: 0 }] })}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-link hover:text-link-strong cursor-pointer"
          >
            <Plus className="size-3.5" /> Baris termin
          </button>
        </div>
      </div>

      <div>
        <p className="font-semibold text-ink">Rekening pembayaran</p>
        <select
          aria-label="Rekening pembayaran"
          value={bankId}
          onChange={e => set({ bank: e.target.value ? bankOptions.find(b => b.id === e.target.value) ?? null : null })}
          className="mt-2 h-9 w-full cursor-pointer rounded-md border border-line-strong bg-surface px-2 text-[12.5px] focus:border-link focus:outline-none"
        >
          <option value="">Default · {fallbackBank.bank} {fallbackBank.account}</option>
          {bankOptions.map(b => (
            <option key={b.id} value={b.id}>
              {b.bank} · {b.account}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-ink-3">Daftar rekening diatur di menu Pengaturan.</p>
      </div>
    </div>
  );
}
