import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2, MessageSquarePlus } from 'lucide-react';
import type { Product } from '../types';
import { useStore } from '../store/AppStore';
import { agustaImageUrl, type AgustaProduct } from '../utils/agustaCatalog';
import { Button, ProductImage } from './ui';

/**
 * "Dari agusta.co.id": products on the company website that match the request but are not yet
 * priced in the portal. The website has no prices, so the action is "Minta harga" (a custom
 * request pre-filled with name, photo, specs and the product page).
 */
export function AgustaWebResults({
  query,
  catalog,
  onRequestPrice,
}: {
  query: string;
  catalog: Product[];
  onRequestPrice: (a: AgustaProduct) => void;
}) {
  const { searchAgusta } = useStore();
  const [state, setState] = useState<{ q: string; loading: boolean; error?: string; items: AgustaProduct[] }>({ q: '', loading: false, items: [] });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setState({ q: '', loading: false, items: [] });
      return;
    }
    let alive = true;
    const t = window.setTimeout(() => {
      setState(s => ({ ...s, q, loading: true, error: undefined }));
      searchAgusta(q)
        .then(items => alive && setState({ q, loading: false, items }))
        .catch(e => alive && setState({ q, loading: false, items: [], error: (e as Error).message }));
    }, 600);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [query, searchAgusta]);

  // Website products that are already priced in the portal show up in the normal list instead.
  const priced = new Set(catalog.filter(p => p.sourceId && p.basePrice > 0).map(p => p.sourceId));
  const items = state.items.filter(a => !priced.has(a.sourceId)).slice(0, 4);

  if (!query.trim() || (!state.loading && !state.error && items.length === 0)) return null;

  return (
    <section aria-label="Produk dari agusta.co.id" className="border-b border-line px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Globe className="size-4 text-link" strokeWidth={1.75} aria-hidden />
          Dari agusta.co.id
        </p>
        <p className="text-xs text-ink-3">Belum ada harga di portal. Minta harga ke Sales Support.</p>
      </div>

      {state.loading && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Mencari di website Agusta…
        </p>
      )}
      {state.error && !state.loading && <p className="mt-3 text-[13px] text-amber-700">{state.error}</p>}

      {!state.loading && items.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map(a => (
            <li key={a.sourceId} className="flex gap-3 rounded-xl border border-line p-2.5">
              <ProductImage src={agustaImageUrl(a.imagePath)} alt="" hint={a.category} className="size-14 shrink-0 rounded-lg border border-line" />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-link">{a.category}</p>
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{a.name}</p>
                {a.specs && <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{a.specs}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
                  <Button size="sm" icon={<MessageSquarePlus className="size-3.5" />} onClick={() => onRequestPrice(a)}>
                    Minta harga
                  </Button>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-strong"
                  >
                    Lihat di website <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
