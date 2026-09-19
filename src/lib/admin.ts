import { adoptionsToCsv, benchesToCsv } from './csv';
import { bulkInsert, isOverlapViolation, type Queryable } from './db';
import { todayInNewYork } from './dates';
import { db, writeSeed } from './repo';
import { overlaps, sidesFor } from './status';
import type { AdoptionRow, BenchRow } from './types';

/** Thrown when an import has problems. Nothing is saved when this happens. */
export class ImportError extends Error {
  constructor(public details: string[]) {
    super(details[0] ?? 'Import failed.');
  }
}

export async function importBenches(rows: BenchRow[], removePlaceholders: boolean) {
  const d = await db();
  return d.tx(async (q) => {
    await q.query('select pg_advisory_xact_lock(872342)');

    let removed = 0;
    if (removePlaceholders) {
      const gone = await q.query<{ id: string }>('delete from benches where is_placeholder returning id');
      removed = gone.length;
    }

    const ids = rows.map((r) => r.id);
    const existing = await q.query<{ id: string }>('select id from benches where id = any($1::text[])', [ids]);
    const existingSet = new Set(existing.map((r) => r.id));

    await bulkInsert(
      q,
      'benches',
      ['id', 'name', 'description', 'area', 'style', 'length_ft', 'lat', 'lng', 'image_url', 'is_placeholder'],
      rows.map((r) => [r.id, r.name, r.description, r.area, r.style, r.lengthFt, r.lat, r.lng, r.imageUrl, false]),
      {
        suffix: `on conflict (id) do update set name = excluded.name, description = excluded.description, area = excluded.area,
                 style = excluded.style, length_ft = excluded.length_ft, lat = excluded.lat, lng = excluded.lng,
                 image_url = excluded.image_url, is_placeholder = false`,
      },
    );

    // A bench cannot shrink to 4 ft if someone holds its B side.
    const orphaned = await q.query<{ bench_id: string }>(
      `select distinct a.bench_id from adoptions a join benches b on b.id = a.bench_id where a.side = 'B' and b.length_ft = 4`,
    );
    if (orphaned.length > 0) {
      throw new ImportError([`These benches would become 4 ft, but side B is already adopted: ${orphaned.map((o) => o.bench_id).join(', ')}.`]);
    }

    await q.query("insert into settings (key, value) values ('seeded', 'true') on conflict (key) do nothing");
    return { inserted: rows.length - existingSet.size, updated: existingSet.size, removedPlaceholders: removed };
  });
}

export async function importAdoptions(rows: AdoptionRow[]) {
  const d = await db();
  try {
    return await d.tx(async (q) => {
      await q.query('select pg_advisory_xact_lock(872342)');

      const ids = [...new Set(rows.map((r) => r.benchId))];
      const benches = await q.query<{ id: string; length_ft: number }>('select id, length_ft from benches where id = any($1::text[]) for update', [ids]);
      const lengths = new Map(benches.map((b) => [b.id, b.length_ft]));

      const existing = await q.query<{ bench_id: string; side: string; start_date: string; end_date: string }>(
        `select bench_id, side, start_date::text as start_date, end_date::text as end_date from adoptions where bench_id = any($1::text[])`,
        [ids],
      );
      const held = new Map<string, { startDate: string; endDate: string }[]>();
      for (const e of existing) {
        const key = `${e.bench_id}|${e.side}`;
        held.set(key, [...(held.get(key) ?? []), { startDate: e.start_date, endDate: e.end_date }]);
      }

      const errors: string[] = [];
      rows.forEach((r, i) => {
        const line = i + 2;
        const len = lengths.get(r.benchId);
        if (len === undefined) return void errors.push(`Row ${line}: bench ${r.benchId} does not exist. Import the benches first.`);
        if (!sidesFor(len).includes(r.side)) return void errors.push(`Row ${line}: bench ${r.benchId} is 4 ft and has only side A.`);
        const key = `${r.benchId}|${r.side}`;
        const list = held.get(key) ?? [];
        const clash = list.find((w) => overlaps(w, r));
        if (clash) return void errors.push(`Row ${line}: side ${r.side} of ${r.benchId} already has an adoption from ${clash.startDate} to ${clash.endDate}.`);
        list.push({ startDate: r.startDate, endDate: r.endDate });
        held.set(key, list);
      });
      if (errors.length > 0) throw new ImportError(errors);

      await bulkInsert(
        q,
        'adoptions',
        ['bench_id', 'side', 'adopter_name', 'adopter_email', 'plaque_text', 'is_anonymous', 'start_date', 'end_date'],
        rows.map((r) => [r.benchId, r.side, r.adopterName, r.adopterEmail, r.plaqueText, r.isAnonymous, r.startDate, r.endDate]),
        { cast: { start_date: 'date', end_date: 'date' } },
      );
      return { inserted: rows.length };
    });
  } catch (err) {
    if (isOverlapViolation(err)) throw new ImportError(['Two adoptions in the file overlap on the same side of a bench.']);
    throw err;
  }
}

export async function exportCsv(type: 'benches' | 'adoptions'): Promise<string> {
  const d = await db();
  if (type === 'benches') {
    return benchesToCsv(await d.query('select id, name, description, area, style, length_ft, lat, lng, image_url from benches order by id'));
  }
  return adoptionsToCsv(
    await d.query(
      `select bench_id, side, adopter_name, adopter_email, plaque_text, is_anonymous, start_date::text as start_date, end_date::text as end_date
         from adoptions order by bench_id, side, start_date`,
    ),
  );
}

/** Wipes benches and adoptions and loads fresh placeholders. Settings are kept. */
export async function resetToPlaceholders(): Promise<void> {
  const d = await db();
  await d.tx(async (q: Queryable) => {
    await q.query('select pg_advisory_xact_lock(872341)');
    await q.query('delete from adoptions');
    await q.query('delete from benches');
    await q.query("delete from settings where key = 'seeded'");
    await writeSeed(q, todayInNewYork());
  });
}
