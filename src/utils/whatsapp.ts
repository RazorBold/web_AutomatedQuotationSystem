/**
 * WhatsApp Business (Meta Cloud API) message building, shared by the browser preview
 * and the server function in api/whatsapp.ts. No secrets here.
 *
 * Imports keep the explicit .js extension so the file also runs as native ESM on Vercel.
 */
import { formatRupiah } from './quotationEngine.js';

export const DEFAULT_TEMPLATE_NAME = 'agusta_quotation_approved';
export const DEFAULT_TEMPLATE_LANG = 'id';

/** "+62 812-3456-7890" / "0812…" → "628123456789" (E.164 digits, Indonesia default). */
export function normalizeWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export interface WhatsAppQuotationParams {
  salesName: string;
  salesPhone: string;
  quotationNumber: string;
  customerName: string;
  grandTotal: number;
  pdfUrl: string;
  templateName?: string;
  templateLang?: string;
}

/**
 * Template message with the PDF as document header.
 * The template must exist and be approved in Meta Business Manager with:
 *   header: DOCUMENT
 *   body:   4 variables → {{1}} sales name, {{2}} quotation number, {{3}} customer, {{4}} total
 */
export function buildWhatsAppTemplatePayload(p: WhatsAppQuotationParams) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeWhatsAppNumber(p.salesPhone),
    type: 'template',
    template: {
      name: p.templateName || DEFAULT_TEMPLATE_NAME,
      language: { code: p.templateLang || DEFAULT_TEMPLATE_LANG },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'document', document: { link: p.pdfUrl, filename: `Penawaran_${p.quotationNumber}.pdf` } }],
        },
        {
          type: 'body',
          parameters: [p.salesName, p.quotationNumber, p.customerName, formatRupiah(p.grandTotal)].map(text => ({ type: 'text', text })),
        },
      ],
    },
  };
}

export const DEFAULT_NOTIFY_TEMPLATE_NAME = 'agusta_notifikasi';

/** Meta rejects template parameters with new lines, tabs or more than 4 consecutive spaces. */
const cleanParam = (s: string, max = 300) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max) || '-';

/**
 * Generic portal notification (new quotation, revision needed, custom price ready…).
 * Template in Meta Business Manager (category Utility, language id), body with 4 variables:
 *   {{1}} recipient name, {{2}} title, {{3}} detail, {{4}} portal link
 */
export function buildWhatsAppNotificationPayload(p: {
  phone: string;
  recipientName: string;
  title: string;
  body: string;
  portalUrl: string;
  templateName?: string;
  templateLang?: string;
}) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeWhatsAppNumber(p.phone),
    type: 'template',
    template: {
      name: p.templateName || DEFAULT_NOTIFY_TEMPLATE_NAME,
      language: { code: p.templateLang || DEFAULT_TEMPLATE_LANG },
      components: [
        {
          type: 'body',
          parameters: [p.recipientName, p.title, p.body, p.portalUrl].map(text => ({ type: 'text', text: cleanParam(text) })),
        },
      ],
    },
  };
}

export type WhatsAppSendMode = 'live' | 'simulated';

export interface WhatsAppSendResult {
  mode: WhatsAppSendMode;
  to: string;
  messageId?: string;
}
