import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuotationTotals, getSuggestedDiscount, type QuotationItem } from './quotationEngine';
import { customerAddress, documentView, formatPercent } from './quotationView';
import type { Quotation } from '../types';

const items: QuotationItem[] = [
  { id: 'a', productId: 'a', productName: 'Kursi', sku: 'K', category: 'Kursi', qty: 10, unit: 'Unit', cogs: 1_200_000, basePrice: 2_250_000, sellingPrice: 2_250_000, discountPercent: 10 },
  { id: 'b', productId: 'b', productName: 'Meja', sku: 'M', category: 'Meja', qty: 2, unit: 'Unit', cogs: 3_000_000, basePrice: 4_000_000, sellingPrice: 4_000_000, discountPercent: 0 },
];

test('extra discount comes off the items before PPN and lowers the margin', () => {
  const t = calculateQuotationTotals(items, true, 11, 1_250_000);
  assert.equal(t.itemsTotal, 20_250_000 + 8_000_000);
  assert.equal(t.extraDiscount, 1_250_000);
  assert.equal(t.subtotal, 27_000_000);
  assert.equal(t.taxAmount, 2_970_000);
  assert.equal(t.grandTotal, 29_970_000);
  assert.equal(t.grossProfit, 27_000_000 - 18_000_000);
  // Never more than the items themselves.
  assert.equal(calculateQuotationTotals(items, true, 11, 99_000_000).subtotal, 0);
});

test('discount suggestion depends on brand, not on customer segment', () => {
  assert.equal(getSuggestedDiscount(25, 'INDACHI').suggestedPercent, 5);
  assert.equal(getSuggestedDiscount(25, undefined).suggestedPercent, 3); // other brands, 10+ units
});

test('additional charges: taxed, not discounted, excluded from margin', () => {
  const t = calculateQuotationTotals(items, true, 11, 1_250_000, 500_000);
  assert.equal(t.goodsSubtotal, 27_000_000);
  assert.equal(t.chargesTotal, 500_000);
  assert.equal(t.subtotal, 27_500_000);
  assert.equal(t.taxAmount, 3_025_000);
  assert.equal(t.grossProfit, 27_000_000 - 18_000_000);
  assert.equal(t.grossMarginPercent, Number(((9_000_000 / 27_000_000) * 100).toFixed(2)));
});

test('document lists charges between the items and the subtotal', () => {
  const t = calculateQuotationTotals(items, true, 11, 0, 750_000);
  const v = documentView(
    base({
      charges: [
        { id: 'c1', kind: 'INSTALL', label: 'Jasa pasang 10 unit', amount: 500_000 },
        { id: 'c2', kind: 'SHIPPING', label: 'Ongkir ke Bandung', amount: 250_000 },
      ],
      subtotal: t.subtotal,
      taxAmount: t.taxAmount,
      grandTotal: t.grandTotal,
    })
  );
  assert.deepEqual(v.totals.map(r => r.label), ['Total item', 'Jasa pasang 10 unit', 'Ongkir ke Bandung', 'Subtotal', 'PPN 11%', 'Total']);
  assert.equal(v.totals[0]!.value.replace(/\s/g, ' '), 'Rp 28.250.000');
});

const base = (over: Partial<Quotation> = {}): Quotation => {
  const t = calculateQuotationTotals(items, true, 11, over.extraDiscount ?? 0);
  return {
    id: 'q', quotationNumber: 'QTN-1', date: '', validUntil: '', status: 'APPROVED',
    customer: { companyName: 'PT A', contactPerson: 'B', phone: '', email: '', address: 'Jl. Sudirman 1', city: '' },
    salesId: 's', salesName: 'S', salesPhone: '',
    items: items.map(i => ({ ...i, image: '', subtotal: Math.round(i.qty * i.sellingPrice * (1 - i.discountPercent / 100)) })),
    subtotal: t.subtotal, taxRatePercent: 11, taxAmount: t.taxAmount, grandTotal: t.grandTotal,
    totalCogs: 0, grossProfit: 0, grossMarginPercent: 0, salesNotes: '',
    ...over,
  };
};

test('document shows PPN and discount by default', () => {
  const v = documentView(base());
  assert.equal(v.showTax && v.showDiscount, true);
  assert.equal(v.lines[0]!.unitPrice, 2_250_000);
  assert.equal(v.lines[0]!.discountText, '10%');
  assert.deepEqual(v.totals.map(r => r.label), ['Subtotal', 'PPN 11%', 'Total']);
  assert.equal(v.headlineTotal, 31_357_500);
});

test('hidden discount prints net unit prices and no discount column', () => {
  const v = documentView(base({ showDiscount: false }));
  assert.equal(v.lines[0]!.unitPrice, 2_025_000);
  assert.equal(v.lines[0]!.discountText, null);
  assert.equal(v.lines[0]!.amount, 20_250_000);
});

test('hidden PPN: total is the pre-tax subtotal, terms say PPN is excluded', () => {
  const v = documentView(base({ showTax: false, extraDiscount: 250_000 }));
  assert.deepEqual(v.totals.map(r => r.label), ['Total item', 'Diskon tambahan', 'Total (belum termasuk PPN)']);
  assert.equal(v.headlineTotal, 28_000_000);
  assert.match(v.taxTerm, /belum termasuk PPN/);
});

test('helpers: percent format and address without dangling commas', () => {
  assert.equal(formatPercent(4.444444), '4,44%');
  assert.equal(formatPercent(10), '10%');
  assert.equal(customerAddress(base()), 'Jl. Sudirman 1');
});
