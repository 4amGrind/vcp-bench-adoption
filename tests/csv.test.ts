import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adoptionsToCsv, parseAdoptionCsv, parseBenchCsv } from '../src/lib/csv';

test('bench csv: reads friendly headers and defaults', () => {
  const r = parseBenchCsv('Bench ID,Name,Latitude,Longitude,Style,Length\nB-1,Oak Bench,40.897,-73.884,World\'s Fair,4 ft\nB-2,,40.898,-73.885,,');
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[0].style, 'worlds_fair');
  assert.equal(r.rows[0].lengthFt, 4);
  assert.equal(r.rows[1].name, 'Bench B-2');
  assert.equal(r.rows[1].lengthFt, 8);
});

test('bench csv: reports every bad row with its row number', () => {
  const r = parseBenchCsv('bench_id,latitude,longitude\nB-1,-73.884,40.897\nB-1,40.897,-73.884\n,40.897,-73.884\nB-4,abc,1');
  assert.equal(r.rows.length, 1);
  assert.equal(r.errors.length, 3);
  assert.match(r.errors[0], /Row 2.*swapped/);
  assert.match(r.errors[1], /Row 4/);
  assert.match(r.errors[2], /Row 5/);
});

test('adoption csv: spreadsheet dates and term columns', () => {
  const r = parseAdoptionCsv('bench_id,adopter_name,start_date,term_years,plaque_text\nB-1,Ada Lovelace,9/19/2026,10,"In memory of Ada\nof London"');
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[0].startDate, '2026-09-19');
  assert.equal(r.rows[0].endDate, '2036-09-18');
  assert.equal(r.rows[0].side, 'A');
  assert.equal(r.rows[0].plaqueText, 'In memory of Ada\nof London');
});

test('adoption csv: catches missing and backwards dates', () => {
  const r = parseAdoptionCsv('bench_id,adopter_name,start_date,end_date\nB-1,Ada,2026-05-01,2026-01-01\nB-2,Bo,,');
  assert.equal(r.rows.length, 0);
  assert.equal(r.errors.length, 2);
});

test('export defuses spreadsheet formulas', () => {
  const csv = adoptionsToCsv([{ bench_id: 'B-1', side: 'A', adopter_name: '=HYPERLINK("x")', adopter_email: 'a@b.co', plaque_text: '', is_anonymous: false, start_date: '2026-01-01', end_date: '2027-01-01' }]);
  assert.match(csv, /'=HYPERLINK/);
});
