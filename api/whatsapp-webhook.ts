/**
 * Meta WhatsApp webhook — delivery receipts (sent → delivered → read / failed).
 * Configure in Meta App Dashboard → WhatsApp → Configuration:
 *   Callback URL: https://<domain>/api/whatsapp-webhook
 *   Verify token: value of WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   Subscribe to: messages
 * If WHATSAPP_APP_SECRET is set, the X-Hub-Signature-256 header is verified.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { admin, json } from './_lib/server.js';

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (expected && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === expected) {
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

const STATUS_MAP: Record<string, string> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
const RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    const sig = request.headers.get('x-hub-signature-256') ?? '';
    const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
    const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return new Response('Invalid signature', { status: 401 });
  }

  let body: { entry?: { changes?: { value?: { statuses?: { id: string; status: string }[] } }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: true });
  }

  const statuses = (body.entry ?? []).flatMap(e => (e.changes ?? []).flatMap(c => c.value?.statuses ?? []));
  const db = admin();
  for (const s of statuses) {
    const next = STATUS_MAP[s.status];
    if (!next) continue;
    const { data: q } = await db.from('quotations').select('id, whatsapp_status').eq('whatsapp_message_id', s.id).maybeSingle();
    // Receipts can arrive out of order; never move backwards (except to FAILED).
    if (q && (next === 'FAILED' || (RANK[next] ?? 0) > (RANK[q.whatsapp_status ?? 'PENDING'] ?? 0))) {
      await db.from('quotations').update({ whatsapp_status: next }).eq('id', q.id);
    }
  }
  // Meta retries on non-2xx, so always acknowledge.
  return json({ ok: true });
}
