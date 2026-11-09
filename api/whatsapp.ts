/**
 * POST /api/whatsapp  { quotationId }
 * Sends the approved quotation PDF to the requesting sales rep via WhatsApp Business (Meta Cloud API).
 *
 * Live mode needs WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID. Without them the call is
 * simulated: nothing is sent, but the quotation is marked and the history says "mode simulasi".
 */
import { admin, handle, HttpError, json, readJson, requireCaller } from './_lib/server.js';
import { buildWhatsAppTemplatePayload, normalizeWhatsAppNumber, type WhatsAppSendResult } from '../src/utils/whatsapp.js';

const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

export const POST = handle(async request => {
  const caller = await requireCaller(request, ['SALES_SUPPORT', 'MANAGEMENT']);
  const { quotationId } = await readJson<{ quotationId?: string }>(request);
  if (!quotationId) throw new HttpError(400, 'quotationId wajib diisi.');

  const db = admin();
  const { data: q, error } = await db
    .from('quotations')
    .select('id, quotation_number, status, customer, sales_name, sales_phone, grand_total, pdf_path')
    .eq('id', quotationId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!q) throw new HttpError(404, 'Penawaran tidak ditemukan.');
  if (q.status !== 'APPROVED' && q.status !== 'PDF_SENT') throw new HttpError(409, 'Penawaran belum disetujui.');
  if (!q.pdf_path) throw new HttpError(409, 'PDF belum diterbitkan untuk penawaran ini.');
  if (normalizeWhatsAppNumber(q.sales_phone ?? '').length < 10) {
    throw new HttpError(422, `Nomor WhatsApp ${q.sales_name} belum valid. Perbaiki di menu User & hak akses.`);
  }

  const { data: signed, error: signError } = await db.storage
    .from('quotations')
    .createSignedUrl(q.pdf_path, LINK_TTL_SECONDS, { download: `Penawaran_${q.quotation_number}.pdf` });
  if (signError || !signed) throw new HttpError(500, `Link PDF gagal dibuat: ${signError?.message ?? 'unknown'}`);

  const payload = buildWhatsAppTemplatePayload({
    salesName: q.sales_name,
    salesPhone: q.sales_phone,
    quotationNumber: q.quotation_number,
    customerName: (q.customer as { companyName?: string })?.companyName ?? '-',
    grandTotal: Number(q.grand_total),
    pdfUrl: signed.signedUrl,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME,
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG,
  });

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const live = Boolean(token && phoneNumberId);
  let messageId: string | undefined;

  if (live) {
    const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) {
      await db.from('quotations').update({ whatsapp_status: 'FAILED' }).eq('id', q.id);
      throw new HttpError(502, `WhatsApp API menolak pesan: ${body.error?.message ?? res.statusText}`);
    }
    messageId = body.messages?.[0]?.id;
  }

  const { error: recordError } = await db.rpc('record_whatsapp_sent', {
    p_id: q.id,
    p_by: caller.name,
    p_message_id: messageId ?? null,
    p_simulated: !live,
  });
  if (recordError) throw new HttpError(500, recordError.message);

  const result: WhatsAppSendResult = { mode: live ? 'live' : 'simulated', to: payload.to, messageId };
  return json(result);
});
