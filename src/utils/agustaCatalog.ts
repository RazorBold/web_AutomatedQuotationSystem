/**
 * agusta.co.id catalog: parsing and mapping, shared by the server proxy (api/agusta-search.ts)
 * and the browser. agusta.co.id is a Laravel + Inertia site; every page embeds its data as JSON in
 * the `data-page` attribute, which is far more stable to read than the rendered HTML.
 *
 *   list    https://agusta.co.id/product?page=N         (12 per page)
 *   search  https://agusta.co.id/product?q=...
 *   detail  https://agusta.co.id/product/{category}/{slug}
 *   photo   https://agusta.co.id/storage/{path}
 *
 * The website has no prices: imported products need a price from Sales Support before quoting.
 * Imports keep the .js extension so the module also runs as native ESM on the server.
 */

export const AGUSTA_ORIGIN = 'https://agusta.co.id';

export interface AgustaProduct {
  /** agusta.co.id product id, as string. */
  sourceId: string;
  name: string;
  sku: string;
  slug: string;
  category: string;
  categorySlug: string;
  /** Storage path of the main photo, e.g. "products/01M3….png". */
  imagePath?: string;
  /** Flattened specifications, "Merek: Procore; Tipe: PC-600S; …". */
  specs: string;
  description: string;
  url: string;
}

/** Website category slugs that correspond to the portal's existing category names. */
const CATEGORY_ALIASES: Record<string, string> = {
  'kursi-kantor-semarang': 'Kursi Kantor',
  'kursi-kantor': 'Kursi Kantor',
  'kursi-tunggu': 'Kursi Tunggu',
  aio: 'AIO',
  laptop: 'Laptop',
  'meja-rapat': 'Meja Rapat',
  'meja-kerja': 'Meja Kerja',
  'meja-kerja-partisi': 'Meja Kerja Partisi',
  'lemari-arsip': 'Lemari Arsip',
  proyektor: 'Proyektor',
};

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Extracts the Inertia page object from an agusta.co.id HTML page. */
export function parseInertiaPage(html: string): { component: string; props: Record<string, unknown> } | null {
  const m = html.match(/data-page="([^"]*)"/);
  if (!m) return null;
  try {
    return JSON.parse(decodeEntities(m[1]!));
  } catch {
    return null;
  }
}

export function specsToText(specs: unknown, max = 600): string {
  if (!specs || typeof specs !== 'object') return '';
  return Object.entries(specs as Record<string, unknown>)
    .map(([k, v]) => `${clean(k)}: ${clean(v)}`)
    .filter(s => !/^:\s*$/.test(s) && !s.endsWith(': '))
    .join('; ')
    .slice(0, max);
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase());

export function portalCategory(name: string, slug: string): string {
  return CATEGORY_ALIASES[slug] ?? titleCase(clean(name) || 'Lainnya');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapAgustaProduct(raw: any): AgustaProduct | null {
  if (!raw || !raw.id || !raw.name) return null;
  const categorySlug = String(raw.category?.slug ?? 'uncategorized');
  const imagePath = raw.thumbnail || (Array.isArray(raw.images) ? raw.images[0] : undefined);
  return {
    sourceId: String(raw.id),
    name: clean(raw.name),
    sku: clean(raw.sku) || `AGT-${raw.id}`,
    slug: String(raw.slug ?? ''),
    category: portalCategory(raw.category?.name ?? '', categorySlug),
    categorySlug,
    imagePath: typeof imagePath === 'string' && imagePath ? imagePath : undefined,
    specs: specsToText(raw.specifications),
    description: clean(raw.short_description || raw.description).slice(0, 400),
    url: `${AGUSTA_ORIGIN}/product/${categorySlug}/${raw.slug}`,
  };
}

/** The list page payload: products plus pagination. */
export function parseProductListPage(html: string): { products: AgustaProduct[]; page: number; lastPage: number; total: number } | null {
  const page = parseInertiaPage(html);
  const list = page?.props?.products as { data?: unknown[]; current_page?: number; last_page?: number; total?: number } | undefined;
  if (!list || !Array.isArray(list.data)) return null;
  return {
    products: list.data.map(mapAgustaProduct).filter((p): p is AgustaProduct => p !== null),
    page: Number(list.current_page ?? 1),
    lastPage: Number(list.last_page ?? 1),
    total: Number(list.total ?? 0),
  };
}

/** Direct photo URL on agusta.co.id, for display. */
export function agustaImageUrl(imagePath: string | undefined): string {
  return imagePath ? `${AGUSTA_ORIGIN}/storage/${imagePath}` : '';
}

/**
 * For drawing into the PDF: agusta.co.id photos go through our same-origin proxy (the site sends no
 * CORS headers, so the browser would refuse to read the pixels). Other URLs are returned unchanged.
 */
export function pdfSafeImageUrl(src: string): string {
  const prefix = `${AGUSTA_ORIGIN}/storage/`;
  if (!src.startsWith(prefix)) return src;
  const path = src.slice(prefix.length);
  return SAFE_IMAGE_PATH.test(path) ? `/api/agusta-image?p=${encodeURIComponent(path)}` : '';
}

/** Only plain photo files under /storage/products/ may be proxied. */
export const SAFE_IMAGE_PATH = /^products\/[A-Za-z0-9_-]{6,80}\.(png|jpe?g|webp)$/;
