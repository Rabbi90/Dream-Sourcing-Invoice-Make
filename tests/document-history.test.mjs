import assert from 'node:assert/strict';
import test from 'node:test';
import { bangladeshDate, formatBangladeshTime, paginateHistory, documentFilename } from '../lib/document-history.ts';

test('history and new document dates use Bangladesh time across midnight', () => {
  const instant = new Date('2026-10-27T18:30:00Z');
  assert.equal(bangladeshDate(instant), '2026-10-28');
  assert.match(formatBangladeshTime(instant), /28 Oct 2026/);
  assert.match(formatBangladeshTime(instant), /12:30:00 am.*UTC\+6/i);
});
test('history is newest first, paginated, bounded and does not mutate the index', () => {
  const entries = Array.from({ length: 23 }, (_, index) => ({ id: String(index), createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }));
  const first = paginateHistory(entries, 1);
  assert.equal(first.total, 23); assert.equal(first.totalPages, 3);
  assert.deepEqual(first.entries.map(entry => entry.id), ['22', '21', '20', '19', '18', '17', '16', '15', '14', '13']);
  assert.deepEqual(paginateHistory(entries, 3).entries.map(entry => entry.id), ['2', '1', '0']);
  assert.equal(paginateHistory(entries, 999).page, 3);
  for (const invalid of [0, -4, NaN, Infinity, 1.5]) assert.equal(paginateHistory(entries, invalid).page, 1);
  assert.equal(entries[0].id, '0');
  assert.deepEqual(paginateHistory([], 7), { entries: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
});
test('download filenames use the correct number and cannot inject paths or headers', () => {
  assert.equal(documentFilename({ docType: 'challan', billNo: 'Bill', challanNo: 'CHA/01' }), 'Dream-Sourcing-CHA-01.pdf');
  assert.equal(documentFilename({ docType: 'both', billNo: 'DS/01', challanNo: 'Other' }), 'Dream-Sourcing-DS-01.pdf');
  assert.doesNotMatch(documentFilename({ docType: 'bill', billNo: '../"\r\n', challanNo: '' }), /["\r\n/\\]/);
});
