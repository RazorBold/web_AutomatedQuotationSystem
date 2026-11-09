import React, { useMemo, useState } from 'react';
import { FilePlus2, LayoutGrid, List, PackageSearch, Search, SlidersHorizontal } from 'lucide-react';
import { errorMessage, useStore, useVisibleProducts } from '../store/AppStore';
import { can } from '../auth/permissions';
import type { Product } from '../types';
import { Badge, Button, Drawer, EmptyState, Field, Input, PageHeader, ProductImage, cx } from '../components/ui';
import { MarginValue } from '../components/QuotationTable';
import { formatRupiah, smartProductSearch } from '../utils/quotationEngine';
import type { Route } from '../App';

function ProductDrawer({ product, onClose, navigate }: { product: Product | null; onClose: () => void; navigate: (r: Route) => void }) {
  const { currentUser, updateProduct, notify } = useStore();
  const canCogs = can(currentUser, 'cogs:view');
  const canEdit = can(currentUser, 'cogs:edit');
  const [cogs, setCogs] = useState(0);
  const [price, setPrice] = useState(0);
  const [lastId, setLastId] = useState<string | null>(null);

  if (product && product.id !== lastId) {
    setLastId(product.id);
    setCogs(product.cogs);
    setPrice(product.basePrice);
  }
  if (!product) return null;

  const margin = price > 0 ? ((price - cogs) / price) * 100 : 0;
  const dirty = cogs !== product.cogs || price !== product.basePrice;
  const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;

  return (
    <Drawer
      open={!!product}
      onClose={onClose}
      title={product.name}
      description={`${product.brand} · SKU ${product.sku}`}
      width="max-w-xl"
      footer={
        can(currentUser, 'quotation:create') ? (
          <Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => navigate({ view: 'create-quotation', productId: product.id })}>
            Buat penawaran dengan produk ini
          </Button>
        ) : canEdit ? (
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => {
              updateProduct(product.id, { cogs, basePrice: price })
                .then(() => {
                  notify(`Harga ${product.name} disimpan.`);
                  onClose();
                })
                .catch(e => notify(errorMessage(e), 'error'));
            }}
          >
            Simpan harga
          </Button>
        ) : undefined
      }
    >
      <ProductImage src={product.image} alt={product.name} className="aspect-[4/3] w-full rounded-xl border border-line" />
      <div className="mt-4 flex flex-wrap gap-2">
        {product.isBestSeller && <Badge tone="red">Best seller</Badge>}
        {product.eKatalogLkpp && <Badge tone="blue">e-Katalog LKPP</Badge>}
        {product.isCustom ? (
          <Badge tone="blue">Barang custom</Badge>
        ) : (
          <Badge tone={product.stock > 20 ? 'green' : 'amber'}>
            Stok {product.stock} {product.unit.toLowerCase()}
          </Badge>
        )}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{product.description}</p>

      <h3 className="mt-6 text-sm font-semibold text-ink">Spesifikasi teknis</h3>
      <dl className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line text-[13px]">
        {[
          ['Kategori', product.category],
          ['Berat', product.weightKg ? `${product.weightKg.toLocaleString('id-ID')} kg` : '–'],
          ['Dimensi', product.dimensions ?? '–'],
          ['Detail', product.specs],
        ].map(([k, v], i) => (
          <div key={k} className={cx('grid grid-cols-[110px_1fr] gap-3 px-3.5 py-2.5', i % 2 === 1 && 'bg-canvas/60')}>
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-6 text-sm font-semibold text-ink">Harga</h3>
      {canCogs ? (
        <div className="mt-2 rounded-lg border border-line p-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="HPP / unit">
              {p => <Input {...p} inputMode="numeric" disabled={!canEdit} className="text-right tabular-nums" value={cogs.toLocaleString('id-ID')} onChange={e => setCogs(num(e.target.value))} />}
            </Field>
            <Field label="Harga jual katalog">
              {p => <Input {...p} inputMode="numeric" disabled={!canEdit} className="text-right tabular-nums" value={price.toLocaleString('id-ID')} onChange={e => setPrice(num(e.target.value))} />}
            </Field>
          </div>
          <p className="mt-3 flex items-center justify-between text-[13px]">
            <span className="text-ink-2">Margin katalog</span>
            <MarginValue value={margin} />
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {formatRupiah(product.basePrice)} <span className="text-[13px] font-normal text-ink-3">/ {product.unit.toLowerCase()}, belum PPN</span>
        </p>
      )}
    </Drawer>
  );
}

export function CatalogPage({ navigate }: { navigate: (r: Route) => void }) {
  const products = useVisibleProducts();
  const { currentUser } = useStore();
  const canCogs = can(currentUser, 'cogs:view');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach(p => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return [...m.entries()];
  }, [products]);

  const list = smartProductSearch(products, query).filter(p => !selected.length || selected.includes(p.category));
  const toggle = (c: string) => setSelected(s => (s.includes(c) ? s.filter(x => x !== c) : [...s, c]));

  const filterList = (
    <div>
      <p className="flex items-center gap-2 border-b border-line pb-3 text-sm font-semibold text-ink">
        <SlidersHorizontal className="size-4 text-link" /> Kategori
      </p>
      <ul className="mt-3 flex flex-col gap-0.5">
        <li>
          <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-[13.5px] text-ink-2 hover:text-ink">
            <input type="checkbox" className="size-4 accent-[var(--color-link)]" checked={!selected.length} onChange={() => setSelected([])} />
            <span className={cx('flex-1', !selected.length && 'font-medium text-link')}>Semua kategori</span>
            <span className="text-xs tabular-nums text-ink-3">{products.length}</span>
          </label>
        </li>
        {categories.map(([c, n]) => (
          <li key={c}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-[13.5px] text-ink-2 hover:text-ink">
              <input type="checkbox" className="size-4 accent-[var(--color-link)]" checked={selected.includes(c)} onChange={() => toggle(c)} />
              <span className={cx('flex-1', selected.includes(c) && 'font-medium text-link')}>{c}</span>
              <span className="text-xs tabular-nums text-ink-3">{n}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Katalog produk"
        description={
          canCogs
            ? 'Harga katalog dan HPP setiap produk. Buka produk untuk memperbarui harga.'
            : 'Cari produk dengan kata kunci bebas. Sistem juga mengenali sinonim, mis. “komputer” menemukan AIO.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden self-start rounded-[14px] border border-line/80 bg-surface p-5 shadow-card lg:block">{filterList}</aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input aria-label="Cari nama produk" placeholder="Cari nama produk, SKU, atau kebutuhan" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
            </div>
            <Button className="lg:hidden" icon={<SlidersHorizontal className="size-4" />} onClick={() => setFiltersOpen(true)}>
              Kategori{selected.length ? ` (${selected.length})` : ''}
            </Button>
            <div className="hidden rounded-lg border border-line bg-surface p-0.5 sm:flex" role="group" aria-label="Tampilan">
              {(['grid', 'list'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setLayout(v)}
                  aria-pressed={layout === v}
                  aria-label={v === 'grid' ? 'Tampilan kisi' : 'Tampilan daftar'}
                  className={cx('flex size-9 items-center justify-center rounded-md cursor-pointer', layout === v ? 'bg-link-soft text-link' : 'text-ink-3 hover:text-ink')}
                >
                  {v === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[13px] text-ink-3">
            {list.length} produk{query && ` untuk “${query}”`}
          </p>

          {list.length === 0 ? (
            <div className="rounded-[14px] border border-line/80 bg-surface shadow-card">
              <EmptyState
                icon={<PackageSearch className="size-5" />}
                title="Tidak ada produk yang cocok"
                description="Coba kata kunci lain atau kosongkan filter kategori. Jika barang memang belum ada, ajukan sebagai barang custom."
                action={
                  can(currentUser, 'custom-request:create') ? (
                    <Button size="sm" onClick={() => navigate({ view: 'custom-requests' })}>
                      Ajukan barang custom
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : layout === 'grid' ? (
            <ul className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {list.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => setOpenId(p.id)}
                    className="group flex h-full w-full flex-col rounded-[14px] border border-line/80 bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-[0_10px_28px_-14px_rgb(196_28_37/0.35)] cursor-pointer"
                  >
                    <div className="relative">
                      <ProductImage src={p.image} alt={p.name} className="aspect-[4/3] w-full rounded-lg" />
                      {p.eKatalogLkpp && (
                        <span className="absolute left-2 top-2 rounded bg-surface/95 px-1.5 py-0.5 text-[10.5px] font-semibold text-navy ring-1 ring-line">LKPP</span>
                      )}
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-link">{p.category}</p>
                    <p className="mt-1 line-clamp-2 font-semibold leading-snug text-ink group-hover:text-brand-ink">{p.name}</p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <span className="font-semibold tabular-nums text-ink">{formatRupiah(p.basePrice)}</span>
                      {canCogs ? (
                        <span className="text-xs text-ink-3">
                          HPP {formatRupiah(p.cogs)}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-3">{p.isCustom ? 'custom' : `stok ${p.stock}`}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-[14px] border border-line/80 bg-surface shadow-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3">
                    <th className="px-4 py-3 font-medium">Produk</th>
                    <th className="px-3 py-3 font-medium">Kategori</th>
                    <th className="px-3 py-3 text-right font-medium">Stok</th>
                    <th className="px-3 py-3 text-right font-medium">Harga katalog</th>
                    {canCogs && <th className="px-3 py-3 text-right font-medium">HPP</th>}
                    {canCogs && <th className="px-4 py-3 text-right font-medium">Margin</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map(p => (
                    <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer hover:bg-canvas">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <ProductImage src={p.image} alt="" hint={p.category} className="size-11 shrink-0 rounded-md border border-line" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{p.name}</p>
                            <p className="text-xs text-ink-3">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-link">{p.category}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{p.stock}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatRupiah(p.basePrice)}</td>
                      {canCogs && <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{formatRupiah(p.cogs)}</td>}
                      {canCogs && (
                        <td className="px-4 py-2.5 text-right">
                          <MarginValue value={((p.basePrice - p.cogs) / p.basePrice) * 100} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter kategori" width="max-w-xs">
        {filterList}
      </Drawer>
      <ProductDrawer product={products.find(p => p.id === openId) ?? null} onClose={() => setOpenId(null)} navigate={navigate} />
    </div>
  );
}
