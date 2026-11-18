/**
 * GET /api/airtable-catalog?offset=…  → one page (100 products) of Agusta's Airtable catalog,
 * used by "Sinkronkan dari Airtable" (Sales Support / Management).
 *
 * Airtable photo links expire after a few hours, so in Supabase mode each photo is copied once into
 * the public `product-images` bucket and the product points at that copy. Photos already copied
 * (same Airtable attachment id) are not downloaded again.
 *
 * Env: AIRTABLE_TOKEN (personal access token, read-only scopes), AIRTABLE_BASE_ID, AIRTABLE_PRODUCTS_TABLE.
 */
import { admin, handle, HttpError, json, requireCallerIfConfigured, supabaseConfigured } from './_lib/server.js';
import { mapAirtableRecord, type AirtablePage, type AirtableProduct } from '../src/utils/airtableCatalog.js';

const BUCKET = 'product-images';
const PHOTO_CONCURRENCY = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

async function fetchPage(offset: string | null) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_PRODUCTS_TABLE;
  if (!token || !base || !table) {
    throw new HttpError(503, 'Airtable belum disambungkan: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, dan AIRTABLE_PRODUCTS_TABLE wajib diisi.');
  }
  const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(base)}/${encodeURIComponent(table)}`);
  url.searchParams.set('pageSize', '100');
  if (offset) url.searchParams.set('offset', offset);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'Token Airtable ditolak. Periksa token dan akses base-nya.');
  if (res.status === 422 && offset) throw new HttpError(409, 'Sesi sinkronisasi Airtable kedaluwarsa. Mulai ulang sinkronisasi.');
  if (!res.ok) throw new HttpError(502, `Airtable tidak bisa dihubungi (status ${res.status}). Coba lagi beberapa saat.`);
  return (await res.json()) as { records: unknown[]; offset?: string };
}

/** Copies photos not yet in storage; returns the products with their stored photo URL. */
async function storePhotos(products: AirtableProduct[]): Promise<AirtableProduct[]> {
  const db = admin();
  const publicUrl = (path: string) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // Photos already copied on an earlier sync: the stored URL contains the attachment id.
  const { data: existing } = await db
    .from('products')
    .select('source_id, image')
    .in('source_id', products.map(p => p.sourceId));
  const stored = new Map((existing ?? []).map(r => [r.source_id as string, (r.image as string) ?? '']));

  const queue = [...products];
  const out = new Map<string, AirtableProduct>();
  const work = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      if (!p.imageId || !p.image) {
        out.set(p.sourceId, { ...p, image: '' });
        continue;
      }
      const current = stored.get(p.sourceId) ?? '';
      if (current.includes(`/${BUCKET}/airtable/${p.imageId}.`)) {
        out.set(p.sourceId, { ...p, image: current });
        continue;
      }
      try {
        const res = await fetch(p.image);
        const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
        const ext = EXT[type];
        const body = res.ok && ext ? await res.arrayBuffer() : null;
        if (!body || !ext || body.byteLength > MAX_PHOTO_BYTES) throw new Error(`photo ${res.status} ${type}`);
        const path = `airtable/${p.imageId}.${ext}`;
        const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: true, cacheControl: '31536000' });
        if (error) throw error;
        out.set(p.sourceId, { ...p, image: publicUrl(path) });
      } catch (e) {
        // A missing photo must not stop the sync; the product keeps its current photo.
        console.warn('airtable photo', p.sourceId, e instanceof Error ? e.message : e);
        out.set(p.sourceId, { ...p, image: current });
      }
    }
  };
  await Promise.all(Array.from({ length: PHOTO_CONCURRENCY }, work));
  return products.map(p => out.get(p.sourceId)!);
}

export const GET = handle(async request => {
  await requireCallerIfConfigured(request, ['SALES_SUPPORT', 'MANAGEMENT']);
  const offset = new URL(request.url).searchParams.get('offset');
  const page = await fetchPage(offset && /^[A-Za-z0-9/._-]{1,200}$/.test(offset) ? offset : null);
  const products = page.records.map(mapAirtableRecord).filter((p): p is AirtableProduct => p !== null);
  const body: AirtablePage = {
    products: supabaseConfigured() ? await storePhotos(products) : products,
    offset: page.offset,
  };
  return json(body);
});
