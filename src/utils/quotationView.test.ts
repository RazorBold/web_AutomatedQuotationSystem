import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuotationTotals, getSuggestedDiscount, type QuotationItem } from './quotationEngine';
import { customerAddress, documentView, formatPercent, specLines } from './quotationView';
import { agustaNumber, letterDate, letterNumber, letterSubject, quotationFileName, storageFileName } from './letter';
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

const base = (over: Partial<Quotation> = {}): Quotation => {
  const charges = over.charges ?? [];
  const t = calculateQuotationTotals(items, true, 11, over.extraDiscount ?? 0, charges.reduce((s, c) => s + c.amount, 0));
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

test('default letter: discount in %, Total / PPN / Grand Total, standard terms', () => {
  const v = documentView(base());
  assert.equal(v.taxMode, 'ADDED');
  assert.equal(v.rows[0]!.unitPrice, 2_250_000);
  assert.equal(v.rows[0]!.discountText, '10%');
  assert.deepEqual(v.totals.map(r => r.label), ['Total', 'PPN 11%', 'Grand Total']);
  assert.equal(v.headlineTotal, 31_357_500);
  assert.deepEqual(v.terms, ['Harga franco Kota Semarang', 'Harga dan stok tidak mengikat']);
});

test('charges are numbered table rows; 0 prints Termasuk', () => {
  const v = documentView(
    base({
      charges: [
        { id: 'c1', kind: 'INSTALL', label: 'Jasa Instalasi dan Setting', amount: 500_000, description: 'Perapian kabel' },
        { id: 'c2', kind: 'OTHER', label: 'Testing & Commisioning', amount: 0 },
      ],
    })
  );
  assert.deepEqual(v.rows.map(r => `${r.no}:${r.kind}:${r.amount}`), ['1:item:20250000', '2:item:8000000', '3:charge:500000', '4:charge:null']);
  assert.deepEqual(v.rows[2]!.detail, ['Perapian kabel']);
  assert.equal(v.rows[3]!.unitPrice, null);
  assert.equal(v.totals[0]!.value.replace(/\s/g, ' '), 'Rp 28.750.000');
});

test('discount in rupiah per line, and hidden discount prints net unit prices', () => {
  assert.equal(documentView(base({ discountMode: 'AMOUNT' })).rows[0]!.discountText!.replace(/\s/g, ' '), 'Rp 2.250.000');
  const hidden = documentView(base({ discountMode: 'HIDDEN' }));
  assert.equal(hidden.rows[0]!.unitPrice, 2_025_000);
  assert.equal(hidden.rows[0]!.discountText, null);
  assert.equal(hidden.showDiscount, false);
});

test('PPN included: prices grossed up, single Total, statement in Keterangan', () => {
  const v = documentView(base({ taxMode: 'INCLUDED', terms: ['Harga franco Kota Semarang'] }));
  assert.equal(v.rows[0]!.unitPrice, 2_497_500);
  assert.equal(v.rows[0]!.amount, 22_477_500);
  assert.deepEqual(v.totals.map(r => r.label), ['Total']);
  assert.equal(v.headlineTotal, 22_477_500 + 8_880_000);
  assert.deepEqual(v.terms, ['Harga sudah termasuk PPN 11%', 'Harga franco Kota Semarang']);
});

test('PPN excluded (old showTax=false): pre-tax total, extra discount shown', () => {
  const v = documentView(base({ showTax: false, extraDiscount: 250_000 }));
  assert.deepEqual(v.totals.map(r => r.label), ['Jumlah', 'Diskon', 'Total']);
  assert.equal(v.headlineTotal, 28_000_000);
  assert.match(v.terms[0]!, /belum termasuk PPN/);
});

test('helpers: percent, address, spec lines', () => {
  assert.equal(formatPercent(4.444444), '4,44%');
  assert.equal(formatPercent(10), '10%');
  assert.equal(customerAddress(base()), 'Jl. Sudirman 1');
  assert.deepEqual(specLines('- Bahan: Oscar\n- Ukuran: 45 x 43\n'), ['- Bahan: Oscar', '- Ukuran: 45 x 43']);
  assert.deepEqual(specLines('Merek: X; Tipe: Y'), ['Merek: X', 'Tipe: Y']);
});

test('letter numbering, subject and file name', () => {
  assert.equal(agustaNumber(88, 'FHM', new Date(2026, 7, 29)), '0088/FHM/AG/VIII/26');
  assert.equal(letterNumber('0007/STO/AG/I/26-R1'), '0007/STO/AG/I/26');
  assert.equal(letterSubject({ quotationNumber: '0077/FHM/AG/IX/26-R2', revisionNo: 2 }), 'Penawaran Harga (Revisi 2)');
  assert.equal(letterSubject({ quotationNumber: '0005/ELY/AG/I/26' }), 'Penawaran Harga');
  assert.equal(letterDate({ issuedOn: '2026-08-29', date: '' }), '29 Agustus 2026');
  assert.equal(quotationFileName({ quotationNumber: '0007/STO/AG/I/26-R1', customerName: 'PT. Borine Technology Indonesia', revisionNo: 1 }), 'PNWR 0007 - PT. Borine Technology Indonesia - Rev1.pdf');
  assert.equal(quotationFileName({ quotationNumber: 'QTN-251103-0087', customerName: 'PT A/B' }), 'Penawaran QTN-251103-0087 - PT A B.pdf');
  assert.equal(storageFileName('PNWR 0007 - PT. Borine - Rev1.pdf'), 'PNWR_0007_-_PT._Borine_-_Rev1.pdf');
});
