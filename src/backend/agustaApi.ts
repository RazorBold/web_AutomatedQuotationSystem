import type { Product } from '../types';
import { agustaImageUrl, type AgustaProduct } from '../utils/agustaCatalog';
import type { MarketSearchResult } from '../utils/marketResearch';

type TokenGetter = () => Promise<string | null>;

async function getJson<T>(path: string, token: TokenGetter): Promise<T> {
  const t = await token();
  const res = await fetch(path, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Pencarian gagal (status ${res.status}).`);
  return body;
}

/** Calls to /api/agusta-search, shared by both backends (Supabase adds the session token). */
export function agustaApi(token: TokenGetter = async () => null) {
  return {
    searchAgusta: async (query: string) =>
      (await getJson<{ products: AgustaProduct[] }>(`/api/agusta-search?q=${encodeURIComponent(query)}`, token)).products,
    fetchAgustaPage: (page: number) =>
      getJson<{ products: AgustaProduct[]; page: number; lastPage: number; total: number }>(`/api/agusta-search?page=${page}`, token),
    searchMarket: (query: string) => getJson<MarketSearchResult>(`/api/market-search?q=${encodeURIComponent(query)}`, token),
  };
}

/** A website product as a catalog product. The website has no prices: basePrice/cogs start at 0. */
export function productFromAgusta(a: AgustaProduct): Product {
  return {
    id: `agusta-${a.sourceId}`,
    name: a.name.toUpperCase(),
    sku: a.sku,
    category: a.category,
    brand: '',
    basePrice: 0,
    cogs: 0,
    image: agustaImageUrl(a.imagePath),
    stock: 0,
    unit: 'Unit',
    specs: a.specs,
    description: a.description.slice(0, 240),
    keywords: [a.categorySlug.replace(/-/g, ' ')],
    sourceId: a.sourceId,
    sourceUrl: a.url,
  };
}

/** Same product, matched by website id first, then by name. */
export const sameProduct = (p: Product, a: AgustaProduct) =>
  p.sourceId === a.sourceId || (!p.sourceId && p.name.trim().toUpperCase() === a.name.trim().toUpperCase());
