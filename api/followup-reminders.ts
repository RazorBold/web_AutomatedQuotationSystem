/**
 * GET /api/followup-reminders — weekly reminder for Sales (R13), run by Vercel Cron (vercel.json:
 * Mondays 01:00 UTC = 08:00 WIB). Each rep with open quotations that have had no update for 7 days
 * gets one notification; the notification webhook forwards it to WhatsApp.
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set; anything else is refused.
 */
import { timingSafeEqual } from 'node:crypto';
import { admin, json, supabaseConfigured } from './_lib/server.js';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401);
  if (!supabaseConfigured()) return json({ ok: true, skipped: 'Supabase belum dikonfigurasi (mode demo).' });
  const { data, error } = await admin().rpc('send_followup_reminders');
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, reminded: data });
}
