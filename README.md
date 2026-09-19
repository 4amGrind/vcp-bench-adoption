# Van Cortlandt Park Bench Adoption

A web app for the Van Cortlandt Park bench program. Visitors can:

- see every bench on a map and in a list,
- search and filter by status or area,
- see who adopted a bench, what the plaque says, and when the adoption ends,
- adopt an open bench side.

Staff can log in at `/admin` to change the default adoption length and to import their own benches and adoptions from a spreadsheet.

Built with Next.js (App Router), TypeScript, Postgres, and Leaflet with OpenStreetMap tiles.

> This is an unofficial demo made for a coding exercise. It is not connected to the Van Cortlandt Park Alliance or NYC Parks. No payment is taken.

## Run it on your computer

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. That is all. With no database configured, the app creates a local database in `.data/` and fills it with 540 placeholder benches on first run. Delete the `.data` folder to start over.

To use the admin page locally, set a password first:

```bash
ADMIN_PASSWORD=choose-something npm run dev
```

On Windows PowerShell: `$env:ADMIN_PASSWORD="choose-something"; npm run dev`

Run the tests with `npm test`.

## Put it online (Vercel plus a free Postgres)

The site needs a real Postgres database online, because Vercel's servers do not keep files between requests.

1. Push this folder to a GitHub repository.
2. Create a free Postgres database at [Neon](https://neon.tech) (or Supabase). Copy its connection string. It looks like `postgres://user:password@host/dbname?sslmode=require`.
3. On [Vercel](https://vercel.com), choose Add New, Project, and import the repository.
4. Before you press Deploy, add these environment variables:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the connection string from step 2 |
   | `ADMIN_PASSWORD` | a password for the admin page |
   | `ADMIN_SESSION_SECRET` | any long random text (optional) |

5. Deploy. The first visit creates the tables and loads the placeholder benches automatically.

If the site shows an error about `DATABASE_URL`, the variable is missing or misspelled. Fix it in Vercel's project settings and redeploy.

## Changing the default adoption length

The standard term is 10 years (120 months). To change it, open `/admin`, log in, and edit **Default length (months)**. The change applies right away to new adoptions. Adoptions that already exist keep their end dates.

The same form sets the shortest and longest length a donor may choose, and how many days before the end an adoption counts as "expiring soon".

The starting values for a brand new database live in `src/lib/config.ts` under `DEFAULT_SETTINGS`.

## Loading real data from a spreadsheet

Save your spreadsheet as CSV, open `/admin`, and upload it. Import benches first, then adoptions. Templates are on the admin page and in `public/templates/`.

**Benches** (`bench_id` and the two coordinates are required):

| Column | Notes |
| --- | --- |
| `bench_id` | Your own unique ID, for example `VCP-1001` |
| `name` | Optional. Defaults to "Bench" plus the ID |
| `description`, `area` | Optional. `area` fills the Area filter |
| `style` | `worlds_fair` or `concrete_base`. Blank means World's Fair |
| `length_ft` | `4` or `8`. Blank means 8. An 8 ft bench has sides A and B, a 4 ft bench has only A |
| `latitude`, `longitude` | Decimal degrees. Must fall inside the park area |
| `image_url` | Optional link to a photo. A drawing is shown when it is blank |

**Adoptions:**

| Column | Notes |
| --- | --- |
| `bench_id` | Must already exist |
| `side` | `A` or `B`. Blank means A |
| `adopter_name` | Shown publicly unless `anonymous` is yes |
| `adopter_email` | Kept private, never shown on the site |
| `plaque_text` | Up to 7 lines |
| `anonymous` | `yes` or `no` |
| `start_date` | `2026-09-19` or `9/19/2026` |
| `end_date` | Or use `term_months` or `term_years` instead |

Column names are not case sensitive, and a few common alternatives work (`lat`, `lng`, `email`, and so on). If any row has a problem, **nothing is imported** and you get a list of rows to fix. When you import benches, the placeholder benches are removed by default.

### Real bench positions from OpenStreetMap

Volunteers have mapped many of the park's benches on OpenStreetMap. To download them as a CSV in the right format:

```bash
npm run osm:csv
```

This writes `benches-osm.csv`, which you can import on the admin page. It needs an internet connection and is a starting point, since OpenStreetMap does not know each bench's length or style.

## How it is organized

```
src/lib/status.ts     The rules: which sides a bench has, and whether a side is available, adopted or expiring
src/lib/dates.ts      Date math on plain YYYY-MM-DD strings (term ends, month-end snapping, New York "today")
src/lib/validate.ts   Server-side checks for the adopt form and admin settings
src/lib/repo.ts       Database reads and the adopt transaction
src/lib/admin.ts      CSV import, export, and reset
src/lib/csv.ts        Reading and writing CSV
src/lib/seed.ts       The placeholder data generator
src/lib/db.ts         One interface over real Postgres and the local development database
src/app/api/          Route handlers (public bench list, adopt, and the admin endpoints)
src/components/       The map, list, detail panel, and adopt form
tests/                Unit tests, plus tests that run against a real database
```

## Assumptions and design decisions

**Sides.** An 8 ft bench has two plaque sides that are adopted separately. A 4 ft bench has one. This follows how the real program works.

**Adoption length.** The donor picks a length. The default is 10 years, and staff can change the default, the shortest length and the longest length from the admin page. An adoption that starts today for 10 years ends the day before the tenth anniversary.

**Status is worked out, never stored.** Each time the list loads, status is computed from the start and end dates. Nobody has to mark an adoption as expired: when the end date passes, the side shows as available again. An adoption is "expiring soon" when it ends within 90 days (adjustable).

**Bench colors.** A bench with no adopted side is green. One side adopted (8 ft benches only) is blue. All sides adopted is purple. Orange means at least one adoption ends soon, and it takes priority over the other colors so staff can spot renewals.

**Two people cannot hold the same side.** The server locks the bench, checks for an overlapping adoption, and only then saves. On Postgres the table also has an exclusion constraint, so the database itself refuses an overlap even if the app code had a bug. Both are covered by tests, including five requests arriving at the same moment.

**Placeholder data.** I could not find a public list of the park's bench locations, so the app ships with 540 generated benches. Their names, adopters, dates and plaque text are made up, and their positions are rough guesses around real parts of the park. The app labels this as "Sample data" in the header and on each bench. Staff replace it with real data through the CSV import, with no code changes.

**Privacy.** The adopter's email is collected so staff can reach them, and it is never sent to the public site. A test checks this. Donors can choose to appear as "Anonymous donor". The plaque text is still public, because a real plaque is.

**No payment.** The exercise did not ask for one, so the form says so and takes none.

**Dates use New York time.** "Today" is the date in New York, no matter where the server runs.

**Admin access** is one shared password from an environment variable, with a signed cookie that lasts 8 hours. That is enough for a demo. A real deployment would use individual staff accounts.

## Known limits

- With no payment or email confirmation, anyone can adopt any open bench. The adopt form has a hidden bot trap and a small per-connection limit, but the real fix is a confirmation step or payment.
- There is no way to cancel or edit a single adoption in the interface. **Reset to placeholder data** on the admin page clears everything after demo testing, and a real version needs a cancel action.
- The rate limit is in memory, so it resets when the server restarts and is not shared between server instances.
- Map tiles come from OpenStreetMap's public tile server, which is fine for a demo. A busy site should use a tile provider with an account.
- There is no photo upload. Photos can be linked from the `image_url` column.
