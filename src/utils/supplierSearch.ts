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

/** Drops marketplace hits (open-web mode) and keeps priced results first. */
export function cleanHits(hits: SupplierHit[]): SupplierHit[] {
  const ok = hits.filter(h => !MARKETPLACES.some(m => h.domain === m || h.domain.endsWith(`.${m}`)));
  return [...ok.filter(h => h.price > 0), ...ok.filter(h => h.price <= 0)];
}
