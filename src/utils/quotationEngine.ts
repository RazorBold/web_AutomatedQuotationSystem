import { rankProducts } from './smartSearch.js';

/**
 * Business logic and math engine for Agusta Automated Quotation System
 * Pure functions decoupled from UI for deterministic calculations and unit testing.
 */

export interface QuotationItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  image?: string;
  qty: number;
  unit: string;
  cogs: number; // Cost of Goods Sold (Harga Pokok Penjualan / Modal) - Confidential to Sales Support
  basePrice: number; // Normal catalog selling price
  sellingPrice: number; // Approved/proposed unit price before discount
  discountPercent: number; // Discount % (0 - 100)
  specs?: string;
  notes?: string;
}

export type CustomerCategory = 'BUMN_GOV' | 'CORPORATE' | 'EDUCATION' | 'RETAIL';

/**
 * Discount rule per brand (merek) and quantity tier. A rule without `brand` applies to every brand
 * that has no rule of its own ("Semua merek lain").
 */
export interface DiscountRule {
  minQty: number;
  maxQty?: number;
  /** Brand name, matched case-insensitively. Empty = all other brands. */
  brand?: string;
  suggestedDiscount: number; // Percentage
  maxAllowedDiscount: number; // Above this, Sales Support should escalate to Management
  minMarginPercent: number; // Safety floor
}

/** Placeholder figures until Agusta sends the real per-brand rules (revisi.md Q12). */
export const DEFAULT_DISCOUNT_RULES: DiscountRule[] = [
  { brand: 'INDACHI', minQty: 1, maxQty: 9, suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 20 },
  { brand: 'INDACHI', minQty: 10, maxQty: 49, suggestedDiscount: 5, maxAllowedDiscount: 10, minMarginPercent: 18 },
  { brand: 'INDACHI', minQty: 50, suggestedDiscount: 8, maxAllowedDiscount: 12, minMarginPercent: 15 },
  { brand: 'LENOVO', minQty: 1, maxQty: 4, suggestedDiscount: 0, maxAllowedDiscount: 3, minMarginPercent: 12 },
  { brand: 'LENOVO', minQty: 5, suggestedDiscount: 3, maxAllowedDiscount: 5, minMarginPercent: 10 },
  { brand: 'ASUS', minQty: 1, suggestedDiscount: 2, maxAllowedDiscount: 5, minMarginPercent: 10 },
  { brand: 'ACER', minQty: 1, suggestedDiscount: 2, maxAllowedDiscount: 5, minMarginPercent: 10 },
  { brand: 'AGUSTA', minQty: 1, maxQty: 4, suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 20 },
  { brand: 'AGUSTA', minQty: 5, suggestedDiscount: 5, maxAllowedDiscount: 10, minMarginPercent: 18 },
  { minQty: 1, maxQty: 9, suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 20 },
  { minQty: 10, suggestedDiscount: 3, maxAllowedDiscount: 8, minMarginPercent: 15 },
];

