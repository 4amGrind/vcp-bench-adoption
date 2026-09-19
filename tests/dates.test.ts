import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysBetween, endDateForTerm, isValidYmd, normalizeDate, todayInNewYork } from '../src/lib/dates';

test('a 10 year term ends the day before the anniversary', () => {
  assert.equal(endDateForTerm('2026-09-19', 120), '2036-09-18');
  assert.equal(endDateForTerm('2026-01-01', 12), '2026-12-31');
});

test('adding months snaps to the last day of short months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonths('2026-03-15', -3), '2025-12-15');
});

test('today uses New York time, not server time', () => {
  // 03:30 UTC on Sep 20 is 11:30 PM on Sep 19 in New York.
  assert.equal(todayInNewYork(new Date('2026-09-20T03:30:00Z')), '2026-09-19');
  assert.equal(todayInNewYork(new Date('2026-09-20T04:30:00Z')), '2026-09-20');
});

test('date checks', () => {
  assert.equal(isValidYmd('2026-02-30'), false);
  assert.equal(isValidYmd('2026-9-1'), false);
  assert.equal(normalizeDate('9/19/2026'), '2026-09-19');
  assert.equal(normalizeDate('13/40/2026'), null);
  assert.equal(daysBetween('2026-09-19', '2026-09-29'), 10);
});
