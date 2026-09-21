import { DEFAULT_SETTINGS } from './config';
import { bulkInsert, getRawDb, isOverlapViolation, type Db, type Queryable } from './db';
import { daysBetween, endDateForTerm, formatLong, todayInNewYork } from './dates';
import { generatePlaceholders } from './seed';
import { buildBenchDto, sidesFor, type BenchRecord, type CurrentAdoptionRecord } from './status';
import type { AdoptInput, BenchesResponse, PublicAdoption, Settings } from './types';
import { validateSettings } from './validate';

export class AdoptError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: 'not_found' | 'bad_side' | 'taken',
  ) {
    super(message);
  }
}

// ---------- start up: make sure there is something to show ----------

export async function writeSeed(q: Queryable, today: string): Promise<void> {
  const { benches, adoptions } = generatePlaceholders(today);
  await bulkInsert(
    q,
    'benches',
    ['id', 'name', 'description', 'area', 'style', 'length_ft', 'lat', 'lng', 'image_url', 'is_placeholder'],
    benches.map((b) => [b.id, b.name, b.description, b.area, b.style, b.lengthFt, b.lat, b.lng, b.imageUrl, true]),
  );
  await bulkInsert(
    q,
    'adoptions',
    ['bench_id', 'side', 'adopter_name', 'adopter_email', 'plaque_text', 'is_anonymous', 'start_date', 'end_date'],
    adoptions.map((a) => [a.benchId, a.side, a.adopterName, a.adopterEmail, a.plaqueText, a.isAnonymous, a.startDate, a.endDate]),
    { cast: { start_date: 'date', end_date: 'date' } },
  );
  await q.query("insert into settings (key, value) values ('seeded', 'true') on conflict (key) do nothing");
}

async function seedIfNeeded(q: Queryable): Promise<void> {
  await q.query('select pg_advisory_xact_lock(872341)'); // only one server instance seeds
  const done = await q.query("select 1 from settings where key = 'seeded'");
  if (done.length > 0) return;
  const [{ n }] = await q.query<{ n: number }>('select count(*)::int as n from benches');
  if (n > 0) {
    // Someone already loaded real data. Never add placeholders on top of it.
    await q.query("insert into settings (key, value) values ('seeded', 'true') on conflict (key) do nothing");
    return;
  }
  await writeSeed(q, todayInNewYork());
}

const g = globalThis as unknown as { __vcpReady?: Promise<Db> };

/** The database, with tables created and placeholder data loaded on first use. */
export function db(): Promise<Db> {
  if (!g.__vcpReady) {
    g.__vcpReady = (async () => {
      const d = await getRawDb();
      await d.tx(seedIfNeeded);
      return d;
    })().catch((err) => {
      g.__vcpReady = undefined;
      throw err;
    });
  }
  return g.__vcpReady;
}

// ---------- settings ----------

export async function getSettings(q?: Queryable): Promise<Settings> {
  const runner = q ?? (await db());
  const rows = await runner.query<{ key: string; value: string }>('select key, value from settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: string, fallback: number) => {
    const n = Number(map.get(key));
    return map.has(key) && Number.isFinite(n) ? n : fallback;
  };
  return {
    defaultTermMonths: num('default_term_months', DEFAULT_SETTINGS.defaultTermMonths),
    minTermMonths: num('min_term_months', DEFAULT_SETTINGS.minTermMonths),
    maxTermMonths: num('max_term_months', DEFAULT_SETTINGS.maxTermMonths),
    expiringSoonDays: num('expiring_soon_days', DEFAULT_SETTINGS.expiringSoonDays),
  };
}

export async function saveSettings(input: unknown): Promise<{ ok: true; settings: Settings } | { ok: false; error: string }> {
  const v = validateSettings(input);
  if (!v.ok) return v;
  const d = await db();
  await d.tx(async (q) => {
    const entries: [string, number][] = [
      ['default_term_months', v.value.defaultTermMonths],
      ['min_term_months', v.value.minTermMonths],
      ['max_term_months', v.value.maxTermMonths],
      ['expiring_soon_days', v.value.expiringSoonDays],
    ];
    for (const [key, value] of entries) {
      await q.query('insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value', [key, String(value)]);
    }
  });
  return { ok: true, settings: v.value };
}

