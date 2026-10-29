import assert from 'node:assert/strict';
import test from 'node:test';
import { paginateRows, sortProducts } from '../lib/invoice-layout.ts';

test('A–Z dropdown ignores spaces, hidden characters and case and keeps the selected product intact', () => {
  const products = [
    {id: 1, name: '  Zebra', price: 500},
    {id: 2, name: '\u200Bbanana', price: 10},
    {id: 3, name: 'Apple', price: 90},
    {id: 4, name: '\u00a0Carrot', price: 5},
  ];
  const options = sortProducts(products, 'name-asc');
  assert.deepEqual(options.map(p => p.id), [3, 2, 4, 1]);
  assert.equal(options[1], products[1]);
  assert.equal(options[1].price, 10);
  // Reloading catalog data or changing the database's price sort cannot change A–Z.
  const reloaded = JSON.parse(JSON.stringify(products));
  assert.deepEqual(sortProducts(sortProducts(reloaded, 'price-desc'), 'name-asc').map(p => p.id), [3, 2, 4, 1]);
});

test('long invoices keep every row in order and reserve final totals', () => {
  const heights = Array.from({length: 75}, (_, index) => index % 3 === 0 ? 54 : 27);
  const pages = paginateRows(heights, 400, 87);
  assert.deepEqual(pages.flat(), heights.map((_, index) => index));
  for (const [index, page] of pages.entries()) {
    const height = page.reduce((sum, row) => sum + heights[row], 0);
    assert.ok(height + (index === pages.length - 1 ? 87 : 0) <= 400);
  }
});

test('totals move rows to a final page without splitting them', () => {
  assert.deepEqual(paginateRows([30, 30, 30], 100, 20), [[0, 1], [2]]);
  assert.deepEqual(paginateRows([100], 100, 20), [[0], []]);
  assert.deepEqual(paginateRows([40, 40], 100, 20), [[0, 1]]);
});

test('empty documents and challans paginate without extra pages', () => {
  assert.deepEqual(paginateRows([], 100, 20), [[]]);
  assert.deepEqual(paginateRows([50, 50], 100, 0), [[0, 1]]);
});

test('unprintably large content is reported rather than clipped', () => {
  assert.throws(() => paginateRows([101], 100, 20), /Item 1/);
  assert.throws(() => paginateRows([20], 100, 101), /totals/);
  assert.throws(() => paginateRows([20], 0, 0), /heading/);
});

test('catalog sorts numerically by price and naturally by name without changing stored order', () => {
  const products = [{name:'Item 10',price:100}, {name:'apple',price:2}, {name:'Item 2',price:10}];
  assert.deepEqual(sortProducts(products,'price-asc').map(p=>p.price),[2,10,100]);
  assert.deepEqual(sortProducts(products,'price-desc').map(p=>p.price),[100,10,2]);
  assert.deepEqual(sortProducts(products,'name-asc').map(p=>p.name),['apple','Item 2','Item 10']);
  assert.deepEqual(sortProducts(products,'name-desc').map(p=>p.name),['Item 10','Item 2','apple']);
  assert.deepEqual(sortProducts(products,'default'),products);
  assert.deepEqual(products.map(p=>p.price),[100,2,10]);
});


test('final terms and totals move to another page without losing rows', () => {
  const heights = [80, 80, 80, 80];
  const pages = paginateRows(heights, 400, 150);
  assert.deepEqual(pages.flat(), [0, 1, 2, 3]);
  pages.forEach((rows, index) => {
    const used = rows.reduce((sum, row) => sum + heights[row], 0);
    assert.ok(used + (index === pages.length - 1 ? 150 : 0) <= 400);
  });
  assert.throws(() => paginateRows(heights, 400, 450));
});
