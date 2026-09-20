# Van Cortlandt Park bench adoption

A Next.js app where visitors see park benches on a map and adopt an open bench side.
Staff use /admin to change the adoption term and to import real data from CSV.

## Commands

- `npm run dev` starts the app on port 3000. No database setup needed.
- `ADMIN_PASSWORD=something npm run dev` also turns on the /admin page.
- `npm test` runs 29 tests against a temporary in-memory database.
- `TEST_DATABASE_URL=postgres://... npm test` runs the same tests against a real Postgres.
- `npm run build` is the production build and the type check.
- `npm run osm:csv` downloads real bench locations from OpenStreetMap into benches-osm.csv.

Run `npm test` and `npm run build` before saying a change is finished.

## Layout

- `src/lib/` holds all rules and database work. No React in here.
- `src/app/api/` holds the route handlers. They stay thin: read request, call src/lib, return JSON.
- `src/components/` holds React only. No business rules.
- `tests/` holds the tests. `adopt.test.ts` runs real code against a real database.

## Rules that must not be broken

- **Status is never stored.** There is no status column. It is computed from start_date and
  end_date every time, in `src/lib/status.ts`. Do not add a stored status field.
- **Adoptions belong to a bench AND a side.** An 8 ft bench has sides A and B, a 4 ft bench has
  only A. See `sidesFor()` in `src/lib/status.ts`.
- **Two people cannot hold the same side at overlapping dates.** Enforced twice: a
  `select ... for update` row lock in `adoptSide()` in `src/lib/repo.ts`, and an
  `exclude using gist` constraint on the adoptions table in `src/lib/db.ts`. Keep both.
- **Adopter email never reaches the public API.** The `PublicAdoption` type in
  `src/lib/types.ts` has no email field. A test asserts no '@example.com' appears in the
  public payload. Do not add the field.
- **Imports are all or nothing.** `src/lib/admin.ts` validates every row inside a transaction
  and throws `ImportError` before any insert. No partial writes.
- **Dates are plain 'YYYY-MM-DD' strings.** All math lives in `src/lib/dates.ts`. Do not use
  JavaScript Date objects for stored values. "Today" means today in New York.
- **A term ends the day before the anniversary.** 10 years from 2026-09-19 ends 2036-09-18.

## Settings

The default term (120 months), the allowed range, and the expiring-soon window are stored in
the `settings` table and edited at /admin. `DEFAULT_SETTINGS` in `src/lib/config.ts` is only
the starting value for a brand new database. Do not read defaults directly from config at
request time.

## Database

`src/lib/db.ts` picks the engine. With `DATABASE_URL` set it uses real Postgres through `pg`.
Without it, in development, it uses PGlite in `.data/pglite`. Both run the same SQL. In
production without `DATABASE_URL` it throws `ConfigError` on purpose.

## Style

- Plain language in comments. Explain why, not what.
- Keep the dependency list small. Do not add a CSS framework, a state library, an ORM, or a
  test framework.
- Plain CSS in `src/app/globals.css`. Status colors are used for status and nothing else.
- Server code never trusts the browser. Validate again in `src/lib/validate.ts`.

## Known limits, on purpose

No payment, no email confirmation, no cancel action for a single adoption, in-memory rate
limit, single shared admin password. All listed in the README. Do not quietly "fix" these
without asking.
