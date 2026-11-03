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
export function getSuggestedDiscount(qty: number, category: CustomerCategory = 'CORPORATE'): {
  suggestedPercent: number;
  maxAllowedPercent: number;
  minMarginPercent: number;
} {
  if (qty <= 0) {
    return { suggestedPercent: 0, maxAllowedPercent: 0, minMarginPercent: 20 };
  }

  if (category === 'BUMN_GOV') {
    return { suggestedPercent: 5, maxAllowedPercent: 12, minMarginPercent: 15 };
  }

  if (category === 'EDUCATION') {
    return qty >= 10
      ? { suggestedPercent: 7, maxAllowedPercent: 12, minMarginPercent: 15 }
      : { suggestedPercent: 3, maxAllowedPercent: 7, minMarginPercent: 18 };
  }

  // Corporate / Standard
  if (qty >= 50) return { suggestedPercent: 10, maxAllowedPercent: 15, minMarginPercent: 12 };
  if (qty >= 20) return { suggestedPercent: 8, maxAllowedPercent: 12, minMarginPercent: 15 };
  if (qty >= 5) return { suggestedPercent: 5, maxAllowedPercent: 10, minMarginPercent: 18 };
  return { suggestedPercent: 0, maxAllowedPercent: 5, minMarginPercent: 20 };
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
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return products;

  // Synonyms map for office furniture & IT equipment in Indonesian
  const synonymMap: Record<string, string[]> = {
    ergonomis: ['filmore', 'vino', 'lumbar', 'headrest', 'kursi kantor', 'mesh'],
    kursi: ['indachi', 'filmore', 'vino', 'chair', 'kursi kerja', 'kursi direktur', 'kursi kantor'],
    komputer: ['aio', 'pc', 'all in one', 'lenovo', 'asus', 'acer', 'zyrex', 'thinkcentre'],
    aio: ['all-in-one', 'thinkcentre', 'ideacentre', 'veriton', 'expertcenter', 'pc'],
    meja: ['desk', 'table', 'resepsionis', 'sekolah', 'cradenza', 'meja kerja', 'rapat'],
    lemari: ['filing', 'cabinet', 'arsip', 'locker', 'rak', 'wardrobe'],
  };

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  // Expand query tokens with synonyms
  const expandedTokens = new Set<string>(queryTokens);
  for (const token of queryTokens) {
    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (token.includes(key) || key.includes(token)) {
        synonyms.forEach(syn => expandedTokens.add(syn));
      }
    }
  }

  const scored = products.map(product => {
    let score = 0;
    const nameLower = product.name.toLowerCase();
    const skuLower = product.sku.toLowerCase();
    const catLower = product.category.toLowerCase();
    const descLower = (product.description || '').toLowerCase();
    const specsLower = (product.specs || '').toLowerCase();

    // Exact full query match
    if (nameLower.includes(normalizedQuery)) score += 50;
    if (skuLower.includes(normalizedQuery)) score += 60;
    if (catLower.includes(normalizedQuery)) score += 30;

    // Token scoring
    for (const token of expandedTokens) {
      if (nameLower.includes(token)) score += 15;
      if (skuLower.includes(token)) score += 20;
      if (catLower.includes(token)) score += 10;
      if (descLower.includes(token)) score += 5;
      if (specsLower.includes(token)) score += 5;
      if (product.keywords?.some(k => k.toLowerCase().includes(token))) score += 12;
    }

    return { product, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
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
