import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeFromName, mapAirtableRecord, productFromAirtable } from './airtableCatalog';

const photo = {
  id: 'attPcOVx65B5IZeFt',
  type: 'image/png',
  url: 'https://v5.airtableusercontent.com/full',
  thumbnails: { large: { url: 'https://v5.airtableusercontent.com/large' } },
};

test('codeFromName takes the code in brackets at the end', () => {
  assert.equal(codeFromName('HighPoint Five Office Desk (BOD5052)'), 'BOD5052');
  assert.equal(codeFromName('HighPoint Partition Clamp White (BTDS02-00-00-12)'), 'BTDS02-00-00-12');
  assert.equal(codeFromName('Chairman 700 C'), '');
  assert.equal(codeFromName('Kursi (hitam) besar'), '');
});

test('mapAirtableRecord maps a full record', () => {
  const p = mapAirtableRecord({
    id: 'recAbCdEfGh123456',
    fields: {
      'Product Name': 'HighPoint  Five Office Desk (BOD5052)',
      Price: 3930000,
      Brand: 'HighPoint',
      Category: 'Desking / Office Desk',
      Specifications: 'Top 25mm\nKaki besi',
      Materials: 'Kayu / Metal',
      Dimensions: '120 x 70 x 75 cm',
      'Product Images': [photo],
    },
  })!;
  assert.equal(p.sourceId, 'airtable:recAbCdEfGh123456');
  assert.equal(p.name, 'HIGHPOINT FIVE OFFICE DESK (BOD5052)');
  assert.equal(p.sku, 'BOD5052');
  assert.equal(p.brand, 'HIGHPOINT');
  assert.equal(p.price, 3930000);
  assert.equal(p.specs, 'Top 25mm Kaki besi; Material: Kayu / Metal');
  assert.equal(p.dimensions, '120 x 70 x 75 cm');
  assert.equal(p.imageId, 'attPcOVx65B5IZeFt');
  assert.equal(p.image, 'https://v5.airtableusercontent.com/large');
});

test('mapAirtableRecord handles missing price, photo, code and placeholder dashes', () => {
  const p = mapAirtableRecord({ id: 'recZZZZZZZZ00001', fields: { 'Product Name': 'Chairman 700 C', Dimensions: '-', Materials: '-' } })!;
  assert.equal(p.price, 0);
  assert.equal(p.sku, 'AT-ZZZZZZZZ00001');
  assert.equal(p.dimensions, undefined);
  assert.equal(p.specs, '');
  assert.equal(p.image, '');
  assert.equal(p.category, 'Lainnya');
  assert.equal(mapAirtableRecord({ id: 'rec1', fields: {} }), null);
});

test('productFromAirtable keeps HPP and stock at zero and builds search keywords', () => {
  const prod = productFromAirtable(mapAirtableRecord({ id: 'recAbCdEfGh123456', fields: { 'Product Name': 'Chairman 700 C', Price: 3773000, Brand: 'Chairman', Category: 'Office Chair' } })!);
  assert.equal(prod.id, 'at-recAbCdEfGh123456');
  assert.equal(prod.basePrice, 3773000);
  assert.equal(prod.cogs, 0);
  assert.deepEqual(prod.keywords, ['chairman', 'office', 'chair']);
});
