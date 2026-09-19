// One tiny database interface with two engines behind it:
//  - Real Postgres when DATABASE_URL is set (production).
//  - A local Postgres-compatible database (PGlite) in .data/ when it is not (development and tests).
// Both speak the same SQL, so the rest of the app does not care which one it is.

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  kind: 'postgres' | 'pglite';
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

export class ConfigError extends Error {}

const SCHEMA = `
create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists benches (
  id text primary key,
  name text not null,
  description text not null default '',
  area text not null default '',
  style text not null default 'worlds_fair' check (style in ('worlds_fair', 'concrete_base')),
  length_ft integer not null default 8 check (length_ft in (4, 8)),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  image_url text not null default '',
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists adoptions (
  id serial primary key,
  bench_id text not null references benches (id) on delete cascade,
  side text not null check (side in ('A', 'B')),
  adopter_name text not null,
  adopter_email text not null default '',
  plaque_text text not null default '',
  is_anonymous boolean not null default false,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists adoptions_bench_idx on adoptions (bench_id, side);
create index if not exists adoptions_end_idx on adoptions (end_date);

-- Second line of defense: the database itself refuses overlapping adoptions on the same side of a bench.
do $$
begin
  create extension if not exists btree_gist;
  if not exists (select 1 from pg_constraint where conname = 'adoptions_no_overlap') then
    alter table adoptions add constraint adoptions_no_overlap
      exclude using gist (bench_id with =, side with =, daterange(start_date, end_date, '[]') with &&);
  end if;
exception when insufficient_privilege or feature_not_supported or undefined_file or duplicate_object or unique_violation then
  raise notice 'Skipping database level overlap constraint: %', sqlerrm;
end $$;
`;

async function createPostgres(url: string): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url, max: 5 });
  const db: Db = {
    kind: 'postgres',
    query: async <T,>(sql: string, params?: unknown[]) => (await pool.query(sql, params as unknown[])).rows as T[],
    exec: async (sql) => {
      await pool.query(sql);
    },
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn({
          query: async <T,>(sql: string, params?: unknown[]) => (await client.query(sql, params as unknown[])).rows as T[],
          exec: async (sql) => {
            await client.query(sql);
          },
        });
        await client.query('commit');
        return result;
      } catch (err) {
        try {
          await client.query('rollback');
        } catch {
          /* the original error matters more */
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
  return db;
}

async function createLocal(dir: string): Promise<Db> {
  const { mkdirSync } = await import('node:fs');
  if (!dir.startsWith('memory://')) mkdirSync(dir, { recursive: true }); // the library will not create parent folders itself
  const { PGlite } = await import('@electric-sql/pglite');
  const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');
  const pg = new PGlite(dir, { extensions: { btree_gist } });
  await pg.waitReady;
  return {
    kind: 'pglite',
    query: async <T,>(sql: string, params?: unknown[]) => (await pg.query<T>(sql, params)).rows,
    exec: async (sql) => {
      await pg.exec(sql);
    },
    tx: (fn) =>
      pg.transaction((t) =>
        fn({
          query: async <T,>(sql: string, params?: unknown[]) => (await t.query<T>(sql, params)).rows,
          exec: async (sql) => {
            await t.exec(sql);
          },
        }),
      ),
  };
}

const g = globalThis as unknown as { __vcpRawDb?: Promise<Db> };

/** One connection pool per server process. Creates tables on first use. */
export function getRawDb(): Promise<Db> {
  if (!g.__vcpRawDb) {
    g.__vcpRawDb = (async () => {
      const url = process.env.DATABASE_URL;
      let db: Db;
      if (url) {
        db = await createPostgres(url);
      } else if (process.env.NODE_ENV !== 'production') {
        db = await createLocal(process.env.LOCAL_DB_DIR ?? '.data/pglite');
      } else {
        throw new ConfigError('DATABASE_URL is not set. Add a Postgres connection string in your hosting settings.');
      }
      await db.tx(async (q) => {
        await q.query('select pg_advisory_xact_lock(872340)'); // two cold starts must not create tables at the same time
        await q.exec(SCHEMA);
      });
      return db;
    })().catch((err) => {
      g.__vcpRawDb = undefined; // let the next request try again
      throw err;
    });
  }
  return g.__vcpRawDb;
}

/** Inserts many rows with as few round trips as possible. Table and column names must be trusted constants. */
export async function bulkInsert(
  q: Queryable,
  table: string,
  columns: string[],
  rows: unknown[][],
  opts: { suffix?: string; cast?: Record<string, string> } = {},
  batchSize = 200,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const params: unknown[] = [];
    const tuples = chunk.map(
      (row) =>
        '(' +
        row
          .map((value, j) => {
            params.push(value);
            const cast = opts.cast?.[columns[j]];
            return `$${params.length}${cast ? '::' + cast : ''}`;
          })
          .join(',') +
        ')',
    );
    await q.query(`insert into ${table} (${columns.join(',')}) values ${tuples.join(',')} ${opts.suffix ?? ''}`, params);
  }
}

export function isOverlapViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23P01';
}
