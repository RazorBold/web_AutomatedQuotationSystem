import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Globe, Plus, Trash2, Upload } from 'lucide-react';
import { errorMessage, useStore } from '../store/AppStore';
import { Badge, Button, Field, HeroStats, Input, PageHeader, Panel, Select, cx } from '../components/ui';
import { MarginValue } from '../components/QuotationTable';
import { formatRupiah } from '../utils/quotationEngine';
import { columnOptions, detectColumns, matchPriceList, type PriceListColumns, type PriceMatch, type Row } from '../utils/priceList';
import { MAX_SITES, normalizeDomain } from '../utils/supplierSearch';
import { PRICE_FILE_ACCEPT, readPriceFile } from '../utils/readPriceFile';

const pctChange = (m: PriceMatch) => (m.oldCogs > 0 ? ((m.newCogs - m.oldCogs) / m.oldCogs) * 100 : null);
const marginAt = (base: number, cogs: number) => (base > 0 ? ((base - cogs) / base) * 100 : null);

/** R9 + R10: supplier websites for price research and supplier price lists → HPP (Sales Support & Management). */
export function SuppliersPage() {
  const { supplierSites, priceHistory, products } = useStore();
  const monthAgo = Date.now() - 30 * 86400000;
  const recent = priceHistory.filter(h => new Date(h.atIso).getTime() >= monthAgo).length;
  const noCost = products.filter(p => !p.isCustom && p.cogs <= 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Supplier & HPP"
        description="Perbarui HPP dari price list supplier, dan atur website supplier yang dicari saat riset harga barang custom."
      >
        <HeroStats
          items={[
            { label: 'Website supplier', value: supplierSites.length, hint: supplierSites.length ? 'Dipakai di riset harga' : 'Belum diatur' },
            { label: 'Perubahan HPP', value: recent, hint: '30 hari terakhir' },
            { label: 'Produk tanpa HPP', value: noCost, hint: 'Belum bisa dipakai di penawaran', flag: noCost ? 'Lengkapi' : undefined },
            { label: 'Produk di katalog', value: products.length, hint: 'Dicocokkan lewat kode/SKU' },
          ]}
        />
      </PageHeader>

      <PriceListImport />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SupplierSitesPanel />
        <PriceHistoryPanel />
      </div>
    </div>
  );
}

// ───────────────────────────── R9: price list import ─────────────────────────────

