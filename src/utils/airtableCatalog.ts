/**
 * Agusta's product catalog kept in Airtable ("produk katalog" → "Database all produk"), mapped to
 * catalog products. Shared by the server proxy (api/airtable-catalog.ts) and the browser.
 *
 * Airtable is the price master: a sync refreshes name, brand, category, price, specs and photo.
 * HPP stays in the portal (Supabase only), and stock is not in Airtable.
 * Imports keep the .js extension so the module also runs as native ESM on the server.
 */
import type { Product } from '../types/index.js';

export interface AirtableProduct {
  /** "airtable:rec…", stable across syncs. */
  sourceId: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  /** Selling price in rupiah; 0 when Airtable has none. */
  price: number;
  specs: string;
  dimensions?: string;
  /** Airtable attachment id of the first photo (photos are copied, Airtable's links expire). */
  imageId?: string;
  /** Photo URL to show; a copy in our own storage in Supabase mode. */
  image: string;
}

/** One page of the sync, as returned by /api/airtable-catalog. */
export interface AirtablePage {
  products: AirtableProduct[];
  /** Airtable's paging cursor; absent on the last page. */
  offset?: string;
}

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** "HighPoint Five Office Desk (BOD5052)" → "BOD5052". */
export function codeFromName(name: string): string {
  const m = name.match(/\(([A-Za-z0-9][A-Za-z0-9 ./-]{2,40})\)\s*$/);
  return m ? m[1]!.trim().toUpperCase().replace(/\s+/g, '-') : '';
}

/** "Chairman 700 C" → keywords for search: brand and category words. */
const keywordsFor = (brand: string, category: string) =>
  [...new Set([brand, ...category.split(/[\s/&]+/)].map(w => w.toLowerCase().trim()).filter(w => w.length >= 3))];

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A record of the products table → AirtableProduct (null when it has no name). */
export function mapAirtableRecord(rec: any): AirtableProduct | null {
  const f = rec?.fields ?? {};
  const name = clean(f['Product Name']);
  if (!rec?.id || !name) return null;
  const photo = Array.isArray(f['Product Images']) ? f['Product Images'].find((a: any) => /^image\//.test(a?.type ?? '')) : undefined;
  const price = Number(f.Price);
  const specs = [clean(f.Specifications), f.Materials && f.Materials !== '-' ? `Material: ${clean(f.Materials)}` : '']
    .filter(Boolean)
    .join('; ');
  const dimensions = clean(f.Dimensions);
  return {
    sourceId: `airtable:${rec.id}`,
    name: name.toUpperCase().slice(0, 200),
    sku: codeFromName(name) || `AT-${String(rec.id).replace(/^rec/, '').toUpperCase()}`,
    brand: clean(f.Brand).toUpperCase(),
    category: clean(f.Category) || 'Lainnya',
    price: Number.isFinite(price) && price > 0 ? Math.round(price) : 0,
    specs: specs.slice(0, 600),
    dimensions: dimensions && dimensions !== '-' ? dimensions.slice(0, 80) : undefined,
    imageId: photo?.id,
    // Thumbnail ~512px: plenty for the catalog and the PDF, a fraction of the original size.
    image: photo?.thumbnails?.large?.url ?? photo?.url ?? '',
  };
}

/** An Airtable product as a catalog product (demo mode; Supabase does the same in SQL). */
export function productFromAirtable(a: AirtableProduct): Product {
  return {
    id: `at-${a.sourceId.replace(/^airtable:/, '')}`,
    name: a.name,
    sku: a.sku,
    category: a.category,
    brand: a.brand,
    basePrice: a.price,
    cogs: 0,
    image: a.image,
    stock: 0,
    unit: 'Unit',
    dimensions: a.dimensions,
    specs: a.specs,
    description: '',
    keywords: keywordsFor(a.brand, a.category),
    sourceId: a.sourceId,
  };
}

export { keywordsFor as airtableKeywords };
