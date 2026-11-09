import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { errorMessage, useStore } from '../store/AppStore';
import type { CustomerCategory } from '../types';
import { Button, Field, Input, PageHeader, Panel, Select } from '../components/ui';
import { DEFAULT_DISCOUNT_RULES, DiscountRule, getSuggestedDiscount } from '../utils/quotationEngine';

const SEGMENT_LABEL: Record<CustomerCategory, string> = {
  CORPORATE: 'Korporasi',
  BUMN_GOV: 'BUMN / Pemerintah',
  EDUCATION: 'Pendidikan',
  RETAIL: 'Retail',
};
const SEGMENTS = Object.keys(SEGMENT_LABEL) as CustomerCategory[];

const CELL = 'h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-[13px] tabular-nums focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15';

export function DiscountRulesPage() {
  const { discountRules, setDiscountRules, notify } = useStore();
  const [draft, setDraft] = useState<DiscountRule[]>(discountRules);
  const [simSegment, setSimSegment] = useState<CustomerCategory>('CORPORATE');
  const [simQty, setSimQty] = useState(25);

  const dirty = JSON.stringify(draft) !== JSON.stringify(discountRules);
  const sorted = draft
    .map((r, i) => ({ r, i }))
    .sort((a, b) => SEGMENTS.indexOf(a.r.customerCategory ?? 'CORPORATE') - SEGMENTS.indexOf(b.r.customerCategory ?? 'CORPORATE') || a.r.minQty - b.r.minQty);

  const patch = (i: number, p: Partial<DiscountRule>) => setDraft(d => d.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const n = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);

  const problems = draft
    .map((r, i) => {
      if (r.suggestedDiscount > r.maxAllowedDiscount) return { i, msg: 'Saran diskon melebihi diskon maksimum.' };
      if (r.maxQty !== undefined && r.maxQty < r.minQty) return { i, msg: 'Qty maksimum lebih kecil dari qty minimum.' };
      return null;
    })
    .filter(Boolean) as { i: number; msg: string }[];

  const sim = getSuggestedDiscount(simQty, simSegment, draft);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aturan diskon"
        description="Saran diskon yang muncul otomatis saat Sales menyusun penawaran, berdasarkan segmen customer dan jumlah barang. Diskon di atas batas maksimum perlu persetujuan khusus."
        actions={
          <>
            <Button variant="ghost" onClick={() => setDraft(DEFAULT_DISCOUNT_RULES)}>
              Kembalikan default
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || problems.length > 0}
              onClick={() => {
                setDiscountRules(draft)
                  .then(() => notify('Aturan diskon disimpan. Berlaku untuk penawaran berikutnya.'))
                  .catch(e => notify(errorMessage(e), 'error'));
              }}
            >
              Simpan aturan
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel bodyClassName="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-5 py-3 font-medium">Segmen</th>
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
                        <Select
                          aria-label="Segmen"
                          value={r.customerCategory ?? 'CORPORATE'}
                          onChange={e => patch(i, { customerCategory: e.target.value as CustomerCategory })}
                          className="h-9 text-[13px]"
                        >
                          {SEGMENTS.map(s => (
                            <option key={s} value={s}>
                              {SEGMENT_LABEL[s]}
                            </option>
                          ))}
                        </Select>
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
          <div className="border-t border-line px-5 py-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus className="size-4" />}
              onClick={() => setDraft(d => [...d, { minQty: 1, customerCategory: 'CORPORATE', suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 15 }])}
            >
              Tambah aturan
            </Button>
          </div>
        </Panel>

        <Panel title="Coba aturan" description="Lihat saran diskon untuk kombinasi segmen dan jumlah tertentu." className="self-start">
          <div className="flex flex-col gap-4">
            <Field label="Segmen customer">
              {p => (
                <Select {...p} value={simSegment} onChange={e => setSimSegment(e.target.value as CustomerCategory)}>
                  {SEGMENTS.map(s => (
                    <option key={s} value={s}>
                      {SEGMENT_LABEL[s]}
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
          {dirty && <p className="mt-3 text-xs text-amber-700">Memakai perubahan yang belum disimpan.</p>}
        </Panel>
      </div>
    </div>
  );
}
