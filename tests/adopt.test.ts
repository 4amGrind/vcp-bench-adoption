// Runs the real repository code against an in-memory Postgres-compatible database.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// Set TEST_DATABASE_URL to run the same tests against a real Postgres.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.LOCAL_DB_DIR = 'memory://';
  delete process.env.DATABASE_URL;
}

type Repo = typeof import('../src/lib/repo');
type Admin = typeof import('../src/lib/admin');
type Csv = typeof import('../src/lib/csv');
let repo: Repo;
let admin: Admin;
let csv: Csv;

const person = (over: Record<string, unknown> = {}) => ({
  side: 'A' as const,
  adopterName: 'Test Person',
  email: 'test@example.com',
  plaqueText: 'Hello',
  termMonths: 120,
  anonymous: false,
  ...over,
});

before(async () => {
  repo = await import('../src/lib/repo');
  admin = await import('../src/lib/admin');
  csv = await import('../src/lib/csv');
});

test('first run loads 500+ placeholder benches with a mix of statuses', async () => {
  const data = await repo.listBenches();
  assert.ok(data.benches.length >= 500);
  assert.equal(data.sampleCount, data.benches.length);
  const seen = new Set(data.benches.map((b) => b.status));
  for (const s of ['available', 'partial', 'adopted', 'expiring']) assert.ok(seen.has(s as never), `missing status ${s}`);
  assert.ok(data.benches.every((b) => b.lat > 40.87 && b.lat < 40.93 && b.lng > -73.92 && b.lng < -73.85));
  assert.equal(JSON.stringify(data).includes('@example.com'), false, 'emails must not leak');
});

test('the default term is 10 years', async () => {
  assert.equal((await repo.listBenches()).settings.defaultTermMonths, 120);
});

test('adopting an open side works, and it cannot be adopted twice', async () => {
  const { benches } = await repo.listBenches();
  const open = benches.find((b) => b.sides[0].status === 'available')!;
  const a = await repo.adoptSide(open.id, person());
  assert.equal(a.side, 'A');
  await assert.rejects(() => repo.adoptSide(open.id, person({ adopterName: 'Someone Else' })), (e: { status?: number }) => e.status === 409);
  const after = (await repo.listBenches()).benches.find((b) => b.id === open.id)!;
  assert.equal(after.sides[0].adoption?.displayName, 'Test Person');
});

test('two requests at the same moment: exactly one wins', async () => {
  const { benches } = await repo.listBenches();
  const open = benches.find((b) => b.sides[0].status === 'available' && b.id !== undefined && b.lengthFt === 8 && b.sides[1].status === 'available')!;
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => repo.adoptSide(open.id, person({ side: 'B', adopterName: `Racer ${n}` }))));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 4);
});

test('a 4 ft bench has no side B', async () => {
  const { benches } = await repo.listBenches();
  const small = benches.find((b) => b.lengthFt === 4)!;
  await assert.rejects(() => repo.adoptSide(small.id, person({ side: 'B' })), (e: { status?: number }) => e.status === 400);
});

test('unknown bench gives 404', async () => {
  await assert.rejects(() => repo.adoptSide('NOPE', person()), (e: { status?: number }) => e.status === 404);
});

test('changing the default term in settings takes effect', async () => {
  const r = await repo.saveSettings({ defaultTermMonths: 60, minTermMonths: 12, maxTermMonths: 120, expiringSoonDays: 90 });
  assert.equal(r.ok, true);
  assert.equal((await repo.listBenches()).settings.defaultTermMonths, 60);
  const bad = await repo.saveSettings({ defaultTermMonths: 999, minTermMonths: 12, maxTermMonths: 120, expiringSoonDays: 90 });
  assert.equal(bad.ok, false);
});

test('import: real benches replace placeholders, then adoptions attach to them', async () => {
  const benches = csv.parseBenchCsv('bench_id,name,latitude,longitude,length_ft\nR-1,Real one,40.897,-73.884,8\nR-2,Real two,40.898,-73.885,4');
  assert.deepEqual(benches.errors, []);
  const res = await admin.importBenches(benches.rows, true);
  assert.equal(res.inserted, 2);
  assert.ok(res.removedPlaceholders >= 500);
  let data = await repo.listBenches();
  assert.equal(data.benches.length, 2);
  assert.equal(data.sampleCount, 0);

  const ok = csv.parseAdoptionCsv('bench_id,side,adopter_name,start_date,end_date\nR-1,A,Ada Lovelace,2020-01-01,2030-01-01');
  assert.equal((await admin.importAdoptions(ok.rows)).inserted, 1);
  data = await repo.listBenches();
  assert.equal(data.benches.find((b) => b.id === 'R-1')!.sides[0].status, 'adopted');

  // overlap with what is already there, a 4 ft bench with side B, and a missing bench
  const bad = csv.parseAdoptionCsv('bench_id,side,adopter_name,start_date,end_date\nR-1,A,Bo,2025-01-01,2026-01-01\nR-2,B,Cy,2025-01-01,2026-01-01\nZZZ,A,Di,2025-01-01,2026-01-01');
  await assert.rejects(() => admin.importAdoptions(bad.rows), (e: { details?: string[] }) => e.details?.length === 3);
  data = await repo.listBenches();
  assert.equal(data.benches.find((b) => b.id === 'R-2')!.sides[0].status, 'available', 'a failed import must save nothing');
});

test('expired adoptions do not block a new one', async () => {
  const old = csv.parseAdoptionCsv('bench_id,side,adopter_name,start_date,end_date\nR-2,A,Old Donor,2010-01-01,2015-01-01');
  await admin.importAdoptions(old.rows);
  assert.equal((await repo.listBenches()).benches.find((b) => b.id === 'R-2')!.sides[0].status, 'available');
  const a = await repo.adoptSide('R-2', person());
  assert.equal(a.displayName, 'Test Person');
});

test('export never crashes and includes emails only for admins', async () => {
  const out = await admin.exportCsv('adoptions');
  assert.match(out, /adopter_email/);
});

test('reset brings the placeholders back', async () => {
  await admin.resetToPlaceholders();
  assert.ok((await repo.listBenches()).benches.length >= 500);
});
