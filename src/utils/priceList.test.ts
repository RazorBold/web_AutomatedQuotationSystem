import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types';
import { cellPrice, detectColumns, effectiveChanges, lineAmounts, matchPriceList, parseCsv, pdfItemsToRows } from './priceList';
import { buildSupplierQuery, cleanHits, extractPrice, mapSerperOrganic, normalizeDomain } from './supplierSearch';

const product = (id: string, sku: string, name: string, cogs: number, basePrice = cogs * 2): Product => ({
  id, sku, name, cogs, basePrice, category: 'Kursi', brand: 'INDACHI', image: '', stock: 0, unit: 'Unit', specs: '', description: '',
});
const PRODUCTS = [
  product('p1', 'IND-FLM-1-AL', 'KURSI INDACHI FILMORE I AL', 1_200_000),
  product('p2', 'CH-100', 'KURSI CHITOSE 100', 400_000),
  product('p3', 'PC-600S', 'DRY CABINET PROCORE PC-600S', 5_000_000),
];

test('amount cells and amounts inside text', () => {
  assert.equal(cellPrice(2250000), 2250000);
  assert.equal(cellPrice('Rp 2.250.000,00'), 2250000);
  assert.equal(cellPrice('IDR 950,000'), 950000);
  assert.equal(cellPrice('12'), 0);
  assert.equal(cellPrice('PC-600S'), 0);
  assert.deepEqual(lineAmounts('PC-600S Dry cabinet 600L 1 unit Rp 5.250.000'), [5250000]);
  assert.deepEqual(lineAmounts('Qty 10 harga 1.250.000 net 1.150.000'), [1250000, 1150000]);
});

test('spreadsheet with a header: detects SKU + net price columns', () => {
  const rows = [
    ['PRICE LIST PT SUPPLIER', null, null, null],
    ['Kode Barang', 'Nama', 'Harga List', 'Harga Net'],
    ['IND-FLM-1-AL', 'Filmore I AL', 1_500_000, 1_260_000],
    ['ch 100', 'Chitose 100', '450.000', '400.000'],
    ['XYZ-999', 'Tidak ada di katalog', 900_000, 800_000],
  ];
  const cols = detectColumns(rows);
  assert.deepEqual(cols, { sku: 0, price: 3, headerRow: 1 });
  const r = matchPriceList(rows, PRODUCTS);
  assert.deepEqual(r.matches.map(m => [m.productId, m.newCogs, m.suspicious]), [
    ['p1', 1_260_000, false],
    ['p2', 400_000, false],
  ]);
  assert.equal(effectiveChanges(r.matches).length, 1, 'unchanged price is not a change');
  assert.deepEqual(r.unmatched.map(u => u.line), [5]);
});

test('no header: SKU found in any cell, last amount on the row', () => {
  const rows = [['1', 'PC-600S', 'Dry cabinet', '2 unit', 'Rp 5.250.000']];
  const r = matchPriceList(rows, PRODUCTS);
  assert.equal(r.matches[0]!.newCogs, 5_250_000);
  assert.equal(r.matches[0]!.line, 1);
});

test('big jumps are flagged; duplicates keep the first row', () => {
  const rows = [
    ['IND-FLM-1-AL', '3.000.000'],
    ['IND-FLM-1-AL', '1.250.000'],
  ];
  const r = matchPriceList(rows, PRODUCTS, { sku: 0, price: 1, headerRow: -1 });
  assert.equal(r.matches[0]!.suspicious, true);
  assert.equal(r.matches[1]!.duplicate, true);
  assert.deepEqual(effectiveChanges(r.matches).map(m => m.newCogs), [3_000_000]);
});

test('PDF lines: text items grouped into cells, SKU found inside a line', () => {
  const rows = pdfItemsToRows([
    { str: 'No', x: 10, y: 700, width: 12 },
    { str: 'Kode', x: 40, y: 700, width: 25 },
    { str: 'Harga', x: 300, y: 700, width: 30 },
    { str: '1', x: 10, y: 680, width: 5 },
    { str: 'IND-FLM-1-AL Filmore', x: 40, y: 681, width: 120 },
    { str: 'Rp 1.300.000', x: 300, y: 680, width: 60 },
  ]);
  assert.deepEqual(rows, [['No', 'Kode', 'Harga'], ['1', 'IND-FLM-1-AL Filmore', 'Rp 1.300.000']]);
  const r = matchPriceList(rows, PRODUCTS);
  assert.equal(r.matches[0]?.newCogs, 1_300_000);
});

test('CSV: quotes, semicolons, BOM', () => {
  assert.deepEqual(parseCsv('﻿sku;harga\n"CH-100";"400.000"\r\n"A;B";"x ""y"""\n'), [
    ['sku', 'harga'],
    ['CH-100', '400.000'],
    ['A;B', 'x "y"'],
  ]);
});

test('supplier search: domains, query, prices, marketplace filter', () => {
  assert.equal(normalizeDomain('https://www.Chitose-Indonesia.com/produk?x=1'), 'chitose-indonesia.com');
  assert.equal(normalizeDomain('bukan domain'), '');
  assert.deepEqual(buildSupplierQuery('kursi  kerja', ['a.com', 'https://b.co.id/x', 'a.com']), {
    q: 'kursi kerja (site:a.com OR site:b.co.id)',
    scope: 'SITES',
  });
  const web = buildSupplierQuery('kursi kerja', []);
  assert.equal(web.scope, 'WEB');
  assert.match(web.q, /^kursi kerja harga -site:tokopedia\.com/);
  assert.equal(extractPrice('Harga mulai Rp 1.250.000 per unit'), 1_250_000);
  assert.equal(extractPrice('Hubungi kami untuk harga'), 0);
  const hit = mapSerperOrganic({ title: 'Kursi X', link: 'https://shop.supplier.co.id/p/1', snippet: 'Rp2.100.000' }, [
    { id: '1', name: 'PT Supplier', domain: 'supplier.co.id' },
  ]);
  assert.deepEqual([hit?.supplier, hit?.domain, hit?.price], ['PT Supplier', 'shop.supplier.co.id', 2_100_000]);
  const cleaned = cleanHits([
    { title: 'a', url: '', domain: 'www.tokopedia.com', supplier: '', snippet: '', price: 1 },
    { title: 'b', url: '', domain: 'x.com', supplier: '', snippet: '', price: 0 },
    { title: 'c', url: '', domain: 'y.com', supplier: '', snippet: '', price: 5000 },
  ]);
  assert.deepEqual(cleaned.map(h => h.title), ['c', 'b']);
});
