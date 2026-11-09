/**
 * Supabase backend. Reads go straight to Postgres (RLS decides what each role sees — Sales never
 * receives cost columns). Writes go through the SECURITY DEFINER RPCs in
 * supabase/migrations/*_init.sql. Secret-holding work (WhatsApp, user admin) goes to /api/*.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppNotification,
  CustomProductRequest,
  CustomerInfo,
  Product,
  Quotation,
  QuotationEvent,
  QuotationItemData,
  UserProfile,
} from '../types';
import type { CustomerCategory, DiscountRule } from '../utils/quotationEngine';
import type { WhatsAppSendResult } from '../utils/whatsapp';
import type { Backend, Result } from './types';
import { agustaApi } from './agustaApi';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const TZ = 'Asia/Jakarta';

function fmt(value: string | null | undefined, withTime = true): string {
  if (!value) return '';
  // Plain dates ("2026-11-09") are calendar days in Jakarta, not UTC midnight.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** PostgREST returns a 1:1 embed as an object, but older versions return an array. */
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

function mapProfile(r: Row): UserProfile {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    title: r.title ?? '',
    avatar: r.avatar ?? '',
    phone: r.phone ?? '',
    email: r.email,
    status: r.status,
    createdAt: fmt(r.created_at, false),
    lastLoginAt: r.last_login_at ? fmt(r.last_login_at) : undefined,
  };
}

function mapProduct(r: Row): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    category: r.category,
    brand: r.brand ?? '',
    basePrice: n(r.base_price),
    cogs: n(one(r.product_costs as Row | Row[])?.cogs),
    image: r.image ?? '',
    stock: n(r.stock),
    unit: r.unit ?? 'Unit',
    weightKg: r.weight_kg ?? undefined,
    dimensions: r.dimensions ?? undefined,
    specs: r.specs ?? '',
    description: r.description ?? '',
    isCustom: !!r.is_custom,
    isBestSeller: !!r.is_best_seller,
    eKatalogLkpp: !!r.e_katalog_lkpp,
    keywords: r.keywords ?? [],
    sourceId: r.source_id ?? undefined,
    sourceUrl: r.source_url ?? undefined,
  };
}

function mapItem(r: Row): QuotationItemData {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    category: r.category,
    image: r.image ?? '',
    qty: n(r.qty),
    unit: r.unit,
    cogs: n(one(r.quotation_item_costs as Row | Row[])?.cogs),
    basePrice: n(r.base_price),
    sellingPrice: n(r.selling_price),
    discountPercent: n(r.discount_percent),
    subtotal: n(r.subtotal),
    notes: r.notes ?? undefined,
    specs: r.specs ?? undefined,
  };
}

function mapQuotation(r: Row): Quotation {
  const costs = one(r.quotation_costs as Row | Row[]);
  const items = ((r.quotation_items ?? []) as Row[]).sort((a, b) => a.position - b.position).map(mapItem);
  return {
    id: r.id,
    quotationNumber: r.quotation_number,
    date: fmt(r.issued_on, false),
    validUntil: fmt(r.valid_until, false),
    status: r.status,
    customer: r.customer as CustomerInfo,
    salesId: r.sales_id,
    salesName: r.sales_name,
    salesPhone: r.sales_phone ?? '',
    items,
    subtotal: n(r.subtotal),
    taxRatePercent: n(r.tax_rate_percent),
    taxAmount: n(r.tax_amount),
    grandTotal: n(r.grand_total),
    totalCogs: n(costs?.total_cogs),
    grossProfit: n(costs?.gross_profit),
    grossMarginPercent: n(costs?.gross_margin_percent),
    salesNotes: r.sales_notes ?? '',
    supportNotes: r.support_notes ?? undefined,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at ? fmt(r.reviewed_at) : undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    pdfGeneratedAt: r.pdf_generated_at ? fmt(r.pdf_generated_at) : undefined,
    pdfPath: r.pdf_path ?? undefined,
    whatsAppStatus: r.whatsapp_status ?? undefined,
    history: ((r.history ?? []) as Row[]).map(
      (h): QuotationEvent => ({ at: fmt(h.at), by: h.by, label: h.label, note: h.note ?? undefined })
    ),
  };
}

