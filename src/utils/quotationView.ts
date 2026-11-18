/**
 * How a quotation is presented to the customer (on-screen letter and PDF), in Agusta's letter format.
 * One source so the preview and the PDF never disagree.
 *
 * PPN (tax mode):
 *   ADDED     prices before PPN, then Total / PPN 11% / Grand Total
 *   INCLUDED  every price shown incl. PPN, no PPN line, "Harga sudah termasuk PPN"
 *   EXCLUDED  prices before PPN, no PPN line, "Harga belum termasuk PPN"
 * Discount: PERCENT (column in %), AMOUNT (column in rupiah per line), HIDDEN (net unit price).
 * Charges (jasa pasang, ongkir, …) are numbered rows of the table; amount 0 prints "Termasuk".
 */
import type { DiscountMode, PaymentTerm, Quotation, QuotationItemData, TaxMode } from '../types';
import { formatRupiah } from './quotationEngine';
import { discountModeOf, letterSettingsOf, taxModeOf } from './letter';

export interface DocumentRow {
  kind: 'item' | 'charge';
  no: number;
  title: string;
  /** Specification lines, printed under the title. */
  detail: string[];
  /** Item notes from Sales ("#Pembelian 2 unit/lebih"). */
  note?: string;
  item?: QuotationItemData;
  image?: string;
  category?: string;
  qty: number;
  unit: string;
  /** null = "Termasuk". */
  unitPrice: number | null;
  /** "10%", "Rp 877.000", "–"; null when the discount column is hidden. */
  discountText: string | null;
  /** null = "Termasuk". */
  amount: number | null;
}

/** Kept for callers that only need the item lines. */
export interface DocumentLine {
  item: QuotationItemData;
  unitPrice: number;
  discountText: string | null;
  amount: number;
}

export interface DocumentTotalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface DocumentView {
  taxMode: TaxMode;
  discountMode: DiscountMode;
  /** Back-compat: PPN line shown / discount column shown. */
  showTax: boolean;
  showDiscount: boolean;
  rows: DocumentRow[];
  lines: DocumentLine[];
  totals: DocumentTotalRow[];
  /** "Keterangan": PPN statement (when not a separate line) + the quotation's terms. */
  terms: string[];
  paymentTerms: PaymentTerm[];
  /** First PPN statement, kept for callers that print one line. */
  taxTerm: string;
  /** Amount the customer pays as shown on the letter (WhatsApp etc.). */
  headlineTotal: number;
}

export const formatPercent = (p: number) =>
  Number.isInteger(p) ? `${p}%` : `${p.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}%`;

/** "- Bahan: Oscar\n- Ukuran: 45 x 43" or "Merek: X; Tipe: Y" → one line each. */
export function specLines(specs: string | undefined): string[] {
  const s = (specs ?? '').trim();
  if (!s) return [];
  const parts = s.includes('\n') ? s.split(/\r?\n/) : s.split(/;\s*/);
  return parts.map(p => p.trim()).filter(Boolean).slice(0, 12);
}

export function documentView(q: Quotation): DocumentView {
  const settings = letterSettingsOf(q);
  const taxMode = taxModeOf(q);
  const discountMode = discountModeOf(q);
  const gross = taxMode === 'INCLUDED' ? 1 + q.taxRatePercent / 100 : 1;
  const g = (v: number) => Math.round(v * gross);

  const rows: DocumentRow[] = [];
  const lines: DocumentLine[] = [];
  q.items.forEach(it => {
    const listUnit = g(it.sellingPrice);
    const amount = g(it.subtotal);
    const discount = Math.max(0, listUnit * it.qty - amount);
    const unitPrice = discountMode === 'HIDDEN' ? Math.round(amount / Math.max(1, it.qty)) : listUnit;
    const discountText =
      discountMode === 'HIDDEN' ? null : !it.discountPercent ? '–' : discountMode === 'AMOUNT' ? formatRupiah(discount) : formatPercent(it.discountPercent);
    rows.push({
      kind: 'item',
      no: rows.length + 1,
      title: it.productName,
      detail: specLines(it.specs),
      note: it.notes?.trim() || undefined,
      item: it,
      image: it.image,
      category: it.category,
      qty: it.qty,
      unit: it.unit,
      unitPrice,
      discountText,
      amount,
    });
    lines.push({ item: it, unitPrice, discountText, amount });
  });
  for (const c of q.charges ?? []) {
    rows.push({
      kind: 'charge',
      no: rows.length + 1,
      title: c.label,
      detail: specLines(c.description),
      qty: 1,
      unit: 'Lot',
      unitPrice: c.amount > 0 ? g(c.amount) : null,
      discountText: discountMode === 'HIDDEN' ? null : '–',
      amount: c.amount > 0 ? g(c.amount) : null,
    });
  }

  const linesTotal = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const extra = Math.min(linesTotal, g(Math.max(0, q.extraDiscount ?? 0)));
  const totals: DocumentTotalRow[] = [];
  if (extra > 0) {
    totals.push({ label: 'Jumlah', value: formatRupiah(linesTotal) });
    totals.push({ label: 'Diskon', value: `- ${formatRupiah(extra)}` });
  }
  let headlineTotal: number;
  if (taxMode === 'ADDED') {
    totals.push({ label: 'Total', value: formatRupiah(q.subtotal) });
    totals.push({ label: `PPN ${q.taxRatePercent}%`, value: formatRupiah(q.taxAmount) });
    totals.push({ label: 'Grand Total', value: formatRupiah(q.grandTotal), strong: true });
    headlineTotal = q.grandTotal;
  } else if (taxMode === 'INCLUDED') {
    headlineTotal = linesTotal - extra;
    totals.push({ label: 'Total', value: formatRupiah(headlineTotal), strong: true });
  } else {
    headlineTotal = q.subtotal;
    totals.push({ label: 'Total', value: formatRupiah(q.subtotal), strong: true });
  }

  const taxTerm =
    taxMode === 'INCLUDED' ? `Harga sudah termasuk PPN ${q.taxRatePercent}%` : taxMode === 'EXCLUDED' ? 'Harga belum termasuk PPN' : `Harga belum termasuk PPN ${q.taxRatePercent}% (tercantum terpisah)`;

  return {
    taxMode,
    discountMode,
    showTax: taxMode === 'ADDED',
    showDiscount: discountMode !== 'HIDDEN',
    rows,
    lines,
    totals,
    terms: [...(taxMode === 'ADDED' ? [] : [taxTerm]), ...settings.terms],
    paymentTerms: settings.paymentTerms,
    taxTerm,
    headlineTotal,
  };
}

/** "Jl. …, Semarang" without dangling commas when parts are empty. */
export const customerAddress = (q: Quotation) => [q.customer.address, q.customer.city].map(s => s?.trim()).filter(Boolean).join(', ');
