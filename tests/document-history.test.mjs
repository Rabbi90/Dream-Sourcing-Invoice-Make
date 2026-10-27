import assert from 'node:assert/strict';
import test from 'node:test';
import { bangladeshDate, formatBangladeshTime, paginateHistory, documentFilename, normalizeHistoryFilters, historyHref } from '../lib/document-history.ts';

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
  assert.deepEqual(paginateHistory([], 7), { entries: [], page: 1, pageSize: 10, total: 0, totalPages: 1, activeCount: 0, trashCount: 0, filters: normalizeHistoryFilters() });
});
const summary = (id, createdAt, extra = {}) => ({ id, createdAt, company: 'Acme', billNo: `Bill ${id}`, challanNo: `CHA ${id}`, templateName: 'Standard', docType: 'bill', total: Number(id) || 0, ...extra });
test('saved date range includes complete Bangladesh days, before pagination', () => {
  const rows = [
    summary('1', '2026-10-26T17:59:59.999Z'),
    summary('2', '2026-10-26T18:00:00.000Z'),
    summary('3', '2026-10-27T17:59:59.999Z'),
    summary('4', '2026-10-27T18:00:00.000Z'),
  ];
  const result = paginateHistory(rows, 1, 10, { from: '2026-10-27', to: '2026-10-27' });
  assert.deepEqual(result.entries.map(row => row.id), ['3', '2']);
  assert.equal(result.total, 2);
  assert.equal(paginateHistory(rows, 1, 10, { from: '2026-10-28' }).total, 1);
  assert.equal(paginateHistory(rows, 1, 10, { to: '2026-10-26' }).total, 1);
});
test('search, type and trash filters compose and pagination counts filtered rows', () => {
  const rows = Array.from({ length: 31 }, (_, i) => summary(String(i), '2026-10-27T00:00:00Z', { company: i % 2 ? 'Beta' : 'ACME Dhaka', docType: i === 2 ? 'challan' : 'bill', ...(i === 4 ? { deletedAt: '2026-10-28T00:00:00Z' } : {}) }));
  const result = paginateHistory(rows, 1, 10, { q: '  acme ', docType: 'bill' });
  assert.equal(result.total, 14); assert.equal(result.entries.length, 10); assert.equal(result.totalPages, 2);
  assert.equal(result.activeCount, 30); assert.equal(result.trashCount, 1);
  assert.ok(result.entries.every(row => !row.deletedAt && row.company.includes('ACME')));
  assert.equal(paginateHistory(rows, 1, 10, { view: 'trash', q: 'bill 4' }).entries[0].id, '4');
  assert.equal(paginateHistory(rows, 1, 25).entries.length, 25);
  assert.equal(paginateHistory(rows, 1, 50).entries.length, 30);
});
test('sorts all matching rows naturally and numerically, placing money-free challans last', () => {
  const rows = [summary('10', '2026-10-27T00:00:00Z', { company: 'Zebra', total: 20 }), summary('2', '2026-10-26T00:00:00Z', { company: 'apple', total: 100 }), summary('3', '2026-10-28T00:00:00Z', { company: 'Beta', docType: 'challan', total: 9999 })];
  const ids = sort => paginateHistory(rows, 1, 10, { sort }).entries.map(row => row.id);
  assert.deepEqual(ids('oldest'), ['2', '10', '3']);
  assert.deepEqual(ids('customer-asc'), ['2', '3', '10']);
  assert.deepEqual(ids('customer-desc'), ['10', '3', '2']);
  assert.deepEqual(ids('number-asc'), ['2', '10', '3']);
  assert.deepEqual(ids('number-desc'), ['3', '10', '2']);
  assert.deepEqual(ids('amount-asc'), ['10', '2', '3']);
  assert.deepEqual(ids('amount-desc'), ['2', '10', '3']);
  assert.equal(rows[0].id, '10');
});
test('filter URLs preserve dates, sorting and search safely across pagination', () => {
  const filters = normalizeHistoryFilters({ q: 'A&B <script>', from: '2026-10-01', to: '2026-10-27', sort: 'amount-desc', docType: 'both', pageSize: '25', view: 'trash' });
  const url = new URL(historyHref(filters, 3), 'https://invoice.example');
  assert.equal(url.searchParams.get('q'), 'A&B <script>'); assert.equal(url.searchParams.get('page'), '3');
  assert.deepEqual(normalizeHistoryFilters(Object.fromEntries(url.searchParams)), filters);
  assert.equal(historyHref(normalizeHistoryFilters()), '/history');
  const invalid = normalizeHistoryFilters({ sort: '__proto__', pageSize: 10000, from: '2026-02-30', to: 'not-a-date', view: '<script>', q: 'x'.repeat(500) });
  assert.equal(invalid.sort, 'newest'); assert.equal(invalid.pageSize, 10); assert.equal(invalid.from, ''); assert.equal(invalid.to, ''); assert.equal(invalid.view, 'active'); assert.equal(invalid.q.length, 200);
});
test('download filenames use the correct number and cannot inject paths or headers', () => {
  assert.equal(documentFilename({ docType: 'challan', billNo: 'Bill', challanNo: 'CHA/01' }), 'Dream-Sourcing-CHA-01.pdf');
  assert.equal(documentFilename({ docType: 'both', billNo: 'DS/01', challanNo: 'Other' }), 'Dream-Sourcing-DS-01.pdf');
  assert.doesNotMatch(documentFilename({ docType: 'bill', billNo: '../"\r\n', challanNo: '' }), /["\r\n/\\]/);
});
