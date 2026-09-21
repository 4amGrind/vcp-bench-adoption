// Makes sample adoptions for benches you imported, so the map shows every status color.
// Without this, freshly imported benches are all green, because nobody has adopted them.
// Everything this writes is made up: names, emails, plaque text, dates.
//
//   npx tsx scripts/sample-adoptions.ts                     (reads benches-osm.csv)
//   npx tsx scripts/sample-adoptions.ts my-benches.csv      (reads another file)
//
// Writes adoptions-sample.csv. Import it on the admin page AFTER the benches.
// It uses the app's own CSV and date code, so the file always matches what the importer expects.
import { readFileSync, writeFileSync } from 'node:fs';
import { adoptionsToCsv, parseBenchCsv } from '../src/lib/csv';
import { addDays, addMonths, endDateForTerm, todayInNewYork } from '../src/lib/dates';
import { sidesFor } from '../src/lib/status';

const input = process.argv[2] ?? 'benches-osm.csv';
const output = process.argv[3] ?? 'adoptions-sample.csv';

// Same random numbers every run, so the result is repeatable.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Maria', 'James', 'Aisha', 'Daniel', 'Priya', 'Luis', 'Grace', 'Omar', 'Hannah', 'Kenji', 'Rosa', 'Tyrone', 'Elena', 'Marcus', 'Nadia', 'Sam'];
const LAST = ['Alvarez', 'Chen', 'Okafor', 'Brennan', 'Patel', 'Rivera', 'Nguyen', 'Sullivan', 'Haddad', 'Moreau', 'Kowalski', 'Adeyemi', 'Santos', 'Ito'];

const parsed = parseBenchCsv(readFileSync(input, 'utf8'));
if (parsed.errors.length > 0) {
  console.error(`${input} has problems:\n${parsed.errors.slice(0, 10).join('\n')}`);
  process.exit(1);
}

const rand = mulberry32(20260920);
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const today = todayInNewYork();

const rows: Parameters<typeof adoptionsToCsv>[0] = [];
const counts = { current: 0, expiring: 0, expired: 0 };

for (const bench of parsed.rows) {
  let sideATaken = false;
  sidesFor(bench.lengthFt).forEach((side, idx) => {
    // Side A is taken on about half the benches. Side B is much more likely when A is taken,
    // the way a family often adopts both sides, so the map shows some fully adopted benches.
    const chance = idx === 0 ? 0.5 : sideATaken ? 0.6 : 0.15;
    if (rand() > chance) return;
    if (idx === 0) sideATaken = true;
    const first = pick(FIRST);
    const last = pick(LAST);
    const term = pick([120, 120, 120, 60, 60, 24]);
    const kind = rand();

    let startDate: string;
    if (kind < 0.14) {
      // Ends in the next 5 to 80 days, so it shows as "expiring soon".
      startDate = addMonths(addDays(addDays(today, int(5, 80)), 1), -term);
      counts.expiring++;
    } else if (kind < 0.82) {
      // Running now.
      startDate = addDays(today, -int(1, Math.max(1, Math.floor(term * 30.4) - 100)));
      counts.current++;
    } else {
      // Already over. The side shows as available again, which is the point.
      startDate = addMonths(addDays(addDays(today, -int(21, 1800)), 1), -term);
      counts.expired++;
    }

    rows.push({
      bench_id: bench.id,
      side,
      adopter_name: `${first} ${last}`,
      adopter_email: `${first}.${last}@example.com`.toLowerCase(),
      plaque_text: pick([`In loving memory of\n${first} ${last}`, `Sit a while.\nThe ${last} family`, `For ${first}, who walked here every morning`, '']),
      is_anonymous: rand() < 0.06,
      start_date: startDate,
      end_date: endDateForTerm(startDate, term),
    });
  });
}

writeFileSync(output, adoptionsToCsv(rows) + '\n');
console.log(
  `Wrote ${output}: ${rows.length} sample adoptions for ${parsed.rows.length} benches ` +
    `(${counts.current} running, ${counts.expiring} ending soon, ${counts.expired} already over).`,
);
