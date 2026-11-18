import React, { useMemo, useState } from 'react';
import { MessageSquarePlus, PackageSearch, Plus, X } from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../utils/quotationEngine';
import { Button, EmptyState, ProductImage, Select, cx } from './ui';

const PAGE = 24;

/** Catalog values with their product count, most used first. */
function counted(values: string[]): [string, number][] {
  const m = new Map<string, number>();
  values.filter(Boolean).forEach(v => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Product picker for the quotation wizard: compact filters (category, brand, top categories as chips)
 * and a card grid that shows 24 products at a time. `ranked` is the catalog already ordered by the
 * smart search; this component only narrows it.
 */
export function ProductBrowser({
  catalog,
  ranked,
  query,
  cartQty,
  onAdd,
  onRequestPrice,
  onCustomRequest,
}: {
  catalog: Product[];
  ranked: Product[];
  query: string;
  cartQty: (id: string) => number;
  onAdd: (id: string) => void;
  onRequestPrice: (p: Product) => void;
  onCustomRequest: () => void;
}) {
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [lastKey, setLastKey] = useState('');

  // A new search or filter starts again from the first page.
  const key = `${query}|${category}|${brand}`;
  if (key !== lastKey) {
    setLastKey(key);
    setLimit(PAGE);
  }

  const categories = useMemo(() => counted(catalog.map(p => p.category)), [catalog]);
  const brands = useMemo(() => counted(catalog.map(p => p.brand)), [catalog]);
  const list = ranked.filter(p => (!category || p.category === category) && (!brand || p.brand === brand));
  const shown = list.slice(0, limit);
  const filtered = !!(category || brand);

  return (
    <div>
      <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select aria-label="Kategori" value={category} onChange={e => setCategory(e.target.value)} className="h-9 min-w-0 text-[13px] sm:w-56">
            <option value="">Semua kategori ({catalog.length.toLocaleString('id-ID')})</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </Select>
          <Select aria-label="Merek" value={brand} onChange={e => setBrand(e.target.value)} className="h-9 min-w-0 text-[13px] sm:w-44">
            <option value="">Semua merek</option>
            {brands.map(([b, n]) => (
              <option key={b} value={b}>
                {b} ({n})
              </option>
            ))}
          </Select>
          <p className="col-span-2 text-xs tabular-nums text-ink-3 sm:ml-auto">
            {list.length.toLocaleString('id-ID')} produk
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setCategory('');
                  setBrand('');
                }}
                className="ml-2 inline-flex items-center gap-0.5 font-medium text-link hover:text-link-strong cursor-pointer"
              >
                <X className="size-3" /> Hapus filter
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {categories.slice(0, 6).map(([c]) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? '' : c)}
              className={cx(
                'h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer',
                category === c ? 'bg-link text-white' : 'bg-canvas text-ink-2 hover:text-ink'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-5" />}
          title="Produk tidak ditemukan"
          description={filtered ? 'Coba hapus filter kategori atau merek, atau ajukan sebagai barang custom.' : 'Coba kata lain, atau ajukan sebagai barang custom agar Sales Support menghitung harganya.'}
          action={
            <Button size="sm" onClick={onCustomRequest}>
              Ajukan barang custom
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 2xl:grid-cols-4">
            {shown.map(p => {
              const qty = cartQty(p.id);
              return (
                <li
                  key={p.id}
                  className={cx(
                    'relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors',
                    qty ? 'border-link/60 ring-1 ring-link/30' : 'border-line hover:border-line-strong'
                  )}
                >
                  {qty > 0 && (
                    <span className="absolute right-2 top-2 z-[1] rounded-full bg-link px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                      {qty} di penawaran
                    </span>
                  )}
                  <ProductImage src={p.image} alt="" hint={p.category} className="aspect-[4/3] w-full border-b border-line p-2" />
                  <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                    <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.04em] text-link">{p.category}</p>
                    <p className="mt-0.5 line-clamp-2 min-h-[2lh] text-[12.5px] font-semibold leading-snug text-ink sm:text-[13px]" title={p.name}>
                      {p.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-3">
                      {p.brand || p.sku}
                      {p.stock > 0 && ` · stok ${p.stock}`}
                      {p.eKatalogLkpp && ' · LKPP'}
                    </p>
                    <div className="mt-auto pt-2">
                      {p.basePrice > 0 ? (
                        <>
                          <p className="text-[13px] font-bold tabular-nums text-ink sm:text-sm">{formatRupiah(p.basePrice)}</p>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Plus className="size-3.5" />}
                            onClick={() => onAdd(p.id)}
                            className="mt-1.5 w-full"
                            aria-label={`Tambah ${p.name}`}
                          >
                            Tambah
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-ink-3">Harga belum ada</p>
                          <Button size="sm" variant="secondary" icon={<MessageSquarePlus className="size-3.5" />} onClick={() => onRequestPrice(p)} className="mt-1.5 w-full">
                            Minta harga
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.length > shown.length && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" onClick={() => setLimit(l => l + PAGE)}>
                Tampilkan {Math.min(PAGE, list.length - shown.length)} lagi · {shown.length.toLocaleString('id-ID')} dari {list.length.toLocaleString('id-ID')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