/** "Indachi " / "indachi" → "INDACHI". */
export const normalizeBrand = (b: string | null | undefined) => (b ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Calculate line item subtotal after discount
 */
export function calculateLineSubtotal(item: Pick<QuotationItem, 'qty' | 'sellingPrice' | 'discountPercent'>): number {
  const qty = Math.max(0, item.qty);
  const price = Math.max(0, item.sellingPrice);
  const discount = Math.min(100, Math.max(0, item.discountPercent));
  const rawSubtotal = qty * price * (1 - discount / 100);
  return Math.round(rawSubtotal);
}

/**
 * Calculate total quotation financials including PPN (11% Indonesia VAT).
 *
 * - `extraDiscount`: quotation-level discount in rupiah (diskon tambahan), taken off the item lines.
 * - `chargesTotal`: additional charges (jasa pasang, ongkir, …). Subject to PPN, not discounted,
 *   and passed through at cost, so they are excluded from margin.
 *
 * `subtotal` = items − extra discount + charges (the PPN base). Margin is computed on the goods only.
 */
export function calculateQuotationTotals(
  items: QuotationItem[],
  includeTax: boolean = true,
  taxRatePercent: number = 11,
  extraDiscount: number = 0,
  chargesTotal: number = 0
) {
  let itemsTotal = 0;
  let totalCogs = 0;
  let totalGrossBase = 0;

  for (const item of items) {
    const lineSubtotal = calculateLineSubtotal(item);
    itemsTotal += lineSubtotal;
    totalCogs += Math.round(item.qty * (item.cogs || 0));
    totalGrossBase += Math.round(item.qty * item.sellingPrice);
  }

  const appliedExtraDiscount = Math.min(itemsTotal, Math.max(0, Math.round(extraDiscount || 0)));
  const goodsSubtotal = itemsTotal - appliedExtraDiscount;
  const charges = Math.max(0, Math.round(chargesTotal || 0));
  const subtotal = goodsSubtotal + charges;
  const taxAmount = includeTax ? Math.round((subtotal * taxRatePercent) / 100) : 0;
  const grandTotal = subtotal + taxAmount;
  const grossProfit = goodsSubtotal - totalCogs;
  const grossMarginPercent = goodsSubtotal > 0 ? Number(((grossProfit / goodsSubtotal) * 100).toFixed(2)) : 0;
  const totalDiscountAmount = totalGrossBase - goodsSubtotal;

  return {
    itemsTotal,
    extraDiscount: appliedExtraDiscount,
    goodsSubtotal,
    chargesTotal: charges,
    subtotal,
    taxRatePercent: includeTax ? taxRatePercent : 0,
    taxAmount,
    grandTotal,
    totalCogs,
    grossProfit,
    grossMarginPercent,
    totalDiscountAmount,
    totalItemsCount: items.reduce((sum, item) => sum + item.qty, 0),
  };
}

/** Used when no rule applies at all. */
export const FALLBACK_DISCOUNT = { suggestedPercent: 0, maxAllowedPercent: 5, minMarginPercent: 20 } as const;

/**
 * Suggested and maximum discount for an item, by its brand and quantity.
 * Brand-specific rules win; otherwise the "all other brands" rules (no brand) apply.
 */
export function getSuggestedDiscount(
  qty: number,
  brand: string | null | undefined,
  rules: DiscountRule[] = DEFAULT_DISCOUNT_RULES
): {
  suggestedPercent: number;
  maxAllowedPercent: number;
  minMarginPercent: number;
} {
  if (qty <= 0) {
    return { suggestedPercent: 0, maxAllowedPercent: 0, minMarginPercent: 20 };
  }
  const inRange = (r: DiscountRule) => qty >= r.minQty && (r.maxQty === undefined || qty <= r.maxQty);
  const b = normalizeBrand(brand);
  const pick = (match: (r: DiscountRule) => boolean) =>
    rules.filter(r => match(r) && inRange(r)).sort((x, y) => y.minQty - x.minQty)[0];

  const hasOwnRules = b !== '' && rules.some(r => normalizeBrand(r.brand) === b);
  const rule = hasOwnRules ? pick(r => normalizeBrand(r.brand) === b) : pick(r => !normalizeBrand(r.brand));
  if (!rule) return { ...FALLBACK_DISCOUNT };

  return {
    suggestedPercent: rule.suggestedDiscount,
    maxAllowedPercent: rule.maxAllowedDiscount,
    minMarginPercent: rule.minMarginPercent,
  };
}

/**
 * Validates if the price/discount gives a safe gross margin above COGS
 */
export function validateMarginSafety(
  cogs: number,
  sellingPrice: number,
  discountPercent: number,
  minRequiredMarginPercent: number = 12
): { isSafe: boolean; currentMarginPercent: number; minSellingPrice: number } {
  if (sellingPrice <= 0) {
    return { isSafe: false, currentMarginPercent: -100, minSellingPrice: cogs };
  }

  const effectiveSellingPrice = sellingPrice * (1 - discountPercent / 100);
  const minSellingPrice = cogs / (1 - minRequiredMarginPercent / 100);

  if (effectiveSellingPrice <= 0) {
    return { isSafe: false, currentMarginPercent: -100, minSellingPrice };
  }

  const currentMarginPercent = ((effectiveSellingPrice - cogs) / effectiveSellingPrice) * 100;
  const isSafe = currentMarginPercent >= minRequiredMarginPercent;

  return {
    isSafe,
    currentMarginPercent: Number(currentMarginPercent.toFixed(2)),
    minSellingPrice: Math.round(minSellingPrice),
  };
}

/**
 * Format Indonesian Rupiah currency
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('IDR', 'Rp');
}

/**
 * Smart Search & fuzzy keyword token matching for product database
 */
export interface SearchableProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  keywords?: string[];
  description?: string;
  specs?: string;
}

export function smartProductSearch<T extends SearchableProduct>(products: T[], query: string): T[] {
  // Delegates to the request-aware engine: synonyms, typo tolerance, quantity/budget/spec parsing.
  return rankProducts(products, query);
}

/**
 * Format quotation number sequence (e.g., QTN-261103-0087)
 */
export function generateQuotationNumber(sequenceNumber: number, date: Date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const paddedSeq = sequenceNumber.toString().padStart(4, '0');
  return `QTN-${year}${month}${day}-${paddedSeq}`;
}

/**
 * Generate formatted WhatsApp notification text
 */
export function formatWhatsAppQuotationMessage(params: {
  salesName: string;
  quotationNumber: string;
  customerName: string;
  totalAmount: number;
  approvedBy: string;
  approvalDate: string;
  downloadUrl?: string;
  /** False when the quotation is shown without PPN; the amount is then the pre-tax subtotal. */
  includesTax?: boolean;
}): string {
  const formattedTotal = formatRupiah(params.totalAmount);
  const taxNote = params.includesTax === false ? 'belum termasuk PPN' : 'inc. PPN 11%';
  return [
    `*NOTIFIKASI RESMI AGUSTA QUOTATION SYSTEM*`,
    `Halo *${params.salesName}*,`,
    ``,
    `Pengajuan surat penawaran Anda telah *DISETUJUI* oleh Tim Sales Support:`,
    `• *No. Penawaran*: ${params.quotationNumber}`,
    `• *Customer*: ${params.customerName}`,
    `• *Total Penawaran*: ${formattedTotal} (${taxNote})`,
    `• *Disetujui Oleh*: ${params.approvedBy}`,
    `• *Waktu Approval*: ${params.approvalDate}`,
    ``,
    `📄 Dokumen PDF resmi dengan stempel & tanda tangan digital telah diterbitkan.`,
    `Link unduh PDF: ${params.downloadUrl || 'https://agusta-quotation.internal/preview/' + params.quotationNumber}`,
    ``,
    `_Pesan otomatis dikirim oleh AGUSTA Business & Office Equipment Workflow Engine._`
  ].join('\n');
}
