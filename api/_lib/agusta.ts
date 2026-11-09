/**
 * Polite fetcher for agusta.co.id: identifies itself, times out, and caches pages for 10 minutes
 * (per warm serverless instance) so repeated searches don't hit the website again.
 */
import { AGUSTA_ORIGIN, parseProductListPage, type AgustaProduct } from '../../src/utils/agustaCatalog.js';
import { HttpError } from './server.js';

const USER_AGENT = 'AgustaQuotationPortal/1.0 (portal internal Agusta; katalog sync)';
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: ListResult }>();

export interface ListResult {
  products: AgustaProduct[];
  page: number;
  lastPage: number;
  total: number;
}

export async function fetchAgustaList(params: { q?: string; page?: number }): Promise<ListResult> {
  const url = new URL('/product', AGUSTA_ORIGIN);
  if (params.q) url.searchParams.set('q', params.q);
  if (params.page && params.page > 1) url.searchParams.set('page', String(params.page));
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let res: Response;
  try {
    res = await fetch(key, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new HttpError(504, 'agusta.co.id tidak merespons. Coba lagi beberapa saat.');
  }
  if (!res.ok) throw new HttpError(502, `agusta.co.id mengembalikan status ${res.status}.`);
  const parsed = parseProductListPage(await res.text());
  if (!parsed) throw new HttpError(502, 'Format halaman agusta.co.id berubah; data produk tidak terbaca.');

  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), value: parsed });
  return parsed;
}
