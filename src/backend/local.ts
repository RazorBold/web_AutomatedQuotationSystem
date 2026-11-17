/**
 * Local demo backend: all data in localStorage, no server. Used when Supabase env vars are absent.
 * Behaviour matches the original prototype; WhatsApp is always simulated.
 */
import { INITIAL_CUSTOM_REQUESTS, INITIAL_QUOTATIONS, PRODUCTS, USERS } from '../data/mockData';
import type { AppNotification, NotificationType, Product, Quotation, QuotationCharge, QuotationEvent, QuotationItemData, UserProfile } from '../types';
import { can, type Permission } from '../auth/permissions';
import { calculateLineSubtotal, calculateQuotationTotals, DEFAULT_DISCOUNT_RULES, formatRupiah, generateQuotationNumber, normalizeBrand } from '../utils/quotationEngine';
import { normalizeWhatsAppNumber } from '../utils/whatsapp';
import type { Backend, ChargeInput, QuotationAdjustments, Snapshot } from './types';
import { agustaApi, productFromAgusta, sameProduct } from './agustaApi';

const STORAGE_KEY = 'agusta-qs:v3';

/** All users' notifications are kept; load() returns only the signed-in user's. */
interface State extends Snapshot {
  sessionUserId: string | null;
}

const now = (withTime = true) =>
  new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

function withTotals(q: Quotation, items: QuotationItemData[]): Quotation {
  const normalized = items.map(i => ({ ...i, subtotal: calculateLineSubtotal(i) }));
  const charges = (q.charges ?? []).reduce((sum, c) => sum + c.amount, 0);
  const t = calculateQuotationTotals(normalized, true, 11, q.extraDiscount ?? 0, charges);
  return {
    ...q,
    items: normalized,
    subtotal: t.subtotal,
    taxRatePercent: 11,
    taxAmount: t.taxAmount,
    grandTotal: t.grandTotal,
    totalCogs: t.totalCogs,
    grossProfit: t.grossProfit,
    grossMarginPercent: t.grossMarginPercent,
  };
}

export function seedHistory(q: Quotation): Quotation {
  if (q.history?.length) return q;
  const history: QuotationEvent[] = [{ at: q.date, by: q.salesName, label: 'Diajukan ke Sales Support' }];
  if (q.status === 'APPROVED' || q.status === 'PDF_SENT')
    history.push({ at: q.reviewedAt || q.date, by: q.reviewedBy || 'Sales Support', label: 'Disetujui, PDF diterbitkan' });
  if (q.status === 'PDF_SENT')
    history.push({ at: q.reviewedAt || q.date, by: q.reviewedBy || 'Sales Support', label: 'Dikirim ke WhatsApp Sales' });
  if (q.status === 'REJECTED')
    history.push({ at: q.reviewedAt || q.date, by: q.reviewedBy || 'Sales Support', label: 'Dikembalikan untuk revisi', note: q.rejectionReason });
  return { ...q, history };
}

const initialState = (): State => ({
  users: USERS,
  quotations: INITIAL_QUOTATIONS.map(seedHistory),
  products: PRODUCTS,
  customRequests: INITIAL_CUSTOM_REQUESTS,
  discountRules: DEFAULT_DISCOUNT_RULES,
  notifications: [],
  sessionUserId: null,
});

function read(): State {
  const base = initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<State>;
    return {
      users: p.users ?? base.users,
      quotations: (p.quotations ?? base.quotations).map(seedHistory),
      products: p.products ?? base.products,
      customRequests: p.customRequests ?? base.customRequests,
      // Rules saved before the switch to per-brand rules (R12) are replaced by the new defaults.
      discountRules:
        p.discountRules && !p.discountRules.some(r => 'customerCategory' in (r as object)) ? p.discountRules : base.discountRules,
      notifications: p.notifications ?? [],
      sessionUserId: p.sessionUserId ?? null,
    };
  } catch {
    return base;
  }
}

