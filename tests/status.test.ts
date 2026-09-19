import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchStatusFor, buildBenchDto, isCurrent, overlaps, sideStatusFor } from '../src/lib/status';

const TODAY = '2026-09-19';

test('side status comes from the end date', () => {
  assert.equal(sideStatusFor(null, TODAY, 90), 'available');
  assert.equal(sideStatusFor({ startDate: '2020-01-01', endDate: '2030-01-01' }, TODAY, 90), 'adopted');
  assert.equal(sideStatusFor({ startDate: '2020-01-01', endDate: '2026-11-01' }, TODAY, 90), 'expiring');
});

test('expired and future adoptions are not current', () => {
  assert.equal(isCurrent({ startDate: '2016-01-01', endDate: '2026-09-18' }, TODAY), false);
  assert.equal(isCurrent({ startDate: '2026-09-19', endDate: '2026-09-19' }, TODAY), true);
  assert.equal(isCurrent({ startDate: '2026-09-20', endDate: '2030-01-01' }, TODAY), false);
});

test('bench status rolls up its sides', () => {
  assert.equal(benchStatusFor([{ status: 'available' }, { status: 'available' }]), 'available');
  assert.equal(benchStatusFor([{ status: 'adopted' }, { status: 'available' }]), 'partial');
  assert.equal(benchStatusFor([{ status: 'adopted' }, { status: 'adopted' }]), 'adopted');
  assert.equal(benchStatusFor([{ status: 'adopted' }, { status: 'expiring' }]), 'expiring');
  assert.equal(benchStatusFor([{ status: 'adopted' }]), 'adopted');
});

test('overlap check treats end dates as inclusive', () => {
  assert.equal(overlaps({ startDate: '2026-01-01', endDate: '2026-06-30' }, { startDate: '2026-06-30', endDate: '2027-01-01' }), true);
  assert.equal(overlaps({ startDate: '2026-01-01', endDate: '2026-06-30' }, { startDate: '2026-07-01', endDate: '2027-01-01' }), false);
});

test('the public view hides the email and honours anonymous', () => {
  const dto = buildBenchDto(
    { id: 'B1', name: 'n', description: '', area: '', style: 'worlds_fair', length_ft: 8, lat: 1, lng: 2, image_url: '', is_placeholder: false },
    [{ id: 1, bench_id: 'B1', side: 'A', adopter_name: 'Real Name', plaque_text: 'hi', is_anonymous: true, start_date: '2026-01-01', end_date: '2030-01-01' }],
    TODAY,
    90,
  );
  assert.equal(dto.sides[0].adoption?.displayName, 'Anonymous donor');
  assert.equal(dto.sides[1].status, 'available');
  assert.equal(dto.status, 'partial');
  assert.equal(JSON.stringify(dto).includes('email'), false);
});