function mapRequest(r: Row): CustomProductRequest {
  const costs = one(r.custom_request_costs as Row | Row[]);
  return {
    id: r.id,
    salesId: r.sales_id,
    salesName: r.sales_name,
    productName: r.product_name,
    category: r.category,
    estimatedQty: n(r.estimated_qty),
    targetPricePerUnit: n(r.target_price_per_unit),
    specs: r.specs ?? '',
    referenceUrlOrNotes: r.reference_url_or_notes ?? '',
    submittedAt: fmt(r.submitted_at),
    status: r.status,
    assignedCogs: costs?.assigned_cogs != null ? n(costs.assigned_cogs) : undefined,
    supplier: costs?.supplier_name
      ? { name: costs.supplier_name, url: costs.supplier_url ?? undefined, price: n(costs.supplier_price) }
      : undefined,
    assignedSellingPrice: r.assigned_selling_price ?? undefined,
    supportNotes: r.support_notes ?? undefined,
    productId: r.product_id ?? undefined,
    imageUrl: r.image_url ?? undefined,
    sourceUrl: r.source_url ?? undefined,
  };
}

function mapNotification(r: Row): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body ?? '',
    quotationId: r.quotation_id ?? undefined,
    requestId: r.request_id ?? undefined,
    createdAt: fmt(r.created_at),
    createdAtIso: r.created_at,
    read: Boolean(r.read_at),
  };
}

function mapRule(r: Row): DiscountRule {
  return {
    minQty: n(r.min_qty),
    maxQty: r.max_qty ?? undefined,
    customerCategory: (r.customer_category ?? undefined) as CustomerCategory | undefined,
    suggestedDiscount: n(r.suggested_discount),
    maxAllowedDiscount: n(r.max_allowed_discount),
    minMarginPercent: n(r.min_margin_percent),
  };
}

/** Postgres/PostgREST errors carry our Indonesian `raise exception` text in `message`. */
function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message);
  return res;
}

const pricingPayload = (items: QuotationItemData[]) =>
  items.map(i => ({ id: i.id, cogs: i.cogs, sellingPrice: i.sellingPrice, discountPercent: i.discountPercent }));

