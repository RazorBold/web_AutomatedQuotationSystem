import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanOffers, mapSerperShopping, marketLinks, marketStats, parseRupiah, priceForMargin, type MarketOffer } from './marketResearch';

test('parseRupiah reads the formats Google Shopping and stores use', () => {
  assert.equal(parseRupiah('Rp 3.450.000'), 3_450_000);
  assert.equal(parseRupiah('Rp3,450,000'), 3_450_000);
  assert.equal(parseRupiah('IDR 950.000,00'), 950_000);
  assert.equal(parseRupiah('Rp 1,2 jt'), 1_200_000);
  assert.equal(parseRupiah('Rp 850rb'), 850_000);
  assert.equal(parseRupiah(1250000), 1_250_000);
  assert.equal(parseRupiah('Hubungi penjual'), 0);
  assert.equal(parseRupiah(undefined), 0);
});

const offer = (price: number, store = 'Toko'): MarketOffer => ({ title: `Item ${price}`, store, price, priceText: '', url: `https://x.test/${price}` });

test('cleanOffers drops outliers and sorts by price; stats use the median', () => {
  const offers = [offer(3_600_000), offer(3_400_000), offer(45_000), offer(3_500_000), offer(90_000_000), offer(0)];
  const cleaned = cleanOffers(offers);
  assert.deepEqual(cleaned.map(o => o.price), [3_400_000, 3_500_000, 3_600_000, 0]);
  assert.deepEqual(marketStats(cleaned), { count: 3, min: 3_400_000, median: 3_500_000, max: 3_600_000 });
  assert.equal(marketStats([]), null);
});

test('maps a Serper.dev shopping result tolerantly', () => {
  const o = mapSerperShopping({
    title: 'Dry Cabinet Procore PC600S 600L',
    source: 'Tokopedia - Kamera Store',
    link: 'https://www.tokopedia.com/kamera/dry-cabinet',
    price: 'Rp 7.250.000',
    imageUrl: 'https://img.test/a.jpg',
    rating: 4.9,
    ratingCount: 120,
  });
  assert.equal(o?.price, 7_250_000);
  assert.equal(o?.store, 'Tokopedia - Kamera Store');
  assert.equal(o?.rating, 4.9);
  assert.equal(mapSerperShopping({ title: 'no link' }), null);
});

test('manual search links and suggested selling price', () => {
  const links = marketLinks('dry cabinet 600 liter');
  assert.ok(links.some(l => l.label === 'Tokopedia' && l.url.includes('dry%20cabinet%20600%20liter')));
  assert.equal(priceForMargin(7_250_000, 20), 9_063_000); // 7.25 jt / 0.8 = 9.0625 jt → rounded up to Rp 1.000
  assert.equal(priceForMargin(0, 20), 0);
});
