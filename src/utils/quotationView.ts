/**
 * How a quotation is presented to the customer (on-screen letter and PDF), following the
 * Sales Support display settings. One source so the preview and the PDF never disagree.
 */
import type { Quotation, QuotationItemData } from '../types';
import { formatRupiah } from './quotationEngine';

export interface DocumentLine {
  item: QuotationItemData;
  /** Unit price as printed: list price, or the price after the item discount when discounts are hidden. */
  unitPrice: number;
  /** "10%", "4,44%" or "–"; null when the discount column is hidden. */
  discountText: string | null;
  amount: number;
}

export interface DocumentTotalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface DocumentView {
  showTax: boolean;
  showDiscount: boolean;
  lines: DocumentLine[];
  totals: DocumentTotalRow[];
  /** First line of the terms: says whether PPN is included. */
  taxTerm: string;
  /** Amount communicated as "total" (WhatsApp etc.): with PPN, or the pre-tax subtotal when PPN is hidden. */
  headlineTotal: number;
}

export const formatPercent = (p: number) =>
  Number.isInteger(p) ? `${p}%` : `${p.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}%`;

export function documentView(q: Quotation): DocumentView {
  const showTax = q.showTax !== false;
  const showDiscount = q.showDiscount !== false;
  const extra = Math.max(0, q.extraDiscount ?? 0);

  const lines: DocumentLine[] = q.items.map(it => ({
    item: it,
    unitPrice: showDiscount ? it.sellingPrice : Math.round(it.sellingPrice * (1 - it.discountPercent / 100)),
    discountText: showDiscount ? (it.discountPercent ? formatPercent(it.discountPercent) : '–') : null,
    amount: it.subtotal,
  }));

  const totals: DocumentTotalRow[] = [];
  if (extra > 0) {
    totals.push({ label: 'Total item', value: formatRupiah(q.subtotal + extra) });
    totals.push({ label: 'Diskon tambahan', value: `- ${formatRupiah(extra)}` });
  }
  if (showTax) {
    totals.push({ label: 'Subtotal', value: formatRupiah(q.subtotal) });
    totals.push({ label: `PPN ${q.taxRatePercent}%`, value: formatRupiah(q.taxAmount) });
    totals.push({ label: 'Total', value: formatRupiah(q.grandTotal), strong: true });
  } else {
    totals.push({ label: 'Total (belum termasuk PPN)', value: formatRupiah(q.subtotal), strong: true });
  }

  return {
    showTax,
    showDiscount,
    lines,
    totals,
    taxTerm: showTax
      ? `Harga sudah termasuk PPN ${q.taxRatePercent}% dan pengiriman wilayah Jabodetabek.`
      : 'Harga belum termasuk PPN. Harga sudah termasuk pengiriman wilayah Jabodetabek.',
    headlineTotal: showTax ? q.grandTotal : q.subtotal,
  };
}

/** "Jl. …, Jakarta" without dangling commas when parts are empty. */
export const customerAddress = (q: Quotation) => [q.customer.address, q.customer.city].map(s => s?.trim()).filter(Boolean).join(', ');
