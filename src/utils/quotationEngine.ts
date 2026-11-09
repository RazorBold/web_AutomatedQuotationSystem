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

export interface DiscountRule {
  minQty: number;
  maxQty?: number;
  customerCategory?: CustomerCategory;
  suggestedDiscount: number; // Percentage
  maxAllowedDiscount: number; // Maximum limit before requiring Director approval
  minMarginPercent: number; // Safety floor
}

export const DEFAULT_DISCOUNT_RULES: DiscountRule[] = [
  { minQty: 1, maxQty: 4, customerCategory: 'RETAIL', suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 20 },
  { minQty: 1, maxQty: 4, customerCategory: 'CORPORATE', suggestedDiscount: 0, maxAllowedDiscount: 5, minMarginPercent: 20 },
  { minQty: 1, maxQty: 9, customerCategory: 'EDUCATION', suggestedDiscount: 3, maxAllowedDiscount: 7, minMarginPercent: 18 },
  { minQty: 5, maxQty: 19, customerCategory: 'CORPORATE', suggestedDiscount: 5, maxAllowedDiscount: 10, minMarginPercent: 18 },
  { minQty: 20, maxQty: 49, customerCategory: 'CORPORATE', suggestedDiscount: 8, maxAllowedDiscount: 12, minMarginPercent: 15 },
  { minQty: 50, customerCategory: 'CORPORATE', suggestedDiscount: 10, maxAllowedDiscount: 15, minMarginPercent: 12 },
  { minQty: 1, customerCategory: 'BUMN_GOV', suggestedDiscount: 5, maxAllowedDiscount: 12, minMarginPercent: 15 },
  { minQty: 10, customerCategory: 'EDUCATION', suggestedDiscount: 7, maxAllowedDiscount: 12, minMarginPercent: 15 },
];

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
 * Calculate total quotation financials including PPN (11% Indonesia VAT)
 */
export function calculateQuotationTotals(
  items: QuotationItem[],
  includeTax: boolean = true,
  taxRatePercent: number = 11
) {
  let subtotal = 0;
  let totalCogs = 0;
  let totalGrossBase = 0;

  for (const item of items) {
    const lineSubtotal = calculateLineSubtotal(item);
    subtotal += lineSubtotal;
    totalCogs += Math.round(item.qty * (item.cogs || 0));
    totalGrossBase += Math.round(item.qty * item.sellingPrice);
  }

  const taxAmount = includeTax ? Math.round((subtotal * taxRatePercent) / 100) : 0;
  const grandTotal = subtotal + taxAmount;
  const grossProfit = subtotal - totalCogs;
  const grossMarginPercent = subtotal > 0 ? Number(((grossProfit / subtotal) * 100).toFixed(2)) : 0;
  const totalDiscountAmount = totalGrossBase - subtotal;

  return {
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

/**
 * Determine suggested discount based on quantity and customer segment
 */
export function getSuggestedDiscount(
  qty: number,
  category: CustomerCategory = 'CORPORATE',
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
  // Retail customers fall back to the corporate tiers when no retail rule matches.
  const pick = (cat: CustomerCategory) =>
    rules
      .filter(r => r.customerCategory === cat && inRange(r))
      .sort((a, b) => b.minQty - a.minQty)[0];

  const rule = pick(category) ?? (category === 'RETAIL' ? pick('CORPORATE') : undefined);
  if (!rule) return { suggestedPercent: 0, maxAllowedPercent: 5, minMarginPercent: 20 };

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
}): string {
  const formattedTotal = formatRupiah(params.totalAmount);
  return [
    `*NOTIFIKASI RESMI AGUSTA QUOTATION SYSTEM*`,
    `Halo *${params.salesName}*,`,
    ``,
    `Pengajuan surat penawaran Anda telah *DISETUJUI* oleh Tim Sales Support:`,
    `• *No. Penawaran*: ${params.quotationNumber}`,
    `• *Customer*: ${params.customerName}`,
    `• *Total Penawaran*: ${formattedTotal} (inc. PPN 11%)`,
    `• *Disetujui Oleh*: ${params.approvedBy}`,
    `• *Waktu Approval*: ${params.approvalDate}`,
    ``,
    `📄 Dokumen PDF resmi dengan stempel & tanda tangan digital telah diterbitkan.`,
    `Link unduh PDF: ${params.downloadUrl || 'https://agusta-quotation.internal/preview/' + params.quotationNumber}`,
    ``,
    `_Pesan otomatis dikirim oleh AGUSTA Business & Office Equipment Workflow Engine._`
  ].join('\n');
}
