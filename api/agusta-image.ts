/**
 * GET /api/agusta-image?p=products/<file>.png
 * Same-origin proxy for agusta.co.id product photos, used only when a photo is drawn into the PDF:
 * agusta.co.id sends no CORS headers, so the browser may not read those pixels directly.
 * (On screen, photos load straight from agusta.co.id.) Only /storage/products/<file> is allowed.
 *
 * agusta.co.id serves large PNGs slowly, so the timeout is generous and the response is cached
 * at the CDN for a year (file names are content IDs and never change).
 */
import { AGUSTA_ORIGIN, SAFE_IMAGE_PATH } from '../src/utils/agustaCatalog.js';

export const config = { maxDuration: 60 };

export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams.get('p') ?? '';
  if (!SAFE_IMAGE_PATH.test(p)) return new Response('Bad image path', { status: 400 });

  try {
    const upstream = await fetch(`${AGUSTA_ORIGIN}/storage/${p}`, {
      headers: { 'User-Agent': 'AgustaQuotationPortal/1.0 (portal internal Agusta)' },
      signal: AbortSignal.timeout(55_000),
    });
    const type = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !type.startsWith('image/')) return new Response('Not found', { status: 404 });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' },
    });
  } catch {
    return new Response('agusta.co.id tidak merespons', { status: 504 });
  }
}
