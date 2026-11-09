import React, { useMemo } from 'react';
import { Check, MessageSquarePlus, Plus, Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../utils/quotationEngine';
import { describeSegment, isDetailedRequest, suggestProducts, type ProductSuggestion } from '../utils/smartSearch';
import { Button, ProductImage, cx } from './ui';

const CONFIDENCE_LABEL: Record<ProductSuggestion<Product>['confidence'], string> = {
  high: 'Paling cocok',
  medium: 'Mungkin cocok',
  low: 'Kurang cocok',
};

/**
 * Reads a free-text request ("20 kursi ergonomis di bawah 2,5 juta dan 5 AIO i7") and proposes one
 * catalog product per requested item, with the quantity already filled in.
 * Renders nothing for a plain keyword — the regular result list handles that.
 */
export function SmartSuggestions({
  products,
  query,
  cartQty,
  onAdd,
  onCustomRequest,
  onRequestPrice,
}: {
  products: Product[];
  query: string;
  cartQty: (productId: string) => number;
  onAdd: (productId: string, qty: number) => void;
  onCustomRequest?: (name: string, qty: number) => void;
  /** For products that exist but have no price yet. */
  onRequestPrice?: (product: Product, qty: number) => void;
}) {
  const results = useMemo(() => (query.trim().length >= 3 ? suggestProducts(products, query) : []), [products, query]);
  if (!isDetailedRequest(results.map(r => r.segment))) return null;

  const addable = results.filter(r => r.suggestions[0] && r.suggestions[0].product.basePrice > 0 && !cartQty(r.suggestions[0].product.id));

  return (
    <section aria-label="Saran dari permintaan" className="border-b border-line bg-link-soft/35 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Sparkles className="size-4 text-link" strokeWidth={1.75} aria-hidden />
          Saran untuk permintaan ini
        </p>
        {results.length > 1 && addable.length > 0 && (
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => addable.forEach(r => onAdd(r.suggestions[0]!.product.id, r.suggestions[0]!.qty))}>
            Tambah semua saran
          </Button>
        )}
      </div>

      <ol className="mt-3 flex flex-col gap-3">
        {results.map((r, i) => {
          const [best, ...alts] = r.suggestions;
          const chips = describeSegment(r.segment);
          const qty = r.segment.qty ?? 1;
          return (
            <li key={i} className="rounded-xl border border-line bg-surface p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-xs text-ink-3">Dibaca sebagai</span>
                {chips.map(c => (
                  <span key={c} className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-2">
                    {c}
                  </span>
                ))}
              </div>

              {!best ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-ink-2">
                    {r.segment.category && !r.segment.categoryInCatalog
                      ? `${r.segment.category} belum ada di katalog.`
                      : 'Tidak ada produk katalog yang cocok.'}{' '}
                    Ajukan sebagai barang custom agar Sales Support menghitung harganya.
                  </p>
                  {onCustomRequest && (
                    <Button size="sm" icon={<MessageSquarePlus className="size-4" />} onClick={() => onCustomRequest(r.segment.text, qty)}>
                      Ajukan barang custom
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <SuggestionRow s={best} inCart={cartQty(best.product.id)} onAdd={onAdd} onRequestPrice={onRequestPrice} />
                  {alts.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                      <span className="text-xs text-ink-3">Alternatif:</span>
                      {alts.map(a => (
                        <button
                          key={a.product.id}
                          onClick={() => onAdd(a.product.id, a.qty)}
                          title={[...a.reasons, ...a.warnings].join(' · ')}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-link hover:text-link cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-link/20"
                        >
                          <span className="truncate">{a.product.name}</span>
                          <span className="shrink-0 tabular-nums text-ink-3">{formatRupiah(a.product.basePrice)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SuggestionRow({
  s,
  inCart,
  onAdd,
  onRequestPrice,
}: {
  s: ProductSuggestion<Product>;
  inCart: number;
  onAdd: (id: string, qty: number) => void;
  onRequestPrice?: (product: Product, qty: number) => void;
}) {
  const p = s.product;
  return (
    <div className="mt-3 flex items-center gap-3">
      <ProductImage src={p.image} alt="" hint={p.category} className="size-14 shrink-0 rounded-lg border border-line" />
      <div className="min-w-0 flex-1">
        <p className={cx('text-[11px] font-semibold', s.confidence === 'high' ? 'text-emerald-700' : s.confidence === 'medium' ? 'text-link' : 'text-ink-3')}>
          {CONFIDENCE_LABEL[s.confidence]}
        </p>
        <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
        <p className="truncate text-xs text-ink-2">{s.reasons.join(' · ')}</p>
        {s.warnings.length > 0 && <p className="truncate text-xs text-amber-700">{s.warnings.join(' · ')}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {p.basePrice > 0 ? (
          <span className="text-[13px] font-semibold tabular-nums text-ink">{formatRupiah(p.basePrice)}</span>
        ) : (
          <span className="text-xs text-ink-3">Harga belum ada</span>
        )}
        {p.basePrice <= 0 ? (
          onRequestPrice && (
            <Button size="sm" icon={<MessageSquarePlus className="size-3.5" />} onClick={() => onRequestPrice(p, s.qty)}>
              Minta harga
            </Button>
          )
        ) : inCart ? (
          <span className="inline-flex h-8 items-center gap-1 text-xs font-semibold text-emerald-700">
            <Check className="size-3.5" /> Di keranjang ({inCart})
          </span>
        ) : (
          <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => onAdd(p.id, s.qty)}>
            Tambah {s.qty} {p.unit.toLowerCase()}
          </Button>
        )}
      </div>
    </div>
  );
}
