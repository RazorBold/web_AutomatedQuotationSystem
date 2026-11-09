/**
 * Seeds Supabase with the demo users, catalog, discount rules, quotations and custom requests
 * from src/data/mockData.ts. Safe to re-run: existing rows are updated or skipped.
 *
 *   npm run db:seed
 *
 * Needs VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Every demo account gets the password from SEED_PASSWORD (default: agusta123) — change them
 * before real use, or create real accounts from the "User & hak akses" page.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_CUSTOM_REQUESTS, INITIAL_QUOTATIONS, PRODUCTS, USERS } from '../src/data/mockData';
import { calculateLineSubtotal, calculateQuotationTotals, DEFAULT_DISCOUNT_RULES } from '../src/utils/quotationEngine';
import { seedHistory } from '../src/backend/local';

config({ path: '.env.local' });
config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Isi VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local terlebih dahulu.');
  process.exit(1);
}
const password = process.env.SEED_PASSWORD || 'agusta123';
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };

/** "03 Nov 2026", "31 Okt 2026 16:15 WIB", "14 Agu 2026 13.20" → ISO timestamp in Jakarta time. */
function parseIdDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})(?:,?\s+(\d{1,2})[:.](\d{2}))?/);
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (month === undefined) return null;
  const pad = (n: number | string) => String(n).padStart(2, '0');
  return `${m[3]}-${pad(month + 1)}-${pad(m[1]!)}T${pad(m[4] ?? '09')}:${m[5] ?? '00'}:00+07:00`;
}
const dateOnly = (s: string) => (parseIdDate(s) ?? new Date().toISOString()).slice(0, 10);

function must<R extends { data: unknown; error: { message: string } | null }>(res: R, what: string): NonNullable<R["data"]> {
  if (res.error || res.data === null || res.data === undefined) throw new Error(`${what}: ${res.error?.message ?? "tidak ada data"}`);
  return res.data as NonNullable<R["data"]>;
}

function ok(res: { error: { message: string } | null }, what: string): void {
  if (res.error) throw new Error(what + ": " + res.error.message);
}

async function seedUsers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const existing = must(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'list users').users;
  for (const u of USERS) {
    let authUser = existing.find(x => x.email?.toLowerCase() === u.email.toLowerCase());
    if (!authUser) {
      authUser = must(await db.auth.admin.createUser({ email: u.email, password, email_confirm: true, user_metadata: { name: u.name } }), `create ${u.email}`).user!;
      console.log(`  + user ${u.email}`);
    }
    ids.set(u.id, authUser.id);
    ok(
      await db.from('profiles').upsert({
        id: authUser.id,
        name: u.name,
        role: u.role,
        title: u.title,
        phone: u.phone,
        email: u.email.toLowerCase(),
        status: u.status,
        avatar: u.avatar,
        created_at: parseIdDate(u.createdAt) ?? undefined,
        last_login_at: parseIdDate(u.lastLoginAt),
      }),
      `profile ${u.email}`
    );
  }
  return ids;
}

async function seedCatalog() {
  ok(
    await db.from('products').upsert(
      PRODUCTS.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        brand: p.brand,
        base_price: p.basePrice,
        image: p.image,
        stock: p.stock,
        unit: p.unit,
        weight_kg: p.weightKg ?? null,
        dimensions: p.dimensions ?? null,
        specs: p.specs,
        description: p.description,
        is_custom: !!p.isCustom,
        is_best_seller: !!p.isBestSeller,
        e_katalog_lkpp: !!p.eKatalogLkpp,
        keywords: p.keywords ?? [],
      }))
    ),
    'products'
  );
  ok(await db.from('product_costs').upsert(PRODUCTS.map(p => ({ product_id: p.id, cogs: p.cogs }))), 'product costs');
  console.log(`  ✓ ${PRODUCTS.length} produk`);

  const { count } = await db.from('discount_rules').select('id', { count: 'exact', head: true });
  if (!count) {
    ok(
      await db.from('discount_rules').insert(
        DEFAULT_DISCOUNT_RULES.map((r, i) => ({
          position: i + 1,
          min_qty: r.minQty,
          max_qty: r.maxQty ?? null,
          customer_category: r.customerCategory ?? null,
          suggested_discount: r.suggestedDiscount,
          max_allowed_discount: r.maxAllowedDiscount,
          min_margin_percent: r.minMarginPercent,
        }))
      ),
      'discount rules'
    );
    console.log(`  ✓ ${DEFAULT_DISCOUNT_RULES.length} aturan diskon`);
  }
}