function PriceListImport() {
  const { products, applyPriceList, notify } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; kind: string; rows: Row[] } | null>(null);
  const [columns, setColumns] = useState<PriceListColumns | null>(null);
  const [reference, setReference] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const result = useMemo(() => (file && columns ? matchPriceList(file.rows, products, columns) : null), [file, columns, products]);
  const changes = result?.matches.filter(m => !m.duplicate && m.newCogs !== m.oldCogs) ?? [];
  const unchanged = (result?.matches.filter(m => !m.duplicate).length ?? 0) - changes.length;
  const selected = changes.filter(m => !excluded.has(m.productId));
  const options = file ? columnOptions(file.rows, columns ?? { sku: -1, price: -1, headerRow: -1 }) : [];
  const tabular = options.length > 1;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setReading(true);
    try {
      const { rows, kind } = await readPriceFile(f);
      const cols = detectColumns(rows);
      const r = matchPriceList(rows, products, cols);
      setFile({ name: f.name, kind, rows });
      setColumns(cols);
      setReference(f.name.replace(/\.[^.]+$/, ''));
      // Big jumps and empty old HPP start unticked: someone should look at them first.
      setExcluded(new Set(r.matches.filter(m => m.suspicious).map(m => m.productId)));
    } catch (e) {
      setFile(null);
      setError((e as Error).message);
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  };

  const toggle = (id: string) =>
    setExcluded(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = async () => {
    setSaving(true);
    try {
      const n = await applyPriceList(
        reference,
        selected.map(m => ({ productId: m.productId, cogs: m.newCogs }))
      );
      notify(`HPP ${n} produk diperbarui dari ${reference || 'price list'}.`);
      setFile(null);
      setColumns(null);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const setCol = (key: 'sku' | 'price', v: number) => {
    const next = { ...(columns ?? { sku: -1, price: -1, headerRow: -1 }), [key]: v };
    setColumns(next);
    if (file) setExcluded(new Set(matchPriceList(file.rows, products, next).matches.filter(m => m.suspicious).map(m => m.productId)));
  };

  return (
    <Panel
      title="Import price list supplier"
      description="Excel (.xlsx), CSV, atau PDF berisi teks. Baris dicocokkan ke produk lewat kode/SKU; harga supplier menjadi HPP baru. Harga jual tidak berubah."
      actions={
        file && (
          <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
            Batal
          </Button>
        )
      }
    >
      <input ref={input} type="file" accept={PRICE_FILE_ACCEPT} className="sr-only" aria-label="File price list" onChange={e => void pick(e.target.files?.[0])} />

      {!file ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong bg-canvas px-5 py-6 sm:flex-row sm:items-center">
          <FileSpreadsheet className="size-8 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 flex-1 text-[13px] text-ink-2">
            <p className="font-semibold text-ink">Pilih file price list dari supplier</p>
            <p className="mt-0.5">
              Paling akurat: Excel dengan kolom kode barang dan harga. PDF hasil scan tidak bisa dibaca. Tidak ada yang tersimpan sebelum Anda konfirmasi.
            </p>
          </div>
          <Button variant="primary" icon={<Upload className="size-4" />} loading={reading} onClick={() => input.current?.click()}>
            Pilih file
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nama price list" hint="Tercatat di riwayat HPP.">
              {p => <Input {...p} value={reference} onChange={e => setReference(e.target.value)} placeholder="PT Supplier · Nov 2026" />}
            </Field>
            {tabular && (
              <>
                <Field label="Kolom kode / SKU">
                  {p => (
                    <Select {...p} value={columns?.sku ?? -1} onChange={e => setCol('sku', Number(e.target.value))}>
                      <option value={-1}>Otomatis (cari di semua kolom)</option>
                      {options.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Kolom harga supplier">
                  {p => (
                    <Select {...p} value={columns?.price ?? -1} onChange={e => setCol('price', Number(e.target.value))}>
                      <option value={-1}>Otomatis (angka rupiah terakhir)</option>
                      {options.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </>
            )}
          </div>

          <p className="text-[13px] text-ink-2" role="status">
            <span className="font-semibold text-ink">{file.name}</span> · {file.rows.length} baris · {result?.matches.length ?? 0} cocok dengan katalog ·{' '}
            <span className="font-semibold text-ink">{changes.length} HPP berubah</span>
            {unchanged > 0 && ` · ${unchanged} sama`}
            {result && result.unmatched.length > 0 && ` · ${result.unmatched.length} baris tidak dikenali`}
          </p>

          {changes.length === 0 ? (
            <p className="rounded-lg bg-canvas px-4 py-3 text-[13px] text-ink-2">
              {result?.matches.length
                ? 'Semua harga di file ini sama dengan HPP sekarang.'
                : 'Tidak ada baris yang cocok. Pilih kolom kode/SKU dan kolom harga secara manual, atau periksa apakah kode barang di file sama dengan SKU di katalog.'}
            </p>
          ) : (
            <div className="-mx-5 overflow-x-auto border-y border-line">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3">
                    <th className="w-10 px-5 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua"
                        checked={selected.length === changes.length}
                        onChange={e => setExcluded(e.target.checked ? new Set() : new Set(changes.map(m => m.productId)))}
                        className="size-4 cursor-pointer accent-[var(--color-brand)]"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium">Produk</th>
                    <th className="px-3 py-2.5 text-right font-medium">HPP lama</th>
                    <th className="px-3 py-2.5 text-right font-medium">HPP baru</th>
                    <th className="px-3 py-2.5 text-right font-medium">Selisih</th>
                    <th className="px-5 py-2.5 text-right font-medium">Margin di harga jual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {changes.map(m => {
                    const d = pctChange(m);
                    const margin = marginAt(m.basePrice, m.newCogs);
                    const on = !excluded.has(m.productId);
                    return (
                      <tr key={m.productId} className={cx(!on && 'text-ink-3')}>
                        <td className="px-5 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Perbarui HPP ${m.name}`}
                            checked={on}
                            onChange={() => toggle(m.productId)}
                            className="size-4 cursor-pointer accent-[var(--color-brand)]"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cx('font-semibold', on ? 'text-ink' : 'text-ink-3')}>{m.name}</span>
                          <span className="block text-xs text-ink-3">
                            <span className="font-mono">{m.sku}</span> · baris {m.line}
                            {m.suspicious && (
                              <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-700">
                                <AlertTriangle className="size-3" aria-hidden /> {m.oldCogs > 0 ? 'Selisih besar, cek dulu' : 'HPP lama kosong'}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-2">{m.oldCogs > 0 ? formatRupiah(m.oldCogs) : '–'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{formatRupiah(m.newCogs)}</td>
                        <td className={cx('whitespace-nowrap px-3 py-2.5 text-right tabular-nums', d === null ? 'text-ink-3' : d > 0 ? 'text-red-700' : 'text-emerald-700')}>
                          {d === null ? 'baru' : `${d > 0 ? '+' : ''}${d.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          {margin === null ? <span className="text-ink-3">harga jual kosong</span> : <MarginValue value={margin} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {result && result.unmatched.length > 0 && (
            <details className="text-[13px]">
              <summary className="cursor-pointer font-medium text-link hover:text-link-strong">
                {result.unmatched.length} baris berharga tidak dikenali (kode tidak ada di katalog)
              </summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg bg-canvas px-3 py-2 text-xs text-ink-2">
                {result.unmatched.slice(0, 100).map(u => (
                  <li key={u.line} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="text-ink-3">Baris {u.line}:</span> {u.text}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatRupiah(u.price)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && <p className="text-[13px] text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => input.current?.click()} loading={reading}>
              Ganti file
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!selected.length}>
              Simpan {selected.length} perubahan HPP
            </Button>
          </div>
        </div>
      )}
      {!file && error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
    </Panel>
  );
}

// ───────────────────────────── R10: supplier websites ─────────────────────────────

function SupplierSitesPanel() {
  const { supplierSites, saveSupplierSites, notify } = useStore();
  const [rows, setRows] = useState(() => supplierSites.map(s => ({ name: s.name, domain: s.domain })));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(supplierSites.map(s => ({ name: s.name, domain: s.domain })));
  const invalid = rows.some(r => !r.name.trim() || !normalizeDomain(r.domain));

  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await saveSupplierSites(rows.map(r => ({ name: r.name.trim(), domain: normalizeDomain(r.domain) })));
      setRows(rows.map(r => ({ name: r.name.trim(), domain: normalizeDomain(r.domain) })));
      notify('Daftar website supplier disimpan.');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Website supplier"
      description="Dicari di tab “Website supplier” pada riset harga barang custom. Kosong = mencari di seluruh web, tanpa marketplace."
    >
      {rows.length === 0 ? (
        <p className="mb-4 flex items-start gap-2 text-[13px] text-ink-3">
          <Globe className="mt-0.5 size-4 shrink-0" aria-hidden /> Belum ada website supplier.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {rows.map((r, i) => {
            const domain = normalizeDomain(r.domain);
            return (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-start gap-2">
                <Input aria-label={`Nama supplier ${i + 1}`} value={r.name} onChange={e => set(i, { name: e.target.value })} placeholder="PT Supplier Mebel" />
                <div>
                  <Input
                    aria-label={`Alamat website supplier ${i + 1}`}
                    value={r.domain}
                    onChange={e => set(i, { domain: e.target.value })}
                    placeholder="supplier.co.id"
                    aria-invalid={r.domain.trim() !== '' && !domain ? true : undefined}
                  />
                  {r.domain.trim() !== '' && !domain && <p className="mt-1 text-xs text-brand-strong">Alamat tidak valid</p>}
                </div>
                <button
                  onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                  className="grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-canvas hover:text-brand-strong cursor-pointer"
                  aria-label={`Hapus ${r.name || 'website'}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus className="size-4" />}
          disabled={rows.length >= MAX_SITES}
          onClick={() => setRows(rs => [...rs, { name: '', domain: '' }])}
        >
          Tambah website
        </Button>
        <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!dirty || invalid}>
          Simpan daftar
        </Button>
      </div>
    </Panel>
  );
}

// ───────────────────────────── R9: HPP history ─────────────────────────────

function PriceHistoryPanel() {
  const { priceHistory } = useStore();
  const [all, setAll] = useState(false);
  const list = all ? priceHistory : priceHistory.slice(0, 12);
  return (
    <Panel title="Riwayat perubahan HPP" description="Setiap perubahan HPP, manual maupun dari price list." bodyClassName="">
      {priceHistory.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-ink-3">Belum ada perubahan HPP sejak fitur ini aktif.</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {list.map(h => (
              <li key={h.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3 text-[13px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{h.productName}</p>
                  <p className="text-xs text-ink-3">
                    {h.source === 'IMPORT' ? <Badge tone="blue">Price list</Badge> : <Badge tone="gray">Manual</Badge>}
                    <span className="ml-2">
                      {h.reference ? `${h.reference} · ` : ''}
                      {h.by} · {h.at}
                    </span>
                  </p>
                </div>
                <p className="whitespace-nowrap tabular-nums text-ink-2">
                  {h.oldCogs !== undefined && h.oldCogs > 0 ? formatRupiah(h.oldCogs) : '–'} →{' '}
                  <span className="font-semibold text-ink">{formatRupiah(h.newCogs)}</span>
                </p>
              </li>
            ))}
          </ul>
          {priceHistory.length > list.length && (
            <button onClick={() => setAll(true)} className="w-full border-t border-line px-5 py-3 text-left text-[13px] font-medium text-link hover:text-link-strong cursor-pointer">
              Tampilkan {priceHistory.length - list.length} perubahan lainnya
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
