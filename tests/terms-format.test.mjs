import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTerms } from '../lib/terms-format.ts';

test('list formatting applies to whole lines when a word is selected', () => {
  assert.equal(formatTerms('Payment term: one month', 8, 12, 'bullet').value, '- Payment term: one month');
});
test('changing list type replaces existing markers', () => {
  const value = '- Payment\n- Delivery';
  assert.equal(formatTerms(value, 0, value.length, 'number').value, '1. Payment\n2. Delivery');
});
test('selection ending at a newline leaves the following line alone', () => {
  assert.equal(formatTerms('First\nSecond', 0, 6, 'bullet').value, '- First\nSecond');
});
test('inline formatting preserves surrounding text', () => {
  assert.equal(formatTerms('Payment term', 0, 7, 'bold').value, '**Payment** term');
});
