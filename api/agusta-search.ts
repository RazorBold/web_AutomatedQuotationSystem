/**
 * GET /api/agusta-search?q=…   → products on agusta.co.id that match a sales request (ranked)
 * GET /api/agusta-search?page=N → one raw catalog page (12 products), used by "Sinkronkan katalog"
 *
 * The website's own search only does plain text matching, so a request like
 * "20 kursi ergonomis di bawah 2,5 juta" is reduced to search words first (via the smart-search
 * parser), several website searches are combined, and the union is ranked with our engine.
 */
import { handle, HttpError, json, requireCallerIfConfigured } from './_lib/server.js';
import { fetchAgustaList } from './_lib/agusta.js';
import type { AgustaProduct } from '../src/utils/agustaCatalog.js';
import { parseSalesRequest, rankProducts } from '../src/utils/smartSearch.js';

const MAX_WEBSITE_QUERIES = 4;

function websiteQueries(q: string): string[] {
  const segments = parseSalesRequest(q, []);
  const out: string[] = [];
  const push = (s: string | undefined) => {
    const v = (s ?? '').trim();
    if (v.length >= 3 && !out.includes(v)) out.push(v);
  };
  for (const s of segments) {
    // The rep's own first two words ("dry cabinet", "kursi direktur") are usually the product name.
    const own = s.text
      .toLowerCase()
      .replace(/[^a-z\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !/^(unit|pcs|buah|set|untuk|dengan|yang|dan|di|bawah|atas|juta|ribu|harga|budget|maks|sekitar)$/.test(w));
    push(own.slice(0, 2).join(' '));
    const words = s.terms.filter(t => !['highback', 'mediumback'].includes(t));
    push([s.category, ...words].filter(Boolean).join(' '));
    push(words.join(' '));
    push(s.category);
    words.filter(w => w.length >= 4).sort((a, b) => b.length - a.length).forEach(push);
    if (s.cpu) push(`i${s.cpu}`);
  }
  if (!out.length) push(q.replace(/\d+/g, ' ').replace(/\s+/g, ' '));
  return out;
}

export const GET = handle(async request => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
  const page = Number(url.searchParams.get('page') ?? '0');

  if (!q && page >= 1) {
    await requireCallerIfConfigured(request, ['SALES_SUPPORT', 'MANAGEMENT']);
    return json(await fetchAgustaList({ page: Math.min(page, 1000) }));
  }

  await requireCallerIfConfigured(request);
  if (q.length < 3) throw new HttpError(400, 'Tulis minimal 3 huruf.');

  const found = new Map<string, AgustaProduct>();
  const tried: string[] = [];
  for (const term of websiteQueries(q)) {
    if (tried.length >= MAX_WEBSITE_QUERIES || found.size >= 24) break;
    tried.push(term);
    const res = await fetchAgustaList({ q: term });
    res.products.forEach(p => found.set(p.sourceId, p));
  }

  const candidates = [...found.values()].map(p => ({ ...p, id: p.sourceId, keywords: [p.categorySlug.replace(/-/g, ' ')] }));
  // Only what our engine considers a match: a rep asking for a projector must not get printers.
  const products = rankProducts(candidates, q)
    .slice(0, 8)
    .map(({ id: _id, keywords: _k, ...p }) => p);
  return json({ products, queries: tried });
});
