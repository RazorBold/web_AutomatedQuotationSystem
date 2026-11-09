/**
 * Market price research for custom requests: comparable offers on the web (Google Shopping via
 * Serper.dev, server side) or, without an API key, ready-made search links for manual research.
 * Shared by api/market-search.ts and the browser. Imports keep .js for native ESM on the server.
 */

export interface MarketOffer {
  title: string;
  /** Store / marketplace name as Google Shopping reports it ("Tokopedia - Toko ABC", "Bhinneka"…). */
  store: string;
  /** Price in rupiah, 0 when unknown. */
  price: number;
  priceText: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  delivery?: string;
}

export interface MarketStats {
  count: number;
  min: number;
  median: number;
  max: number;
}

export interface MarketLink {
  label: string;
  url: string;
}

export interface MarketSearchResult {
  /** live = offers from the search API; manual = API not configured, use the links. */
  mode: 'live' | 'manual';
  query: string;
  offers: MarketOffer[];
  stats: MarketStats | null;
  links: MarketLink[];
}

/** Supplier chosen as price reference for a custom request (Sales Support only). */
export interface SupplierRef {
  name: string;
  url?: string;
  price: number;
}

/**
 * "Rp 3.450.000" · "Rp3,450,000" · "Rp 1,2 jt" · "IDR 950.000,00" → rupiah.
 * Returns 0 when no amount can be read.
 */
export function parseRupiah(text: string | number | undefined | null): number {
  if (typeof text === 'number') return Number.isFinite(text) ? Math.round(text) : 0;
  if (!text) return 0;
  const s = String(text).toLowerCase().replace(/\s+/g, ' ');
  const short = s.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta|rb|ribu|k)\b/);
  if (short) {
    const n = Number(short[1]!.replace(',', '.'));
    return Math.round(n * (/(jt|juta)/.test(short[2]!) ? 1_000_000 : 1_000));
  }
  const m = s.match(/\d[\d.,]*/);
  if (!m) return 0;
  let num = m[0];
  // Drop a trailing decimal part (",00" / ".00").
  num = num.replace(/[.,]\d{1,2}$/, '');
  return Number(num.replace(/[.,]/g, '')) || 0;
}

export function marketStats(offers: MarketOffer[]): MarketStats | null {
  const prices = offers.map(o => o.price).filter(p => p > 0).sort((a, b) => a - b);
  if (!prices.length) return null;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2);
  return { count: prices.length, min: prices[0]!, median, max: prices[prices.length - 1]! };
}

/**
 * Drops prices far from the pack (accessories, bulk lots, typos): keeps offers within
 * 1/4×–4× of the median. Offers without a price are kept at the end.
 */
export function cleanOffers(offers: MarketOffer[]): MarketOffer[] {
  const stats = marketStats(offers);
  const priced = offers.filter(o => o.price > 0 && (!stats || (o.price >= stats.median / 4 && o.price <= stats.median * 4)));
  return [...priced.sort((a, b) => a.price - b.price), ...offers.filter(o => o.price <= 0)];
}

/** Search pages for manual research (always available, no API needed). */
export function marketLinks(query: string): MarketLink[] {
  const q = encodeURIComponent(query.trim());
  return [
    { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&hl=id&gl=id&q=${q}` },
    { label: 'Tokopedia', url: `https://www.tokopedia.com/search?st=product&q=${q}` },
    { label: 'Shopee', url: `https://shopee.co.id/search?keyword=${q}` },
    { label: 'Bhinneka', url: `https://www.bhinneka.com/jual?cari=${q}` },
    { label: 'Blibli', url: `https://www.blibli.com/cari/${q}` },
  ];
}

/** Maps one Serper.dev shopping result; tolerant of missing fields. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapSerperShopping(item: any): MarketOffer | null {
  if (!item || !item.title || !item.link) return null;
  const priceText = String(item.price ?? '').trim();
  return {
    title: String(item.title).slice(0, 200),
    store: String(item.source ?? item.merchant ?? '').slice(0, 120) || 'Toko online',
    price: parseRupiah(item.price ?? item.extractedPrice),
    priceText,
    url: String(item.link),
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
    rating: typeof item.rating === 'number' ? item.rating : undefined,
    ratingCount: typeof item.ratingCount === 'number' ? item.ratingCount : undefined,
    delivery: typeof item.delivery === 'string' ? item.delivery : undefined,
  };
}

/** Selling price that yields `marginPercent` gross margin on `cost`, rounded up to Rp 1.000. */
export function priceForMargin(cost: number, marginPercent: number): number {
  if (cost <= 0 || marginPercent >= 100) return 0;
  return Math.ceil(cost / (1 - marginPercent / 100) / 1000) * 1000;
}
