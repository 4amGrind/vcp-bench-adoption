import { PLACEHOLDER_BENCH_COUNT } from './config';
import { addDays, addMonths, endDateForTerm } from './dates';
import type { AdoptionRow, BenchRow, Side, Style } from './types';

// Placeholder data. Everything here is made up: the bench names, the people, the dates.
// The bench positions are rough guesses around real spots in the park. Import real data from the admin page to replace them.

interface Anchor {
  name: string;
  lat: number;
  lng: number;
}

const A = {
  entrance: { name: '242nd Street Entrance', lat: 40.889, lng: -73.8983 },
  house: { name: 'Van Cortlandt House', lat: 40.8959, lng: -73.8923 },
  parade: { name: 'Parade Ground', lat: 40.9008, lng: -73.8912 },
  center: { name: 'Central Woods', lat: 40.89778, lng: -73.88389 },
  north: { name: 'North Woods', lat: 40.9072, lng: -73.883 },
  east: { name: 'East Side', lat: 40.8925, lng: -73.8785 },
} satisfies Record<string, Anchor>;

// Clusters: benches bunched around a place. spread is in meters.
const CLUSTERS = [
  { anchor: A.house, spread: 110, weight: 9 },
  { anchor: A.parade, spread: 170, weight: 14 },
  { anchor: A.entrance, spread: 90, weight: 7 },
  { anchor: A.center, spread: 220, weight: 8 },
  { anchor: A.north, spread: 180, weight: 5 },
  { anchor: A.east, spread: 160, weight: 5 },
];

// Paths: benches spaced along a line between two anchors, like a trail.
const PATHS = [
  { from: A.entrance, to: A.house, weight: 10 },
  { from: A.house, to: A.parade, weight: 9 },
  { from: A.parade, to: A.center, weight: 9 },
  { from: A.center, to: A.north, weight: 6 },
  { from: A.center, to: A.east, weight: 7 },
];

const FIRST = ['Maria', 'James', 'Aisha', 'Daniel', 'Priya', 'Luis', 'Grace', 'Omar', 'Hannah', 'Kenji', 'Rosa', 'Tyrone', 'Elena', 'Marcus', 'Nadia', 'Sam', 'Isabel', 'Victor', 'Leah', 'Andre'];
const LAST = ['Alvarez', 'Chen', 'Okafor', 'Brennan', 'Patel', 'Rivera', 'Nguyen', 'Sullivan', 'Haddad', 'Moreau', 'Kowalski', 'Adeyemi', 'Fischer', 'Santos', 'Ito', 'Williams', 'Delgado', 'Murphy', 'Cohen', 'Baptiste'];

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

const M_PER_DEG_LAT = 111_320;

function offsetMeters(lat: number, lng: number, dNorth: number, dEast: number) {
  return {
    lat: lat + dNorth / M_PER_DEG_LAT,
    lng: lng + dEast / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
  };
}

export function generatePlaceholders(today: string, count = PLACEHOLDER_BENCH_COUNT, seed = 20260919) {
  const rand = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };

  const totalWeight = [...CLUSTERS, ...PATHS].reduce((s, x) => s + x.weight, 0);
  const benches: BenchRow[] = [];
  const counters = new Map<string, number>();

  for (let i = 0; i < count; i++) {
    let r = rand() * totalWeight;
    let area = '';
    let point = { lat: 0, lng: 0 };
    let placed = false;

    for (const c of CLUSTERS) {
      r -= c.weight;
      if (r <= 0) {
        area = c.anchor.name;
        point = offsetMeters(c.anchor.lat, c.anchor.lng, gauss() * c.spread, gauss() * c.spread);
        placed = true;
        break;
      }
    }
    if (!placed) {
      for (const p of PATHS) {
        r -= p.weight;
        if (r <= 0 || p === PATHS[PATHS.length - 1]) {
          const t = rand();
          area = 'Trails';
          point = offsetMeters(p.from.lat + (p.to.lat - p.from.lat) * t, p.from.lng + (p.to.lng - p.from.lng) * t, gauss() * 12, gauss() * 12);
          break;
        }
      }
    }

    const style: Style = rand() < 0.55 ? 'worlds_fair' : 'concrete_base';
    const lengthFt: 4 | 8 = rand() < 0.7 ? 8 : 4;
    const n = (counters.get(area) ?? 0) + 1;
    counters.set(area, n);
    const styleName = style === 'worlds_fair' ? "World's Fair style" : 'Concrete base';

    benches.push({
      id: `VCP-${String(i + 1).padStart(4, '0')}`,
      name: area === 'Trails' ? `Trail bench ${n}` : `${area} bench ${n}`,
      description: `${styleName} bench, ${lengthFt} ft. Placeholder entry for the ${area === 'Trails' ? 'park trails' : area}.`,
      area,
      style,
      lengthFt,
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
      imageUrl: '',
    });
  }

  // Adoptions. Three kinds: running now, ending soon, and already expired (the bench is available again).
  const adoptions: AdoptionRow[] = [];
  const pickTerm = () => {
    const r = rand();
    return r < 0.55 ? 120 : r < 0.8 ? 60 : r < 0.92 ? 24 : 12;
  };
  const plaqueFor = (first: string, last: string) =>
    pick([
      `In loving memory of\n${first} ${last}`,
      `${first} ${last}\nA favorite spot in the park`,
      `Given by the ${last} family\nfor everyone who needs a rest`,
      `For ${first}, who walked here every morning`,
      `Sit a while.\nThe ${last} family`,
    ]);

  for (const b of benches) {
    const sides: Side[] = b.lengthFt === 8 ? ['A', 'B'] : ['A'];
    sides.forEach((side, idx) => {
      if (rand() > (idx === 0 ? 0.42 : 0.26)) return; // most sides stay open
      const first = pick(FIRST);
      const last = pick(LAST);
      const base = {
        benchId: b.id,
        side,
        adopterName: `${first} ${last}`,
        adopterEmail: `${first}.${last}@example.com`.toLowerCase(),
        plaqueText: rand() < 0.85 ? plaqueFor(first, last) : '',
        isAnonymous: rand() < 0.06,
      };
      const term = pickTerm();
      const kind = rand();
      if (kind < 0.12) {
        // Ending soon: end date between 5 and 80 days from today.
        const end = addDays(today, int(5, 80));
        const start = addMonths(addDays(end, 1), -term);
        adoptions.push({ ...base, startDate: start, endDate: endDateForTerm(start, term) });
      } else if (kind < 0.82) {
        // Running now: pick a start so today falls inside the term.
        const days = Math.max(1, Math.floor(term * 30.4) - 100);
        const start = addDays(today, -int(1, days));
        adoptions.push({ ...base, startDate: start, endDate: endDateForTerm(start, term) });
      } else {
        // Expired: ended between 3 weeks and 5 years ago.
        const end = addDays(today, -int(21, 1800));
        const start = addMonths(addDays(end, 1), -term);
        adoptions.push({ ...base, startDate: start, endDate: endDateForTerm(start, term) });
      }
    });
  }

  return { benches, adoptions };
}