async function seedQuotations(userIds: Map<string, string>) {
  for (const raw of INITIAL_QUOTATIONS) {
    const q = seedHistory(raw);
    const { data: found } = await db.from('quotations').select('id').eq('quotation_number', q.quotationNumber).maybeSingle();
    if (found) continue;
    const salesId = userIds.get(q.salesId);
    if (!salesId) continue;

    const items = q.items.map(i => ({ ...i, subtotal: calculateLineSubtotal(i) }));
    const t = calculateQuotationTotals(items, true, 11);
    const inserted = must(
      await db
        .from('quotations')
        .insert({
          quotation_number: q.quotationNumber,
          issued_on: dateOnly(q.date),
          valid_until: dateOnly(q.validUntil),
          status: q.status,
          customer: q.customer,
          sales_id: salesId,
          sales_name: q.salesName,
          sales_phone: q.salesPhone,
          subtotal: t.subtotal,
          tax_rate_percent: 11,
          tax_amount: t.taxAmount,
          grand_total: t.grandTotal,
          sales_notes: q.salesNotes,
          support_notes: q.supportNotes ?? null,
          reviewed_by: q.reviewedBy ?? null,
          reviewed_at: parseIdDate(q.reviewedAt),
          rejection_reason: q.rejectionReason ?? null,
          pdf_generated_at: parseIdDate(q.pdfGeneratedAt),
          whatsapp_status: q.whatsAppStatus ?? 'PENDING',
          history: (q.history ?? []).map(h => ({ ...h, at: parseIdDate(h.at) ?? new Date().toISOString() })),
          created_at: parseIdDate(q.date) ?? undefined,
        })
        .select('id')
        .single(),
      `quotation ${q.quotationNumber}`
    );

    ok(
      await db.from('quotation_costs').insert({
        quotation_id: inserted.id,
        total_cogs: t.totalCogs,
        gross_profit: t.grossProfit,
        gross_margin_percent: t.grossMarginPercent,
      }),
      'quotation costs'
    );

    const rows = must(
      await db
        .from('quotation_items')
        .insert(
          items.map((i, idx) => ({
            quotation_id: inserted.id,
            position: idx + 1,
            product_id: i.productId,
            product_name: i.productName,
            sku: i.sku,
            category: i.category,
            image: i.image ?? '',
            qty: i.qty,
            unit: i.unit,
            base_price: i.basePrice,
            selling_price: i.sellingPrice,
            discount_percent: i.discountPercent,
            subtotal: i.subtotal,
            notes: i.notes ?? null,
            specs: i.specs ?? null,
          }))
        )
        .select('id, position'),
      'quotation items'
    );
    ok(
      await db.from('quotation_item_costs').insert(rows.map(r => ({ item_id: r.id, cogs: items[r.position - 1]!.cogs }))),
      'quotation item costs'
    );
    console.log(`  + ${q.quotationNumber}`);
  }
}

async function seedCustomRequests(userIds: Map<string, string>) {
  for (const r of INITIAL_CUSTOM_REQUESTS) {
    const salesId = userIds.get(r.salesId);
    if (!salesId) continue;
    const { data: found } = await db.from('custom_requests').select('id').eq('sales_id', salesId).eq('product_name', r.productName).maybeSingle();
    if (found) continue;
    ok(
      await db.from('custom_requests').insert({
        sales_id: salesId,
        sales_name: r.salesName,
        product_name: r.productName,
        category: r.category,
        estimated_qty: r.estimatedQty,
        target_price_per_unit: r.targetPricePerUnit,
        specs: r.specs,
        reference_url_or_notes: r.referenceUrlOrNotes,
        submitted_at: parseIdDate(r.submittedAt) ?? undefined,
        status: r.status,
      }),
      'custom request'
    );
    console.log(`  + request ${r.productName}`);
  }
}

async function main() {
  console.log('Seeding Supabase…');
  const ids = await seedUsers();
  await seedCatalog();
  await seedQuotations(ids);
  await seedCustomRequests(ids);
  console.log(`Selesai. Masuk dengan email demo dan kata sandi "${password}".`);
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