export function createSupabaseBackend(sb: SupabaseClient): Backend {
  async function token(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error('Sesi berakhir. Silakan masuk kembali.');
    return t;
  }

  async function api<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) throw new Error(json.error || `Server mengembalikan status ${res.status}.`);
    return json;
  }

  return {
    mode: 'supabase',

    async restoreSession() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },

    onSessionChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') cb(session?.user.id ?? null);
      });
      return () => data.subscription.unsubscribe();
    },

    async login(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        const msg = error?.message ?? '';
        if (/invalid login credentials/i.test(msg)) return { ok: false, error: 'Email atau kata sandi tidak cocok. Periksa kembali, lalu coba lagi.' };
        if (/banned/i.test(msg)) return { ok: false, error: 'Akun ini sedang dinonaktifkan. Hubungi Management untuk mengaktifkannya.' };
        return { ok: false, error: msg || 'Tidak bisa masuk. Coba lagi beberapa saat.' };
      }
      const { data: profile } = await sb.from('profiles').select('status').eq('id', data.user.id).maybeSingle();
      if (!profile || profile.status !== 'ACTIVE') {
        await sb.auth.signOut();
        return {
          ok: false,
          error: profile ? 'Akun ini sedang dinonaktifkan. Hubungi Management untuk mengaktifkannya.' : 'Akun belum terdaftar di portal. Hubungi Management.',
        };
      }
      await sb.rpc('touch_last_login');
      return { ok: true, userId: data.user.id };
    },

    async logout() {
      await sb.auth.signOut();
    },

    ...agustaApi(async () => (await sb.auth.getSession()).data.session?.access_token ?? null),

    async setCustomRequestSupplier(_actor, id, supplier) {
      check(
        await sb.rpc('set_custom_request_supplier', {
          p_id: id,
          p_name: supplier?.name ?? null,
          p_url: supplier?.url ?? null,
          p_price: supplier?.price ?? null,
        })
      );
    },

    async importAgustaProducts(_actor, items) {
      const { data } = check(await sb.rpc('import_agusta_products', { p_items: items }));
      return data as { inserted: number; updated: number };
    },

    async markNotificationsRead(_actor, ids) {
      check(await sb.rpc('mark_notifications_read', { p_ids: ids ?? null }));
    },

    async load(userId) {
      const [users, products, quotations, requests, rules, notifications] = await Promise.all([
        sb.from('profiles').select('*').order('created_at'),
        sb.from('products').select('*, product_costs(cogs)').order('created_at'),
        sb.from('quotations').select('*, quotation_costs(*), quotation_items(*, quotation_item_costs(cogs))').order('created_at', { ascending: false }),
        sb.from('custom_requests').select('*, custom_request_costs(assigned_cogs, supplier_name, supplier_url, supplier_price)').order('submitted_at', { ascending: false }),
        sb.from('discount_rules').select('*').order('position'),
        sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      ]);
      [users, products, quotations, requests, rules, notifications].forEach(check);
      return {
        users: (users.data ?? []).map(mapProfile),
        products: (products.data ?? []).map(mapProduct),
        quotations: (quotations.data ?? []).map(mapQuotation),
        customRequests: (requests.data ?? []).map(mapRequest),
        discountRules: (rules.data ?? []).map(mapRule),
        notifications: (notifications.data ?? []).map(mapNotification),
      };
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const bump = () => {
        clearTimeout(timer);
        timer = setTimeout(onChange, 300);
      };
      const channel = sb
        .channel('agusta-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_requests' }, bump)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, bump)
        .subscribe();
      return () => {
        clearTimeout(timer);
        void sb.removeChannel(channel);
      };
    },

    async createQuotation(_actor, input, existingId) {
      const { data } = check(
        await sb.rpc('submit_quotation', {
          p_customer: input.customer,
          p_items: input.items.map(i => ({ productId: i.productId, qty: i.qty, discountPercent: i.discountPercent, notes: i.notes ?? '' })),
          p_sales_notes: input.salesNotes,
          p_existing_id: existingId ?? null,
        })
      );
      return data as string;
    },

    async saveQuotationPricing(_actor, id, items, supportNotes) {
      check(await sb.rpc('save_quotation_pricing', { p_id: id, p_items: pricingPayload(items), p_support_notes: supportNotes ?? null }));
    },

    async approveQuotation(_actor, id, items, supportNotes) {
      check(await sb.rpc('approve_quotation', { p_id: id, p_items: pricingPayload(items), p_support_notes: supportNotes ?? null }));
    },

    async rejectQuotation(_actor, id, reason) {
      check(await sb.rpc('reject_quotation', { p_id: id, p_reason: reason }));
    },

    async attachQuotationPdf(_actor, q, pdf) {
      const path = `${q.id}/Penawaran_${q.quotationNumber}.pdf`;
      check(await sb.storage.from('quotations').upload(path, pdf, { contentType: 'application/pdf', upsert: true }));
      check(await sb.rpc('set_quotation_pdf', { p_id: q.id, p_path: path }));
    },

    async sendWhatsApp(_actor, id) {
      return api<WhatsAppSendResult>('/api/whatsapp', { quotationId: id });
    },

    async submitCustomRequest(_actor, req) {
      check(
        await sb.rpc('submit_custom_request', {
          p_product_name: req.productName,
          p_category: req.category,
          p_estimated_qty: req.estimatedQty,
          p_target_price: req.targetPricePerUnit,
          p_specs: req.specs,
          p_reference: req.referenceUrlOrNotes,
          p_image_url: req.imageUrl ?? null,
          p_source_url: req.sourceUrl ?? null,
        })
      );
    },

    async priceCustomRequest(_actor, id, patch) {
      check(
        await sb.rpc('price_custom_request', {
          p_id: id,
          p_cogs: patch.assignedCogs ?? 0,
          p_selling_price: patch.assignedSellingPrice ?? 0,
          p_support_notes: patch.supportNotes ?? '',
          p_status: patch.status,
        })
      );
    },

    async setDiscountRules(_actor, rules) {
      check(await sb.rpc('replace_discount_rules', { p_rules: rules }));
    },

    async updateProduct(_actor, id, patch) {
      check(
        await sb.rpc('update_product_pricing', {
          p_id: id,
          p_cogs: patch.cogs ?? null,
          p_base_price: patch.basePrice ?? null,
          p_stock: patch.stock ?? null,
        })
      );
    },

    async addUser(_actor, input): Promise<Result> {
      try {
        await api('/api/users', { action: 'create', user: input });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },

    async updateUser(_actor, id, patch): Promise<Result> {
      try {
        await api('/api/users', { action: 'update', id, patch });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}