export function createLocalBackend(): Backend {
  let state = read();

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable (private mode) — keep working in memory */
    }
  };

  const require = (actor: UserProfile, permission: Permission) => {
    if (!can(actor, permission)) throw new Error('Anda tidak memiliki akses untuk tindakan ini.');
  };

  const withCharges = (c: ChargeInput[] | undefined, fallback?: QuotationCharge[]): QuotationCharge[] | undefined =>
    c ? c.filter(x => x.amount > 0 && x.label.trim()).map((x, i) => ({ ...x, label: x.label.trim(), id: `chg-${Date.now()}-${i}` })) : fallback;
  const applyAdj = (q: Quotation, a?: QuotationAdjustments): Quotation =>
    a ? { ...q, ...a, charges: withCharges(a.charges, q.charges) } : q;
  const usersWithRole = (role: UserProfile['role']) => state.users.filter(u => u.status === 'ACTIVE' && u.role === role).map(u => u.id);
  const escalationEvent = (actor: UserProfile, note: string) => ({ note: note.trim(), by: actor.name, byId: actor.id, at: now() });

  const patchQuotation = (id: string, fn: (q: Quotation) => Quotation) => {
    state = { ...state, quotations: state.quotations.map(q => (q.id === id ? fn(q) : q)) };
    save();
  };

  /** Mirrors the database triggers in supabase/migrations/*_notifications.sql. */
  const notify = (
    actor: UserProfile,
    recipients: string[],
    type: NotificationType,
    title: string,
    body: string,
    ref: { quotationId?: string; requestId?: string }
  ) => {
    const at = new Date();
    const items: AppNotification[] = recipients
      .filter(id => id !== actor.id)
      .map((userId, i) => ({
        id: `ntf-${at.getTime()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        type,
        title,
        body,
        ...ref,
        createdAt: now(),
        createdAtIso: at.toISOString(),
        read: false,
      }));
    state = { ...state, notifications: [...items, ...state.notifications].slice(0, 500) };
    save();
  };
  const reviewers = () =>
    state.users.filter(u => u.status === 'ACTIVE' && (u.role === 'SALES_SUPPORT' || u.role === 'MANAGEMENT')).map(u => u.id);
  const qRef = (q: Quotation) => `${q.quotationNumber} · ${q.customer.companyName}`;

  const repriced = (q: Quotation, items: QuotationItemData[]) =>
    withTotals(
      q,
      q.items.map(orig => {
        const next = items.find(i => i.id === orig.id);
        return next ? { ...orig, cogs: next.cogs, sellingPrice: next.sellingPrice, discountPercent: next.discountPercent } : orig;
      })
    );

  return {
    mode: 'local',

    async restoreSession() {
      return state.sessionUserId;
    },

    onSessionChange() {
      return () => undefined;
    },

    async login(email, password) {
      await new Promise(r => setTimeout(r, 350));
      const user = state.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || user.password !== password) {
        return { ok: false, error: 'Email atau kata sandi tidak cocok. Periksa kembali, lalu coba lagi.' };
      }
      if (user.status !== 'ACTIVE') {
        return { ok: false, error: 'Akun ini sedang dinonaktifkan. Hubungi Management untuk mengaktifkannya.' };
      }
      state = { ...state, sessionUserId: user.id, users: state.users.map(u => (u.id === user.id ? { ...u, lastLoginAt: now() } : u)) };
      save();
      return { ok: true, userId: user.id };
    },

    async logout() {
      state = { ...state, sessionUserId: null };
      save();
    },

    async load() {
      const { sessionUserId, notifications, ...snap } = state;
      return { ...snap, notifications: notifications.filter(n => n.userId === sessionUserId) };
    },

    ...agustaApi(),

    async setCustomRequestSupplier(actor, id, supplier) {
      require(actor, 'custom-request:price');
      state = {
        ...state,
        customRequests: state.customRequests.map(r => (r.id === id ? { ...r, supplier: supplier?.name ? supplier : undefined } : r)),
      };
      save();
    },

    async importAgustaProducts(actor, items) {
      require(actor, 'cogs:edit');
      let inserted = 0;
      let updated = 0;
      const products = [...state.products];
      const skus = new Set(products.map(p => p.sku.toUpperCase()));
      for (const a of items) {
        const i = products.findIndex(p => sameProduct(p, a));
        const fresh = productFromAgusta(a);
        if (i >= 0) {
          const cur = products[i]!;
          // Keep the portal's prices, stock and naming; refresh what the website owns.
          products[i] = {
            ...cur,
            category: cur.sourceId ? fresh.category : cur.category,
            image: cur.image || fresh.image,
            brand: cur.brand || fresh.brand,
            specs: fresh.specs || cur.specs,
            sourceId: a.sourceId,
            sourceUrl: a.url,
          };
          updated++;
        } else {
          if (skus.has(fresh.sku.toUpperCase())) fresh.sku = `${fresh.sku}-${a.sourceId}`;
          skus.add(fresh.sku.toUpperCase());
          products.push(fresh);
          inserted++;
        }
      }
      state = { ...state, products };
      save();
      return { inserted, updated };
    },

    async markNotificationsRead(actor, ids) {
      state = {
        ...state,
        notifications: state.notifications.map(n =>
          n.userId === actor.id && !n.read && (!ids || ids.includes(n.id)) ? { ...n, read: true } : n
        ),
      };
      save();
    },

    subscribe() {
      return () => undefined;
    },

    async createQuotation(actor, input, existingId) {
      require(actor, 'quotation:create');
      if (input.items.length === 0) throw new Error('Penawaran minimal berisi satu produk.');
      // COGS is attached here (server side in Supabase mode), never by the Sales UI.
      const items: QuotationItemData[] = input.items.map((it, idx) => {
        const p = state.products.find(x => x.id === it.productId);
        if (!p) throw new Error('Produk tidak ditemukan di katalog.');
        if (p.basePrice <= 0) throw new Error(`Harga ${p.name} belum diisi Sales Support. Ajukan "Minta harga" terlebih dahulu.`);
        return {
          id: `item-${Date.now()}-${idx}`,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          category: p.category,
          image: p.image,
          qty: it.qty,
          unit: p.unit,
          cogs: p.cogs,
          basePrice: p.basePrice,
          sellingPrice: p.basePrice,
          discountPercent: it.discountPercent,
          subtotal: 0,
          notes: it.notes,
          specs: p.specs,
        };
      });

      const existing = existingId ? state.quotations.find(q => q.id === existingId) : undefined;
      const base: Quotation = existing
        ? {
            ...existing,
            customer: input.customer,
            salesNotes: input.salesNotes,
            extraDiscount: input.extraDiscount ?? existing?.extraDiscount ?? 0,
            charges: withCharges(input.charges, existing.charges),
            status: 'PENDING_REVIEW',
            rejectionReason: undefined,
            history: [...(existing.history ?? []), { at: now(), by: actor.name, label: 'Direvisi dan diajukan ulang' }],
          }
        : {
            id: `qtn-${Date.now()}`,
            quotationNumber: generateQuotationNumber(
              state.quotations.reduce((max, q) => Math.max(max, Number(q.quotationNumber.slice(-4)) || 0), 0) + 1
            ),
            date: now(false),
            validUntil: new Date(Date.now() + 14 * 86400000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: 'PENDING_REVIEW',
            customer: input.customer,
            salesId: actor.id,
            salesName: actor.name,
            salesPhone: actor.phone,
            items: [],
            subtotal: 0,
            taxRatePercent: 11,
            taxAmount: 0,
            grandTotal: 0,
            totalCogs: 0,
            grossProfit: 0,
            grossMarginPercent: 0,
            salesNotes: input.salesNotes,
            extraDiscount: input.extraDiscount ?? 0,
            charges: withCharges(input.charges),
            whatsAppStatus: 'PENDING',
            history: [{ at: now(), by: actor.name, label: 'Diajukan ke Sales Support' }],
          };

      const q = withTotals(base, items);
      state = { ...state, quotations: existing ? state.quotations.map(x => (x.id === q.id ? q : x)) : [q, ...state.quotations] };
      save();
      notify(
        actor,
        reviewers(),
        existing ? 'QUOTATION_RESUBMITTED' : 'QUOTATION_SUBMITTED',
        existing ? `${actor.name} merevisi penawaran` : `Penawaran baru dari ${actor.name}`,
        `${qRef(q)} · ${formatRupiah(q.grandTotal)}`,
        { quotationId: q.id }
      );
      return q.id;
    },

    async saveQuotationPricing(actor, id, items, supportNotes, adjustments) {
      require(actor, 'cogs:edit');
      patchQuotation(id, q => ({ ...repriced(applyAdj(q, adjustments), items), supportNotes: supportNotes ?? q.supportNotes }));
    },

    async approveQuotation(actor, id, items, supportNotes, adjustments) {
      require(actor, 'quotation:review');
      const q = state.quotations.find(x => x.id === id);
      if (!q || q.status !== 'PENDING_REVIEW') throw new Error('Penawaran ini tidak sedang menunggu review.');
      patchQuotation(id, cur => ({
        ...repriced(applyAdj(cur, adjustments), items),
        supportNotes,
        status: 'APPROVED',
        reviewedBy: actor.name,
        reviewedAt: now(),
        pdfGeneratedAt: now(),
        history: [...(cur.history ?? []), { at: now(), by: actor.name, label: 'Disetujui, PDF diterbitkan' }],
      }));
      const done = state.quotations.find(x => x.id === id)!;
      notify(actor, [done.salesId], 'QUOTATION_APPROVED', 'Penawaran disetujui', `${qRef(done)} · ${formatRupiah(done.grandTotal)}. PDF resmi sudah terbit.`, {
        quotationId: id,
      });
    },

    async rejectQuotation(actor, id, reason) {
      require(actor, 'quotation:review');
      patchQuotation(id, q => ({
        ...q,
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedBy: actor.name,
        reviewedAt: now(),
        history: [...(q.history ?? []), { at: now(), by: actor.name, label: 'Dikembalikan untuk revisi', note: reason }],
      }));
      const q = state.quotations.find(x => x.id === id);
      if (q) notify(actor, [q.salesId], 'QUOTATION_REJECTED', 'Penawaran perlu revisi', `${qRef(q)} · ${reason}`, { quotationId: id });
    },

    async attachQuotationPdf() {
      /* nothing to store locally — the PDF is regenerated on download */
    },

    async sendWhatsApp(actor, id) {
      require(actor, 'quotation:review');
      const q = state.quotations.find(x => x.id === id);
      if (!q) throw new Error('Penawaran tidak ditemukan.');
      await new Promise(r => setTimeout(r, 500));
      patchQuotation(id, cur => ({
        ...cur,
        status: 'PDF_SENT',
        whatsAppStatus: 'SENT',
        history: [...(cur.history ?? []), { at: now(), by: actor.name, label: 'Dikirim ke WhatsApp Sales (mode simulasi)' }],
      }));
      return { mode: 'simulated', to: normalizeWhatsAppNumber(q.salesPhone) };
    },

    async submitCustomRequest(actor, req) {
      require(actor, 'custom-request:create');
      const id = `req-${Date.now()}`;
      state = {
        ...state,
        customRequests: [
          { ...req, id, salesId: actor.id, salesName: actor.name, submittedAt: now(), status: 'PENDING_PRICING' },
          ...state.customRequests,
        ],
      };
      save();
      notify(actor, reviewers(), 'CUSTOM_REQUEST_SUBMITTED', `Request barang custom dari ${actor.name}`, `${req.productName} · ${req.estimatedQty} unit`, {
        requestId: id,
      });
    },

    async escalateQuotation(actor, id, note, items, supportNotes, adjustments) {
      require(actor, 'quotation:review');
      const q = state.quotations.find(x => x.id === id);
      if (!q || q.status !== 'PENDING_REVIEW') throw new Error('Hanya penawaran yang menunggu review yang bisa diteruskan ke Management.');
      if (note.trim().length < 5) throw new Error('Tulis alasan eskalasi untuk Management.');
      patchQuotation(id, cur => ({
        ...repriced(applyAdj(cur, adjustments), items),
        supportNotes: supportNotes ?? cur.supportNotes,
        status: 'PENDING_MANAGEMENT',
        escalation: escalationEvent(actor, note),
        history: [...(cur.history ?? []), { at: now(), by: actor.name, label: 'Diteruskan ke Management', note: note.trim() }],
      }));
      notify(actor, usersWithRole('MANAGEMENT'), 'QUOTATION_ESCALATED', `Eskalasi dari ${actor.name}`, `${qRef(q)} · ${note.trim()}`, { quotationId: id });
    },

    async decideQuotationEscalation(actor, id, decision, note, items, adjustments) {
      if (actor.role !== 'MANAGEMENT') throw new Error('Hanya Management yang dapat memutuskan eskalasi.');
      const q = state.quotations.find(x => x.id === id);
      if (!q || q.status !== 'PENDING_MANAGEMENT') throw new Error('Penawaran ini tidak sedang menunggu Management.');
      if (decision === 'RETURNED' && note.trim().length < 5) throw new Error('Tulis catatan untuk Sales Support.');
      patchQuotation(id, cur => ({
        ...repriced(applyAdj(cur, adjustments), items),
        status: 'PENDING_REVIEW',
        escalation: { ...cur.escalation!, decision, decisionNote: note.trim() || undefined, decidedBy: actor.name, decidedAt: now() },
        history: [
          ...(cur.history ?? []),
          { at: now(), by: actor.name, label: decision === 'APPROVED' ? 'Disetujui Management' : 'Dikembalikan Management ke Sales Support', note: note.trim() || undefined },
        ],
      }));
      if (q.escalation?.byId) {
        notify(actor, [q.escalation.byId], 'QUOTATION_MGMT_DECIDED', decision === 'APPROVED' ? 'Management menyetujui harga' : 'Management mengembalikan penawaran', `${qRef(q)}${note.trim() ? ` · ${note.trim()}` : ''}`, { quotationId: id });
      }
    },

    async escalateCustomRequest(actor, id, note, cogs, sellingPrice) {
      require(actor, 'custom-request:price');
      const req = state.customRequests.find(r => r.id === id);
      if (!req || !['PENDING_PRICING', 'PRICED'].includes(req.status)) throw new Error('Request ini tidak bisa diteruskan ke Management.');
      if (note.trim().length < 5) throw new Error('Tulis alasan eskalasi untuk Management.');
      state = {
        ...state,
        customRequests: state.customRequests.map(r =>
          r.id === id
            ? { ...r, status: 'PENDING_MANAGEMENT', assignedCogs: cogs || r.assignedCogs, assignedSellingPrice: sellingPrice || r.assignedSellingPrice, escalation: escalationEvent(actor, note) }
            : r
        ),
      };
      save();
      notify(actor, usersWithRole('MANAGEMENT'), 'CUSTOM_REQUEST_ESCALATED', `Eskalasi harga custom dari ${actor.name}`, `${req.productName} · ${note.trim()}`, { requestId: id });
    },

    async decideCustomRequestEscalation(actor, id, decision, note, cogs, sellingPrice) {
      if (actor.role !== 'MANAGEMENT') throw new Error('Hanya Management yang dapat memutuskan eskalasi.');
      const req = state.customRequests.find(r => r.id === id);
      if (!req || req.status !== 'PENDING_MANAGEMENT') throw new Error('Request ini tidak sedang menunggu Management.');
      if (decision === 'APPROVED' && (!cogs || !sellingPrice)) throw new Error('Isi HPP dan harga jual terlebih dahulu.');
      if (decision === 'RETURNED' && note.trim().length < 5) throw new Error('Tulis catatan untuk Sales Support.');
      state = {
        ...state,
        customRequests: state.customRequests.map(r =>
          r.id === id
            ? {
                ...r,
                status: decision === 'APPROVED' ? 'PRICED' : 'PENDING_PRICING',
                assignedCogs: decision === 'APPROVED' ? cogs : r.assignedCogs,
                assignedSellingPrice: decision === 'APPROVED' ? sellingPrice : r.assignedSellingPrice,
                escalation: { ...r.escalation!, decision, decisionNote: note.trim() || undefined, decidedBy: actor.name, decidedAt: now() },
              }
            : r
        ),
      };
      save();
      if (req.escalation?.byId) {
        notify(
          actor,
          [req.escalation.byId],
          'CUSTOM_REQUEST_MGMT_DECIDED',
          decision === 'APPROVED' ? 'Management menetapkan harga custom' : 'Management mengembalikan request custom',
          `${req.productName}${decision === 'APPROVED' ? ` · ${formatRupiah(sellingPrice)} per unit` : ''}${note.trim() ? ` · ${note.trim()}` : ''}`,
          { requestId: id }
        );
      }
    },

    async createQuotationRevision(actor, id) {
      const q = state.quotations.find(x => x.id === id);
      if (!q) throw new Error('Penawaran tidak ditemukan.');
      const isSales = actor.role === 'SALES' && q.salesId === actor.id;
      if (!isSales && !can(actor, 'quotation:review')) throw new Error('Anda tidak memiliki akses untuk merevisi penawaran ini.');
      if (q.status !== 'APPROVED' && q.status !== 'PDF_SENT') throw new Error('Hanya penawaran yang sudah disetujui/terkirim yang bisa direvisi dengan cara ini.');
      const root = q.quotationNumber.replace(/-R\d+$/, '');
      const no =
        Math.max(0, ...state.quotations.filter(x => x.quotationNumber === root || x.quotationNumber.startsWith(`${root}-R`)).map(x => x.revisionNo ?? 0)) + 1;
      const number = `${root}-R${no}`;
      const newId = `qtn-${Date.now()}`;
      const fresh: Quotation = withTotals(
        {
          ...q,
          id: newId,
          quotationNumber: number,
          date: now(false),
          validUntil: new Date(Date.now() + 14 * 86400000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          status: isSales ? 'DRAFT' : 'PENDING_REVIEW',
          reviewedBy: undefined,
          reviewedAt: undefined,
          rejectionReason: undefined,
          pdfGeneratedAt: undefined,
          pdfPath: undefined,
          whatsAppStatus: 'PENDING',
          escalation: undefined,
          revisionOf: q.id,
          revisionNo: no,
          revisedTo: undefined,
          history: [{ at: now(), by: actor.name, label: `Revisi dari ${q.quotationNumber}` }],
        },
        q.items.map((it, i) => ({ ...it, id: `item-${Date.now()}-${i}` }))
      );
      state = {
        ...state,
        quotations: [
          fresh,
          ...state.quotations.map(x =>
            x.id === id
              ? { ...x, status: 'REVISED' as const, revisedTo: newId, history: [...(x.history ?? []), { at: now(), by: actor.name, label: `Direvisi menjadi ${number}` }] }
              : x
          ),
        ],
      };
      save();
      if (!isSales) notify(actor, reviewers(), 'QUOTATION_SUBMITTED', `Revisi penawaran ${number}`, `${qRef(fresh)} · ${formatRupiah(fresh.grandTotal)}`, { quotationId: newId });
      return newId;
    },

    async priceCustomRequest(actor, id, patch) {
      require(actor, 'custom-request:price');
      const req = state.customRequests.find(r => r.id === id);
      if (!req) throw new Error('Request tidak ditemukan.');
      if (req.status === 'PENDING_MANAGEMENT') throw new Error('Request ini sedang menunggu keputusan Management.');
      let productId = req.productId;
      let products = state.products;

      // An approved price turns the request into a quotable catalog item (made to order).
      if (patch.status === 'APPROVED' && patch.assignedCogs && patch.assignedSellingPrice) {
        productId = productId ?? `prod-custom-${req.id}`;
        const product: Product = {
          id: productId,
          name: req.productName.toUpperCase(),
          sku: `CST-${req.id.replace(/\D/g, '').slice(-6).padStart(6, '0')}`,
          category: req.category,
          brand: 'CUSTOM',
          basePrice: patch.assignedSellingPrice,
          cogs: patch.assignedCogs,
          image: req.imageUrl ?? '',
          stock: req.estimatedQty,
          unit: 'Unit',
          specs: req.specs,
          description: patch.supportNotes || 'Barang custom, dibuat sesuai pesanan.',
          isCustom: true,
          sourceUrl: req.sourceUrl,
          keywords: ['custom', ...req.productName.toLowerCase().split(/\s+/)],
        };
        products = products.some(p => p.id === productId) ? products.map(p => (p.id === productId ? product : p)) : [...products, product];
      }

      state = { ...state, products, customRequests: state.customRequests.map(r => (r.id === id ? { ...r, ...patch, productId } : r)) };
      save();

      if (patch.status && patch.status !== req.status) {
        const price = patch.assignedSellingPrice ? `${formatRupiah(patch.assignedSellingPrice)} per unit` : '';
        const msg: Partial<Record<typeof patch.status, [NotificationType, string, string]>> = {
          PRICED: ['CUSTOM_REQUEST_PRICED', 'Harga barang custom sudah dihitung', `${req.productName} · ${price}`],
          APPROVED: ['CUSTOM_REQUEST_APPROVED', 'Barang custom siap dipakai di penawaran', `${req.productName} · ${price}`],
          REJECTED: ['CUSTOM_REQUEST_REJECTED', 'Barang custom tidak dapat diproses', `${req.productName}${patch.supportNotes ? ` · ${patch.supportNotes}` : ''}`],
        };
        const m = msg[patch.status];
        if (m) notify(actor, [req.salesId], m[0], m[1], m[2], { requestId: id });
      }
    },

    async setDiscountRules(actor, rules) {
      require(actor, 'discount-rules:edit');
      state = { ...state, discountRules: rules };
      save();
    },

    async updateProduct(actor, id, patch) {
      require(actor, 'cogs:edit');
      const clean = patch.brand !== undefined ? { ...patch, brand: normalizeBrand(patch.brand) } : patch;
      state = { ...state, products: state.products.map(p => (p.id === id ? { ...p, ...clean } : p)) };
      save();
    },

    async addUser(actor, input) {
      if (!can(actor, 'users:manage')) return { ok: false, error: 'Anda tidak memiliki akses untuk mengelola user.' };
      if (state.users.some(u => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
        return { ok: false, error: 'Email ini sudah dipakai akun lain.' };
      }
      state = {
        ...state,
        users: [...state.users, { ...input, email: input.email.trim(), id: `user-${Date.now()}`, avatar: initials(input.name), createdAt: now(false) }],
      };
      save();
      return { ok: true };
    },

    async updateUser(actor, id, patch) {
      if (!can(actor, 'users:manage')) return { ok: false, error: 'Anda tidak memiliki akses untuk mengelola user.' };
      if (patch.email && state.users.some(u => u.id !== id && u.email.toLowerCase() === patch.email!.trim().toLowerCase())) {
        return { ok: false, error: 'Email ini sudah dipakai akun lain.' };
      }
      if (id === actor.id && (patch.status === 'INACTIVE' || (patch.role && patch.role !== actor.role))) {
        return { ok: false, error: 'Anda tidak bisa menonaktifkan atau mengubah role akun Anda sendiri.' };
      }
      const clean = { ...patch };
      if (!clean.password) delete clean.password;
      state = {
        ...state,
        users: state.users.map(u => (u.id === id ? { ...u, ...clean, avatar: clean.name ? initials(clean.name) : u.avatar } : u)),
      };
      save();
      return { ok: true };
    },

    async resetDemoData() {
      state = initialState();
      save();
    },
  };
}
