import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types';
import { cellPrice, detectColumns, effectiveChanges, lineAmounts, matchPriceList, parseCsv, pdfItemsToRows } from './priceList';
import { buildSupplierQuery, cleanHits, extractPrice, isProductHit, mapSerperOrganic, normalizeDomain } from './supplierSearch';

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
    { title: 'a', url: 'https://www.tokopedia.com/p/a', domain: 'www.tokopedia.com', supplier: '', snippet: '', price: 1 },
    { title: 'b', url: 'https://x.com/produk/b', domain: 'x.com', supplier: '', snippet: '', price: 0 },
    { title: 'c', url: 'https://y.com/kursi-c', domain: 'y.com', supplier: '', snippet: '', price: 5000 },
  ]);
  assert.deepEqual(cleaned.map(h => h.title), ['c', 'b']);
});

test('supplier search keeps product pages only', () => {
  const page = (url: string, title = 'Kursi lipat', snippet = '') => isProductHit({ url, title, snippet }, 'kursi lipat');
  assert.equal(page('https://chitose-indonesia.com/product/folding-chair-yamato'), true);
  assert.equal(page('https://chitose-indonesia.com/downloads/Laporan-Tahunan-2025.pdf', 'Laporan-Tahunan-2025.pdf'), false);
  assert.equal(page('https://chitose-indonesia.com/files/katalog.PDF?v=2'), false);
  assert.equal(page('https://chitose-indonesia.com/', 'Chitose International'), false);
  assert.equal(page('https://chitose-indonesia.com/en'), false);
  assert.equal(page('https://chitose-indonesia.com/investor/rups'), false);
  assert.equal(page('https://chitose-indonesia.com/kursi-x', 'LAPORAN TAHUNAN ANNUAL REPORT'), false);
  assert.equal(page('https://brother.co.id/about-us', 'Tentang Kami'), false);
  assert.equal(page('https://brother.co.id/news/pameran-2026'), false);
  assert.equal(page('https://brother.co.id/aboutness-chair'), true);
  // Corporate pages without a product signal are dropped; a price or a product URL keeps a page.
  assert.equal(page('https://www.brother.co.id/id-id/solutions/customisation', 'Customisation Solutions'), false);
  assert.equal(page('https://www.chitose-indonesia.com/id/who-we-are/', 'Who We Are – Chitose International'), false);
  assert.equal(page('https://x.co.id/kategori/kantor-123', 'Kursi Kerja Model A'), false);
  assert.equal(page('https://x.co.id/produk/kursi-kerja-a', 'Kursi Kerja Model A'), true);
  // Buying guides and inspiration articles, even with a price in the text.
  assert.equal(isProductHit({ url: 'https://informa.co.id/inspirations/rekomendasi-kursi-kerja', title: '10 Rekomendasi Kursi Kerja Terbaik', snippet: '', price: 529000 }, 'kursi kerja'), false);
  assert.equal(isProductHit({ url: 'https://www.ikea.co.id/in/inspirasi/jenis-kursi-kantor', title: 'Daftar Jenis Kursi Kantor dan Harganya', snippet: '' }, 'kursi kantor'), false);
  assert.equal(page('https://www.ikea.co.id/in/produk/ruang-kerja-kantor/kursi-kantor/markus-art-50261151', 'MARKUS kursi kantor'), true);
  assert.equal(isProductHit({ url: 'https://x.co.id/kursi-a', title: 'Kursi A', snippet: '', price: 850000 }, 'meja'), true);
  assert.equal(page('https://www.chitose-indonesia.com/id/chitose-at-apkasi-otonomi-expo-2026/', 'Chitose Hadir di Apkasi Otonomi Expo 2026'), false);
  // "Expo" (the brand) is not mistaken for an event page; every search word in the title is a product signal.
  assert.equal(isProductHit({ url: 'https://expo.co.id/lemari-pakaian-lp-2101', title: 'EXPO LP-2101 Lemari Pakaian', snippet: '' }, 'lemari pakaian expo'), true);
  const listed = cleanHits(
    [
      { title: 'Kursi kantor', url: 'https://www.chitose-indonesia.com/produk/kursi-kantor', domain: 'chitose-indonesia.com', supplier: '', snippet: '', price: 0 },
      { title: 'Alamat Kantor', url: 'https://www.bawaslu.go.id/id/profil/alamat-kantor', domain: 'bawaslu.go.id', supplier: '', snippet: '', price: 0 },
    ],
    ['chitose-indonesia.com', 'brother.co.id']
  );
  assert.deepEqual(listed.map(h => h.domain), ['chitose-indonesia.com']);
});
