import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAdoption, validateSettings } from '../src/lib/validate';
import { DEFAULT_SETTINGS } from '../src/lib/config';

const good = { side: 'A', adopterName: 'Ada Lovelace', email: 'ada@example.com', plaqueText: 'For Ada', termMonths: 120, anonymous: false };

test('accepts a good adoption', () => {
  const r = validateAdoption(good, DEFAULT_SETTINGS);
  assert.equal(r.ok, true);
});

test('rejects bad fields with a message for each', () => {
  const r = validateAdoption({ side: 'C', adopterName: 'A', email: 'nope', plaqueText: 'x\n'.repeat(9), termMonths: 3 }, DEFAULT_SETTINGS);
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ['adopterName', 'email', 'plaqueText', 'side', 'termMonths']);
});

test('the allowed term follows the settings', () => {
  const wide = { ...DEFAULT_SETTINGS, maxTermMonths: 240 };
  assert.equal(validateAdoption({ ...good, termMonths: 180 }, DEFAULT_SETTINGS).ok, false);
  assert.equal(validateAdoption({ ...good, termMonths: 180 }, wide).ok, true);
});

test('settings validation', () => {
  assert.equal(validateSettings({ defaultTermMonths: 60, minTermMonths: 12, maxTermMonths: 120, expiringSoonDays: 30 }).ok, true);
  assert.equal(validateSettings({ defaultTermMonths: 200, minTermMonths: 12, maxTermMonths: 120, expiringSoonDays: 30 }).ok, false);
  assert.equal(validateSettings({ defaultTermMonths: 12.5, minTermMonths: 12, maxTermMonths: 120, expiringSoonDays: 30 }).ok, false);
});