// ---------- reading benches ----------

export async function listBenches(): Promise<BenchesResponse> {
  const d = await db();
  const today = todayInNewYork();
  const settings = await getSettings(d);
  const [benches, adoptions] = await Promise.all([
    d.query<BenchRecord>('select id, name, description, area, style, length_ft, lat, lng, image_url, is_placeholder from benches order by id'),
    d.query<CurrentAdoptionRecord>(
      `select id, bench_id, side, adopter_name, plaque_text, is_anonymous, start_date::text as start_date, end_date::text as end_date
         from adoptions where start_date <= $1::date and end_date >= $1::date`,
      [today],
    ),
  ]);

  const byBench = new Map<string, CurrentAdoptionRecord[]>();
  for (const a of adoptions) {
    const list = byBench.get(a.bench_id) ?? [];
    list.push(a);
    byBench.set(a.bench_id, list);
  }

  const dtos = benches.map((b) => buildBenchDto(b, byBench.get(b.id) ?? [], today, settings.expiringSoonDays));
  // Sort by name with numbers in natural order, so "Bench 2" comes before "Bench 10".
  const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  dtos.sort((a, b) => byName.compare(a.name, b.name) || byName.compare(a.id, b.id));
  return { benches: dtos, settings, today, sampleCount: dtos.filter((b) => b.isPlaceholder).length };
}

// ---------- adopting ----------

/**
 * The one rule that matters: two people cannot hold the same side of a bench at the same time.
 * We enforce it in the database, not in the browser:
 *   1. Lock the bench row so two requests for the same bench take turns.
 *   2. Look for an overlapping adoption on that side. If there is one, refuse.
 *   3. Insert.
 * On real Postgres there is also an exclusion constraint on the table as a backstop.
 */
export async function adoptSide(benchId: string, input: AdoptInput): Promise<PublicAdoption> {
  const d = await db();
  const startDate = todayInNewYork();
  const endDate = endDateForTerm(startDate, input.termMonths);

  try {
    return await d.tx(async (q) => {
      const benchRows = await q.query<{ id: string; length_ft: number }>('select id, length_ft from benches where id = $1 for update', [benchId]);
      if (benchRows.length === 0) throw new AdoptError(404, 'That bench does not exist.', 'not_found');
      if (!sidesFor(benchRows[0].length_ft).includes(input.side)) {
        throw new AdoptError(400, 'This bench is 4 ft and has only side A.', 'bad_side');
      }

      const clash = await q.query<{ start_date: string; end_date: string }>(
        `select start_date::text as start_date, end_date::text as end_date
           from adoptions
          where bench_id = $1 and side = $2 and start_date <= $4::date and end_date >= $3::date
          order by end_date desc limit 1`,
        [benchId, input.side, startDate, endDate],
      );
      if (clash.length > 0) {
        const c = clash[0];
        const msg =
          c.start_date > startDate
            ? `Side ${input.side} is reserved starting ${formatLong(c.start_date)}, so a ${input.termMonths}-month adoption would overlap it.`
            : `Side ${input.side} is already adopted through ${formatLong(c.end_date)}.`;
        throw new AdoptError(409, msg, 'taken');
      }

      const [row] = await q.query<{ id: number }>(
        `insert into adoptions (bench_id, side, adopter_name, adopter_email, plaque_text, is_anonymous, start_date, end_date)
         values ($1, $2, $3, $4, $5, $6, $7::date, $8::date) returning id`,
        [benchId, input.side, input.adopterName, input.email, input.plaqueText, input.anonymous, startDate, endDate],
      );

      return {
        id: row.id,
        side: input.side,
        displayName: input.anonymous ? 'Anonymous donor' : input.adopterName,
        plaqueText: input.plaqueText,
        startDate,
        endDate,
        daysLeft: daysBetween(startDate, endDate),
      };
    });
  } catch (err) {
    if (isOverlapViolation(err)) throw new AdoptError(409, `Side ${input.side} was just adopted by someone else.`, 'taken');
    throw err;
  }
}
