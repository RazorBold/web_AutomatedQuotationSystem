/**
 * GET /api/market-search?q=… — comparable offers on the web for a custom request (Sales Support / Management).
 *
 * Live mode: Google Shopping results through Serper.dev (SERPER_API_KEY). Google itself does not allow
 * automated scraping of its result pages, so a search API is the supported way to "crawl" Google.
 * Without a key the endpoint answers in manual mode: no offers, only search links to open.
 */
import { handle, HttpError, json, requireCallerIfConfigured } from './_lib/server.js';
import { cleanOffers, mapSerperShopping, marketLinks, marketStats, type MarketOffer, type MarketSearchResult } from '../src/utils/marketResearch.js';

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: MarketSearchResult }>();

export const GET = handle(async request => {
  await requireCallerIfConfigured(request, ['SALES_SUPPORT', 'MANAGEMENT']);
  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
  if (q.length < 3) throw new HttpError(400, 'Tulis nama barang minimal 3 huruf.');

  const links = marketLinks(q);
  const key = process.env.SERPER_API_KEY;
  if (!key) {
    return json({ mode: 'manual', query: q, offers: [], stats: null, links } satisfies MarketSearchResult);
  }

  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < TTL_MS) return json(hit.value);

  let res: Response;
  try {
    res = await fetch(`${process.env.SERPER_BASE_URL || 'https://google.serper.dev'}/shopping`, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, gl: 'id', hl: 'id', location: 'Indonesia' }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(504, 'Layanan pencarian harga tidak merespons. Coba lagi beberapa saat.');
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'API key Serper.dev ditolak. Periksa SERPER_API_KEY.');
  if (res.status === 429) throw new HttpError(429, 'Kuota pencarian Serper.dev habis atau terlalu sering. Coba lagi nanti.');
  if (!res.ok) throw new HttpError(502, `Layanan pencarian harga mengembalikan status ${res.status}.`);

  const body = (await res.json().catch(() => ({}))) as { shopping?: unknown[] };
  const offers = cleanOffers(
    (body.shopping ?? []).map(mapSerperShopping).filter((o): o is MarketOffer => o !== null)
  ).slice(0, 20);
  const value: MarketSearchResult = { mode: 'live', query: q, offers, stats: marketStats(offers), links };

  if (cache.size > 200) cache.clear();
  cache.set(q.toLowerCase(), { at: Date.now(), value });
  return json(value);
});
