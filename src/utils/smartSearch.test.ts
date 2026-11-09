import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../data/mockData';
import { describeSegment, isDetailedRequest, parseSalesRequest, rankProducts, suggestProducts } from './smartSearch';

const CATS = Array.from(new Set(PRODUCTS.map(p => p.category)));
const top = (q: string, i = 0) => suggestProducts(PRODUCTS, q)[i]?.suggestions[0];

test('splits a multi-item request and reads qty, budget and specs', () => {
  const segs = parseSalesRequest('20 kursi ergonomis di bawah 2,5 juta dan 5 komputer core i7 16gb TKDN', CATS);
  assert.equal(segs.length, 2);
  assert.equal(segs[0]!.qty, 20);
  assert.equal(segs[0]!.maxPrice, 2_500_000);
  assert.ok(segs[0]!.terms.includes('ergonomis'));
  assert.equal(segs[1]!.qty, 5);
  assert.equal(segs[1]!.category, 'AIO');
  assert.equal(segs[1]!.cpu, 7);
  assert.equal(segs[1]!.ramGb, 16);
  assert.equal(segs[1]!.tkdn, true);
});

test('suggests an ergonomic chair within budget and the matching i7 AIO', () => {
  const [chairs, pcs] = suggestProducts(PRODUCTS, '20 kursi ergonomis di bawah 2,5 juta dan 5 komputer core i7 16gb TKDN');
  const chair = chairs!.suggestions[0]!;
  assert.ok(['prod-indachi-filmore-1', 'prod-indachi-vino-1'].includes(chair.product.id), chair.product.name);
  assert.ok(chair.product.basePrice <= 2_500_000);
  assert.equal(chair.qty, 20);
  assert.ok(chair.reasons.includes('Dalam budget'));

  const pc = pcs!.suggestions[0]!;
  assert.equal(pc.product.id, 'prod-lenovo-aio-thinkcentre-50a');
  assert.equal(pc.qty, 5);
  assert.equal(pc.confidence, 'high');
  assert.ok(pc.reasons.some(r => r.includes('i7')));
});

test('meeting table by number of people', () => {
  const s = top('meja rapat untuk 10 orang');
  assert.equal(s?.product.category, 'Meja Rapat');
  assert.ok(s!.reasons.some(r => r.includes('orang')));
});

test('category that is not in the catalog yields no suggestion (→ custom request)', () => {
  const [r] = suggestProducts(PRODUCTS, '3 laptop core i5');
  assert.equal(r!.segment.category, 'Laptop');
  assert.equal(r!.segment.categoryInCatalog, false);
  assert.equal(r!.suggestions.length, 0);
});

test('tolerates typos', () => {
  assert.equal(top('lenvo thinkcentre')?.product.id, 'prod-lenovo-aio-thinkcentre-50a');
  assert.equal(top('kursi filmor')?.product.name.startsWith('KURSI INDACHI FILMORE'), true);
});

test('total budget is divided by quantity; dozens are understood', () => {
  const [a] = parseSalesRequest('budget total 50 juta untuk 20 kursi kantor', CATS);
  assert.equal(a!.qty, 20);
  assert.equal(a!.maxPrice, 2_500_000);
  const [b] = parseSalesRequest('selusin kursi kantor', CATS);
  assert.equal(b!.qty, 12);
  assert.equal(b!.category, 'Kursi Kantor');
});

test('lkpp + qty on filing cabinets', () => {
  const s = top('4 unit lemari arsip besi e-katalog');
  assert.equal(s?.product.category, 'Lemari Arsip');
  assert.equal(s?.qty, 4);
  assert.ok(s!.reasons.includes('e-Katalog LKPP'));
});

test('detail fragments merge into the item before them', () => {
  const segs = parseSalesRequest('kursi kantor ergonomis, warna hitam, 15 unit', CATS);
  assert.equal(segs.length, 1);
  assert.equal(segs[0]!.qty, 15);
  assert.ok(segs[0]!.terms.includes('hitam'));
});

test('a single keyword is not a "detailed request"; list ranking still works', () => {
  assert.equal(isDetailedRequest(parseSalesRequest('aio', CATS)), false);
  assert.equal(isDetailedRequest(parseSalesRequest('5 aio i7', CATS)), true);
  const ranked = rankProducts(PRODUCTS, 'aio');
  assert.ok(ranked.length >= 4 && ranked.every(p => p.category === 'AIO'));
  assert.deepEqual(describeSegment(parseSalesRequest('5 aio i7 di bawah 10 juta', CATS)[0]!), ['5 unit', 'AIO', 'Core i7', 'maks Rp 10.000.000']);
});
