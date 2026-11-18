/**
 * GET /api/supplier-search?q=…&sites=a.com,b.co.id — the item on supplier / distributor websites (R10),
 * for Sales Support / Management. Google web search through Serper.dev (SERPER_API_KEY, 1 credit per
 * search): restricted to the given sites, or — without sites — the open web minus marketplaces.
 * Without a key it answers in manual mode (no hits); the panel then offers search links.
 */
import { handle, HttpError, json, requireCallerIfConfigured } from './_lib/server.js';
import {
  MAX_SITES,
  buildSupplierQuery,
  cleanHits,
  mapSerperOrganic,
  normalizeDomain,
  type SupplierHit,
  type SupplierSearchResult,
} from '../src/utils/supplierSearch.js';

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: SupplierSearchResult }>();

export const GET = handle(async request => {
  await requireCallerIfConfigured(request, ['SALES_SUPPORT', 'MANAGEMENT']);
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
  if (q.length < 3) throw new HttpError(400, 'Tulis nama barang minimal 3 huruf.');
  const domains = [...new Set((params.get('sites') ?? '').split(',').map(normalizeDomain).filter(Boolean))].slice(0, MAX_SITES);
  const { q: googleQuery, scope } = buildSupplierQuery(q, domains);

  const key = process.env.SERPER_API_KEY;
  if (!key) return json({ mode: 'manual', scope, query: q, hits: [] } satisfies SupplierSearchResult);

  const cacheKey = googleQuery.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return json(hit.value);

  let res: Response;
  try {
    res = await fetch(`${process.env.SERPER_BASE_URL || 'https://google.serper.dev'}/search`, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      // num ≤ 10: free Serper accounts reject site: queries asking for more ("Query pattern not allowed").
      body: JSON.stringify({ q: googleQuery, gl: 'id', hl: 'id', location: 'Indonesia', num: 10 }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(504, 'Layanan pencarian tidak merespons. Coba lagi beberapa saat.');
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'API key Serper.dev ditolak. Periksa SERPER_API_KEY.');
  if (res.status === 429) throw new HttpError(429, 'Kuota pencarian Serper.dev habis atau terlalu sering. Coba lagi nanti.');
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { message?: string }).message;
    throw new HttpError(502, `Layanan pencarian mengembalikan status ${res.status}${detail ? `: ${detail}` : ''}.`);
  }

  const body = (await res.json().catch(() => ({}))) as { organic?: unknown[] };
  const sites = domains.map(d => ({ id: d, name: d, domain: d }));
  const hits = cleanHits((body.organic ?? []).map(o => mapSerperOrganic(o, sites)).filter((h): h is SupplierHit => h !== null)).slice(0, 15);
  const value: SupplierSearchResult = { mode: 'live', scope, query: q, hits };

  if (cache.size > 200) cache.clear();
  cache.set(cacheKey, { at: Date.now(), value });
  return json(value);
});
