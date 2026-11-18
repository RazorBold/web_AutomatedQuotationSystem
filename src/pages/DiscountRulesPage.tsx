import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { errorMessage, useStore } from '../store/AppStore';
import { Button, Field, Input, Panel, Select } from '../components/ui';
import { DiscountRule, getSuggestedDiscount, normalizeBrand } from '../utils/quotationEngine';

const CELL =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-[13px] tabular-nums focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15';
const OTHER = 'Semua merek lain';

/** Discount rules per brand (merek) and quantity tier (R12) — a tab of Pengaturan. Agusta fills in its own numbers. */
export function DiscountRulesEditor() {
  const { discountRules, setDiscountRules, notify, products } = useStore();
  const [draft, setDraft] = useState<DiscountRule[]>(discountRules);
  const [simBrand, setSimBrand] = useState('');
  const [simQty, setSimQty] = useState(10);

  /** Brands known from the catalog, for suggestions and the simulator. */
  const catalogBrands = useMemo(
    () => Array.from(new Set(products.map(p => normalizeBrand(p.brand)).filter(Boolean))).sort(),
    [products]
  );
  const ruleBrands = Array.from(new Set(draft.map(r => normalizeBrand(r.brand)).filter(Boolean))).sort();
  const simOptions = Array.from(new Set([...ruleBrands, ...catalogBrands]));

  const dirty = JSON.stringify(draft) !== JSON.stringify(discountRules);
  const sorted = draft
    .map((r, i) => ({ r, i, b: normalizeBrand(r.brand) }))
    .sort((a, b) => (a.b === '' ? 1 : 0) - (b.b === '' ? 1 : 0) || a.b.localeCompare(b.b) || a.r.minQty - b.r.minQty);

  const patch = (i: number, p: Partial<DiscountRule>) => setDraft(d => d.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const n = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);

  const problems = draft
    .map((r, i) => {
      if (r.suggestedDiscount > r.maxAllowedDiscount) return { i, msg: 'Saran diskon melebihi diskon maksimum.' };
      if (r.maxQty !== undefined && r.maxQty < r.minQty) return { i, msg: 'Qty maksimum lebih kecil dari qty minimum.' };
      return null;
    })
    .filter(Boolean) as { i: number; msg: string }[];

  const sim = getSuggestedDiscount(simQty, simBrand, draft);
  const simUsesOwn = simBrand !== '' && ruleBrands.includes(normalizeBrand(simBrand));

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Aturan diskon per merek"
          description="Saran dan batas diskon per merek dan jumlah barang. Muncul otomatis saat Sales menyusun penawaran. Diskon di atas batas sebaiknya diteruskan ke Management."
          actions={
            <Button
              size="sm"
              variant="primary"
              disabled={!dirty || problems.length > 0}
              onClick={() => {
                setDiscountRules(draft.map(r => ({ ...r, brand: normalizeBrand(r.brand) || undefined })))
                  .then(() => notify('Aturan diskon disimpan. Berlaku untuk penawaran berikutnya.'))
                  .catch(e => notify(errorMessage(e), 'error'));
              }}
            >
              Simpan aturan
            </Button>
          }
          bodyClassName="overflow-x-auto"
        >
          <datalist id="brand-options">
            {catalogBrands.map(b => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-5 py-3 font-medium">Merek</th>
                <th className="w-24 px-2 py-3 text-right font-medium">Qty min.</th>
                <th className="w-24 px-2 py-3 text-right font-medium">Qty maks.</th>
                <th className="w-28 px-2 py-3 text-right font-medium">Saran diskon %</th>
                <th className="w-28 px-2 py-3 text-right font-medium">Maks. diskon %</th>
                <th className="w-28 px-2 py-3 text-right font-medium">Margin min. %</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map(({ r, i }) => {
                const problem = problems.find(p => p.i === i);
                return (
                  <React.Fragment key={i}>
                    <tr className={problem ? 'bg-brand-soft/40' : undefined}>
                      <td className="px-5 py-2">
                        <input
                          aria-label="Merek"
                          list="brand-options"
                          value={r.brand ?? ''}
                          placeholder={OTHER}
                          onChange={e => patch(i, { brand: e.target.value.toUpperCase() || undefined })}
                          className="h-9 w-full min-w-40 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium uppercase placeholder:normal-case placeholder:font-normal placeholder:text-ink-3 focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label="Qty minimum" className={CELL} value={r.minQty} onChange={e => patch(i, { minQty: n(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label="Qty maksimum"
                          className={CELL}
                          placeholder="∞"
                          value={r.maxQty ?? ''}
                          onChange={e => patch(i, { maxQty: e.target.value.trim() === '' ? undefined : n(e.target.value) })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label="Saran diskon" className={CELL} value={r.suggestedDiscount} onChange={e => patch(i, { suggestedDiscount: n(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label="Maksimum diskon" className={CELL} value={r.maxAllowedDiscount} onChange={e => patch(i, { maxAllowedDiscount: n(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label="Margin minimum" className={CELL} value={r.minMarginPercent} onChange={e => patch(i, { minMarginPercent: n(e.target.value) })} />
                      </td>
                      <td className="pr-3">
                        <button
                          onClick={() => setDraft(d => d.filter((_, idx) => idx !== i))}
                          className="rounded p-1.5 text-ink-3 hover:bg-brand-soft hover:text-brand-strong cursor-pointer"
                          aria-label="Hapus aturan"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr className="bg-brand-soft/40">
                        <td colSpan={7} className="px-5 pb-2 text-xs text-brand-strong">
                          {problem.msg}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus className="size-4" />}
              onClick={() => setDraft(d => [...d, { brand: '', minQty: 1, suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 15 }])}
            >
              Tambah aturan
            </Button>
            <p className="text-xs text-ink-3">Merek kosong = berlaku untuk {OTHER.toLowerCase()} yang tidak punya aturan sendiri.</p>
          </div>
        </Panel>

        <Panel title="Coba aturan" description="Lihat saran diskon untuk merek dan jumlah tertentu." className="self-start">
          <div className="flex flex-col gap-4">
            <Field label="Merek">
              {p => (
                <Select {...p} value={simBrand} onChange={e => setSimBrand(e.target.value)}>
                  <option value="">{OTHER}</option>
                  {simOptions.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Jumlah barang">
              {p => <Input {...p} inputMode="numeric" className="tabular-nums" value={simQty} onChange={e => setSimQty(Number(e.target.value.replace(/\D/g, '')) || 0)} />}
            </Field>
          </div>
          <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-lg border border-line text-center">
            {[
              ['Saran', `${sim.suggestedPercent}%`],
              ['Maks.', `${sim.maxAllowedPercent}%`],
              ['Margin min.', `${sim.minMarginPercent}%`],
            ].map(([k, v]) => (
              <div key={k} className="px-2 py-3">
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {simBrand !== '' && !simUsesOwn && <p className="mt-3 text-xs text-ink-3">{simBrand} belum punya aturan sendiri, memakai aturan {OTHER.toLowerCase()}.</p>}
          {dirty && <p className="mt-3 text-xs text-amber-700">Memakai perubahan yang belum disimpan.</p>}
        </Panel>
      </div>
    </>
  );
}
