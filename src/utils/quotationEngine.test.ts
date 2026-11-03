import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLineSubtotal,
  calculateQuotationTotals,
  getSuggestedDiscount,
  validateMarginSafety,
  generateQuotationNumber,
  smartProductSearch,
  formatRupiah,
  QuotationItem,
} from './quotationEngine';

test('calculateLineSubtotal applies discount correctly and rounds accurately', () => {
  // 10 items @ Rp 2.250.000 with 10% discount = 10 * 2.250.000 * 0.9 = 20.250.000
  const subtotal = calculateLineSubtotal({
    qty: 10,
    sellingPrice: 2250000,
    discountPercent: 10,
  });
  assert.equal(subtotal, 20250000);

  // 0 qty = 0
  assert.equal(calculateLineSubtotal({ qty: 0, sellingPrice: 1000000, discountPercent: 5 }), 0);

  // 0% discount
  assert.equal(calculateLineSubtotal({ qty: 2, sellingPrice: 500000, discountPercent: 0 }), 1000000);
});

test('calculateQuotationTotals computes subtotal, PPN 11%, grand total and COGS margin', () => {
  const items: QuotationItem[] = [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'KURSI INDACHI FILMORE I AL',
      sku: 'IND-FILM-1',
      category: 'Kursi Kantor',
      qty: 10,
      unit: 'Unit',
      cogs: 1200000, // Total COGS = 12.000.000
      basePrice: 2250000,
      sellingPrice: 2250000,
      discountPercent: 10, // Subtotal = 20.250.000
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      productName: 'LENOVO AIO ThinkCentre Neo 50a',
      sku: 'LEN-TC-50A',
      category: 'AIO',
      qty: 5,
      unit: 'Unit',
      cogs: 7500000, // Total COGS = 37.500.000
      basePrice: 9800000,
      sellingPrice: 9800000,
      discountPercent: 5, // 5 * 9.800.000 * 0.95 = 46.550.000
    },
  ];

  const totals = calculateQuotationTotals(items, true, 11);

  // Subtotal = 20.250.000 + 46.550.000 = 66.800.000 (matching the reference quotation image!)
  assert.equal(totals.subtotal, 66800000);

  // PPN 11% = 66.800.000 * 0.11 = 7.348.000 (matching the reference quotation image!)
  assert.equal(totals.taxAmount, 7348000);

  // Grand Total = 66.800.000 + 7.348.000 = 74.148.000 (matching the reference quotation image!)
  assert.equal(totals.grandTotal, 74148000);

  // Total COGS = 12.000.000 + 37.500.000 = 49.500.000
  assert.equal(totals.totalCogs, 49500000);

  // Gross profit = 66.800.000 - 49.500.000 = 17.300.000
  assert.equal(totals.grossProfit, 17300000);

  // Margin % = (17.300.000 / 66.800.000) * 100 = ~25.9%
  assert.ok(totals.grossMarginPercent > 25);
  assert.equal(totals.totalItemsCount, 15);
});

test('getSuggestedDiscount returns tiered discount based on quantity and customer segment', () => {
  // Corporate low qty
  assert.equal(getSuggestedDiscount(2, 'CORPORATE').suggestedPercent, 0);
  // Corporate 10 units -> 5%
  assert.equal(getSuggestedDiscount(10, 'CORPORATE').suggestedPercent, 5);
  // Corporate 25 units -> 8%
  assert.equal(getSuggestedDiscount(25, 'CORPORATE').suggestedPercent, 8);
  // Corporate 60 units -> 10%
  assert.equal(getSuggestedDiscount(60, 'CORPORATE').suggestedPercent, 10);

  // BUMN / Gov automatic 5%
  assert.equal(getSuggestedDiscount(1, 'BUMN_GOV').suggestedPercent, 5);
});

test('validateMarginSafety protects against selling below COGS + threshold', () => {
  const cogs = 1000000;
  const sellingPrice = 1200000;

  // 5% discount: effective price = 1.140.000, margin = 140.000 / 1.140.000 = 12.28% (safe >= 12%)
  const checkSafe = validateMarginSafety(cogs, sellingPrice, 5, 12);
  assert.equal(checkSafe.isSafe, true);

  // 20% discount: effective price = 960.000 (below COGS!), unsafe
  const checkUnsafe = validateMarginSafety(cogs, sellingPrice, 20, 12);
  assert.equal(checkUnsafe.isSafe, false);
  assert.ok(checkUnsafe.currentMarginPercent < 0);
});

test('smartProductSearch finds products with fuzzy terms and synonyms', () => {
  const products = [
    { id: '1', name: 'KURSI INDACHI FILMORE I AL', sku: 'IND-FILM-1', category: 'Kursi Kantor', keywords: ['ergonomis', 'mesh'] },
    { id: '2', name: 'LENOVO AIO ThinkCentre Neo 50a', sku: 'LEN-TC-50A', category: 'AIO', keywords: ['komputer', 'desktop'] },
    { id: '3', name: 'MEJA RAPAT BOARDROOM 8 PAX', sku: 'TBL-BRD-8', category: 'Meja Rapat', keywords: ['meeting', 'meja kayu'] },
  ];

  // Search by exact keyword
  const r1 = smartProductSearch(products, 'filmore');
  assert.equal(r1.length, 1);
  assert.equal(r1[0].id, '1');

  // Search by synonym "kursi kantor ergonomis" matches Indachi Filmore
  const r2 = smartProductSearch(products, 'kursi kantor ergonomis');
  assert.ok(r2.some(p => p.id === '1'));

  // Search by "komputer" matches AIO ThinkCentre
  const r3 = smartProductSearch(products, 'komputer');
  assert.ok(r3.some(p => p.id === '2'));
});

test('generateQuotationNumber outputs standard QTN-YYMMDD-XXXX format', () => {
  const fixedDate = new Date(2026, 10, 3); // 03 Nov 2026
  const qtn = generateQuotationNumber(87, fixedDate);
  assert.equal(qtn, 'QTN-261103-0087');
});

test('formatRupiah formats Indonesian currency symbol and thousand separator', () => {
  const formatted = formatRupiah(125400000);
  assert.ok(formatted.includes('125.400.000'));
});
