/**
 * R10: look for a custom item on supplier / distributor websites rather than marketplaces.
 * With a supplier list the Google web search is restricted to those sites (site:a OR site:b);
 * without one it searches the open web and leaves out the big marketplaces, which the
 * Google Shopping tab already covers. Shared by api/supplier-search.ts and the browser.
 */
import { parseRupiah } from './marketResearch.js';

export interface SupplierSite {
  id: string;
  name: string;
  /** Bare host, e.g. "chitose-indonesia.com". */
  domain: string;
}

export interface SupplierHit {
  title: string;
  url: string;
  domain: string;
  /** Supplier name from the list, or the domain. */
  supplier: string;
  snippet: string;
  /** Rupiah amount found on the result, 0 when the page shows no price in the search result. */
  price: number;
}

export interface SupplierSearchResult {
  mode: 'live' | 'manual';
  /** SITES = restricted to the supplier list; WEB = open web minus marketplaces. */
  scope: 'SITES' | 'WEB';
  query: string;
  hits: SupplierHit[];
}

export const MARKETPLACES = [
  'tokopedia.com',
  'shopee.co.id',
  'bukalapak.com',
  'blibli.com',
  'lazada.co.id',
  'bhinneka.com',
  'tiktok.com',
  'facebook.com',
  'instagram.com',
  'youtube.com',
];

export const MAX_SITES = 15;

/** "https://www.Chitose-Indonesia.com/produk" → "chitose-indonesia.com"; "" when not a domain. */
export function normalizeDomain(input: string): string {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#:]/, 1)[0]!;
  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host) ? host : '';
}

export const hostOf = (url: string) => normalizeDomain(url);

/** Google query for the supplier search. */
export function buildSupplierQuery(query: string, domains: string[]): { q: string; scope: 'SITES' | 'WEB' } {
  const base = query.replace(/\s+/g, ' ').trim();
  const sites = [...new Set(domains.map(normalizeDomain).filter(Boolean))].slice(0, MAX_SITES);
  if (sites.length) return { q: `${base} (${sites.map(d => `site:${d}`).join(' OR ')})`, scope: 'SITES' };
  return { q: `${base} harga ${MARKETPLACES.map(d => `-site:${d}`).join(' ')}`, scope: 'WEB' };
}

/** First "Rp …" amount in a text (prices on supplier pages nearly always carry the currency). */
export function extractPrice(text: string): number {
  const m = text.match(/(?:rp|idr)\.?\s*(\d[\d.,]*(?:\s*(?:jt|juta|rb|ribu))?)/i);
  if (!m) return 0;
  const v = parseRupiah(m[1]!);
  return v >= 1000 ? v : 0;
}

/** Maps one Serper.dev organic result; tolerant of missing fields. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapSerperOrganic(item: any, sites: SupplierSite[]): SupplierHit | null {
  if (!item || !item.title || !item.link) return null;
  const url = String(item.link);
  const domain = hostOf(url);
  if (!domain) return null;
  const site = sites.find(s => domain === s.domain || domain.endsWith(`.${s.domain}`));
  const snippet = String(item.snippet ?? '').slice(0, 300);
  const priceText = [item.price, item.priceRange, item.title, snippet].filter(Boolean).join(' ');
  return {
    title: String(item.title).slice(0, 200),
    url,
    domain,
    supplier: site?.name ?? domain,
    snippet,
    price: extractPrice(priceText),
  };
}

/** Documents and company pages, not product pages: annual reports, news, careers, contact, … */
const DOCUMENT_URL = /\.(pdf|docx?|xlsx?|pptx?|zip|rar)(?:$|[?#])|\/(downloads?|uploads?\/.*\.pdf|investor|career|karir|news|berita|blog|artikel|articles?|inspirasi|inspirations?|ide|ideas|tips|panduan|guides?|press|about|tentang|contact|kontak|privacy|terms|sitemap|login|register)(?:[/?#.-]|$)/i;
const NON_PRODUCT_TEXT =
  /laporan (tahunan|keuangan|keberlanjutan)|annual report|sustainability report|financial statement|investor|prospektus|rups|siaran pers|press release|lowongan|karir|career|tentang kami|about us|hubungi kami|contact us|kebijakan privasi|privacy policy|syarat (dan|&) ketentuan|terms (and|&) conditions|\bberita\b|\bnews\b|\bblog\b|hadir di|\bpameran\b|\bevent\b|\bwebinar\b|\bpenghargaan\b|\bseminar\b|^\s*\d+\s+(rekomendasi|tips|cara|ide)|\brekomendasi\b|\btips\b|^cara\b|daftar (jenis|harga)|jenis[- ]jenis/i;

/** URL segments that shops and catalogs use for product pages. */
const PRODUCT_URL = /\/(products?|produk|shop|store|toko|items?|katalog|catalog(ue)?|collections?|p|detail|jual)\//i;
const STOP_WORDS = new Set(['dan', 'dengan', 'untuk', 'yang', 'atau', 'the', 'and', 'for', 'unit', 'pcs', 'set']);

/** Search words that should appear in a product title ("kursi auditorium lipat" → kursi, auditorium, lipat). */
export const queryWords = (query: string) =>
  [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)))];

/**
 * True for a page that is shown as a product: never the home page, a document or a company/news page,
 * and with at least one product signal — a price, a product-style URL, or every search word in the title.
 */
export function isProductHit(h: Pick<SupplierHit, 'url' | 'title' | 'snippet'> & { price?: number }, query = ''): boolean {
  let path = '';
  try {
    path = new URL(h.url).pathname.replace(/\/+$/, '');
  } catch {
    return false;
  }
  if (!path || /^\/(id|en|id-id|en-us|index\.(html?|php))?$/i.test(path)) return false;
  if (DOCUMENT_URL.test(h.url) || NON_PRODUCT_TEXT.test(`${h.title} ${h.snippet}`)) return false;
  if ((h.price ?? 0) > 0 || PRODUCT_URL.test(`${path}/`)) return true;
  const words = queryWords(query);
  const title = h.title.toLowerCase();
  return words.length > 0 && words.every(w => title.includes(w));
}

const onDomain = (domain: string, d: string) => domain === d || domain.endsWith(`.${d}`);

/**
 * Drops marketplace hits, non-product pages and — when a supplier list is given — anything outside it
 * (Google does not always honour the site: filter). Priced results first.
 */
export function cleanHits(hits: SupplierHit[], domains: string[] = [], query = ''): SupplierHit[] {
  const ok = hits.filter(
    h =>
      !MARKETPLACES.some(m => onDomain(h.domain, m)) &&
      (!domains.length || domains.some(d => onDomain(h.domain, d))) &&
      isProductHit(h, query)
  );
  return [...ok.filter(h => h.price > 0), ...ok.filter(h => h.price <= 0)];
}
