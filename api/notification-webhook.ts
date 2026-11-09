/**
 * POST /api/notification-webhook — called by a Supabase Database Webhook on INSERT into public.notifications.
 * Forwards the notification to the recipient's WhatsApp (template WHATSAPP_NOTIFY_TEMPLATE_NAME).
 *
 * Setup (Supabase Dashboard → Database → Webhooks → Create):
 *   Table: notifications · Events: Insert · Type: HTTP Request · Method: POST
 *   URL: https://<domain>/api/notification-webhook
 *   HTTP header: x-webhook-secret = <NOTIFY_WEBHOOK_SECRET>
 *
 * Which types go to WhatsApp: WHATSAPP_NOTIFY_TYPES (comma list, or "none").
 * Default: everything except QUOTATION_APPROVED, because that one already gets the PDF message.
 * Without WhatsApp credentials the send is simulated and recorded as SIMULATED.
 */
import { timingSafeEqual } from 'node:crypto';
import { admin, json } from './_lib/server.js';
import { buildWhatsAppNotificationPayload, normalizeWhatsAppNumber } from '../src/utils/whatsapp.js';

const DEFAULT_TYPES = [
  'QUOTATION_SUBMITTED',
  'QUOTATION_RESUBMITTED',
  'QUOTATION_REJECTED',
  'CUSTOM_REQUEST_SUBMITTED',
  'CUSTOM_REQUEST_PRICED',
  'CUSTOM_REQUEST_APPROVED',
  'CUSTOM_REQUEST_REJECTED',
];

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  whatsapp_status: string | null;
}

function secretOk(request: Request): boolean {
  const expected = process.env.NOTIFY_WEBHOOK_SECRET;
  const got = request.headers.get('x-webhook-secret') ?? '';
  if (!expected) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!secretOk(request)) return json({ error: 'Unauthorized' }, 401);

  const payload = (await request.json().catch(() => null)) as { type?: string; table?: string; record?: NotificationRow } | null;
  const n = payload?.record;
  if (payload?.type !== 'INSERT' || payload.table !== 'notifications' || !n?.id) return json({ ok: true, skipped: 'not a notification insert' });
  if (n.whatsapp_status) return json({ ok: true, skipped: 'already handled' }); // webhook retries

  const db = admin();
  const mark = (status: 'SKIPPED' | 'SIMULATED' | 'SENT' | 'FAILED', error?: string) =>
    db.from('notifications').update({ whatsapp_status: status, whatsapp_error: error ?? null }).eq('id', n.id);

  const configured = (process.env.WHATSAPP_NOTIFY_TYPES ?? '').trim();
  const types = configured ? (configured.toLowerCase() === 'none' ? [] : configured.split(',').map(s => s.trim())) : DEFAULT_TYPES;
  if (!types.includes(n.type)) {
    await mark('SKIPPED');
    return json({ ok: true, skipped: 'type not enabled for WhatsApp' });
  }

  const { data: user } = await db.from('profiles').select('name, phone, status').eq('id', n.user_id).maybeSingle();
  if (!user || user.status !== 'ACTIVE' || normalizeWhatsAppNumber(user.phone ?? '').length < 10) {
    await mark('SKIPPED', 'Penerima tidak aktif atau nomor WhatsApp belum valid');
    return json({ ok: true, skipped: 'no valid recipient' });
  }

  const message = buildWhatsAppNotificationPayload({
    phone: user.phone,
    recipientName: user.name,
    title: n.title,
    body: n.body,
    portalUrl: process.env.APP_URL || 'portal penawaran Agusta',
    templateName: process.env.WHATSAPP_NOTIFY_TEMPLATE_NAME,
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG,
  });

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    await mark('SIMULATED');
    return json({ ok: true, mode: 'simulated', to: message.to });
  }

  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    await mark('FAILED', body.error?.message ?? res.statusText);
    // 200 so Supabase doesn't retry a message Meta has already rejected.
    return json({ ok: false, error: body.error?.message ?? res.statusText });
  }
  await mark('SENT');
  return json({ ok: true, mode: 'live', to: message.to });
}
