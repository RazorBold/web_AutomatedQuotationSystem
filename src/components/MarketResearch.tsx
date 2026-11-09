import React, { useState } from 'react';
import { Check, ExternalLink, Loader2, Search, Star, Store, X } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { formatRupiah } from '../utils/quotationEngine';
import { marketLinks, type MarketOffer, type MarketSearchResult, type SupplierRef } from '../utils/marketResearch';
import { Button, Field, Input, ProductImage, cx } from './ui';

const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;

/**
 * Market price research for a custom request (Sales Support): comparable offers from online stores
 * (Google Shopping via the server), price range, and a supplier reference that also fills the HPP.
 */
export function MarketResearch({
  defaultQuery,
  supplier,
  onSupplierChange,
  onUseAsCost,
}: {
  defaultQuery: string;
  supplier: SupplierRef | null;
  onSupplierChange: (s: SupplierRef | null) => void;
  /** Called with the chosen offer's price so the HPP field can be filled. */
  onUseAsCost: (price: number) => void;
}) {
  const { searchMarket } = useStore();
  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<MarketSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [manual, setManual] = useState<{ name: string; url: string; price: number } | null>(null);

  const search = async () => {
    if (query.trim().length < 3) return setError('Tulis nama barang minimal 3 huruf.');
    setLoading(true);
    setError('');
    setShowAll(false);
    try {
      const r = await searchMarket(query);
      setResult(r);
      if (r.mode === 'manual' && !manual) setManual({ name: '', url: '', price: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const choose = (o: MarketOffer) => {
    onSupplierChange({ name: o.store, url: o.url, price: o.price });
    if (o.price > 0) onUseAsCost(o.price);
  };

  const offers = result?.offers ?? [];
  const visible = showAll ? offers : offers.slice(0, 6);
  const links = result?.links ?? marketLinks(query || defaultQuery);

  return (
    <section aria-label="Riset harga pasar" className="mt-6 rounded-xl border border-line p-4">
      <p className="text-sm font-semibold text-ink">Riset harga pasar</p>
      <p className="mt-0.5 text-xs text-ink-2">Cari barang serupa di toko online sebagai acuan supplier dan HPP. Tidak terlihat oleh Sales.</p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          void search();
        }}
      >
        <Input aria-label="Kata kunci riset harga" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama barang + merek/tipe" />
        <Button type="submit" icon={<Search className="size-4" />} loading={loading}>
          Cari harga
        </Button>
      </form>
      {error && <p className="mt-2 text-[13px] text-red-700">{error}</p>}

      {supplier && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <Check className="size-4 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="text-xs text-emerald-800">Acuan supplier</p>
            <p className="truncate font-semibold text-ink">
              {supplier.name}
              {supplier.price > 0 && <span className="font-normal tabular-nums text-ink-2"> · {formatRupiah(supplier.price)}</span>}
            </p>
            {supplier.url && (
              <a href={supplier.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-strong">
                Buka halaman toko <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
          <button
            onClick={() => onSupplierChange(null)}
            className="rounded p-1 text-ink-3 hover:bg-white hover:text-ink cursor-pointer"
            aria-label="Hapus acuan supplier"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {result?.mode === 'live' && (
        <div className="mt-4">
          {result.stats ? (
            <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-canvas text-center">
              {[
                ['Termurah', result.stats.min],
                ['Median', result.stats.median],
                ['Termahal', result.stats.max],
              ].map(([k, v]) => (
                <div key={k as string} className="px-2 py-2">
                  <dt className="text-[11px] text-ink-3">{k}</dt>
                  <dd className="text-[13px] font-semibold tabular-nums text-ink">{formatRupiah(v as number)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[13px] text-ink-2">Tidak ada penawaran dengan harga untuk “{result.query}”. Coba kata kunci lain atau cek manual.</p>
          )}
          {offers.length > 0 && (
            <p className="mt-2 text-xs text-ink-3">
              {offers.length} penawaran dari toko online, urut dari termurah. Harga di luar kewajaran (aksesori, grosir) disaring.
            </p>
          )}
          <ul className="mt-2 divide-y divide-line">
            {visible.map(o => {
              const chosen = supplier?.url === o.url;
              return (
                <li key={o.url} className="flex items-center gap-3 py-2.5">
                  <ProductImage src={o.imageUrl ?? ''} alt="" className="size-11 shrink-0 rounded-md border border-line" />
                  <div className="min-w-0 flex-1">
                    <a href={o.url} target="_blank" rel="noreferrer noopener" className="line-clamp-2 text-[13px] font-medium leading-snug text-ink hover:text-link">
                      {o.title}
                    </a>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                      <Store className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{o.store}</span>
                      {o.rating !== undefined && (
                        <span className="inline-flex shrink-0 items-center gap-0.5">
                          · <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> {o.rating}
                          {o.ratingCount ? ` (${o.ratingCount})` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[13px] font-semibold tabular-nums text-ink">{o.price > 0 ? formatRupiah(o.price) : o.priceText || '–'}</span>
                    <button
                      onClick={() => choose(o)}
                      disabled={chosen}
                      className={cx(
                        'text-xs font-semibold cursor-pointer disabled:cursor-default',
                        chosen ? 'text-emerald-700' : 'text-link hover:text-link-strong'
                      )}
                    >
                      {chosen ? 'Dipakai' : 'Pakai sebagai acuan'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {offers.length > visible.length && (
            <button onClick={() => setShowAll(true)} className="mt-1 text-xs font-medium text-link hover:text-link-strong cursor-pointer">
              Tampilkan {offers.length - visible.length} penawaran lainnya
            </button>
          )}
        </div>
      )}

      {result?.mode === 'manual' && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Pencarian otomatis belum aktif (API key Serper.dev belum diisi). Buka pencarian di bawah, lalu catat toko dan harganya di sini.
        </p>
      )}

      {manual && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nama toko / supplier">
            {p => <Input {...p} value={manual.name} onChange={e => setManual({ ...manual, name: e.target.value })} placeholder="Tokopedia - Toko Mebel ABC" />}
          </Field>
          <Field label="Harga di toko">
            {p => (
              <Input
                {...p}
                inputMode="numeric"
                className="text-right tabular-nums"
                value={manual.price ? manual.price.toLocaleString('id-ID') : ''}
                onChange={e => setManual({ ...manual, price: num(e.target.value) })}
                placeholder="3.450.000"
              />
            )}
          </Field>
          <Field label="Link produk" optional className="sm:col-span-2">
            {p => <Input {...p} value={manual.url} onChange={e => setManual({ ...manual, url: e.target.value.trim() })} placeholder="https://www.tokopedia.com/…" />}
          </Field>
          <div className="sm:col-span-2">
            <Button
              size="sm"
              disabled={!manual.name.trim()}
              onClick={() => {
                onSupplierChange({ name: manual.name.trim(), url: /^https?:\/\//.test(manual.url) ? manual.url : undefined, price: manual.price });
                if (manual.price > 0) onUseAsCost(manual.price);
              }}
            >
              Pakai sebagai acuan
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <span className="text-xs text-ink-3">Cek juga di:</span>
        {links.map(l => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-link hover:text-link"
          >
            {l.label} <ExternalLink className="size-3" aria-hidden />
          </a>
        ))}
        {!manual && (
          <button onClick={() => setManual({ name: '', url: '', price: 0 })} className="ml-auto text-xs font-medium text-link hover:text-link-strong cursor-pointer">
            Isi supplier manual
          </button>
        )}
      </div>
      {loading && (
        <span className="sr-only" role="status">
          <Loader2 /> Mencari harga…
        </span>
      )}
    </section>
  );
}
