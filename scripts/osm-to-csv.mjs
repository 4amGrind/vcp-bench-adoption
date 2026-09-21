// Downloads bench locations in Van Cortlandt Park from OpenStreetMap and writes benches-osm.csv,
// in the format the admin page imports.  Run it on your own computer:   npm run osm:csv
//
// Notes:
//  - OpenStreetMap does not record bench length or style, so every row is set to 8 ft and
//    World's Fair style. The description on each bench says so.
//  - OpenStreetMap data is © OpenStreetMap contributors (ODbL). The map already credits them.
//  - If the main server is busy, try another one:
//      OVERPASS_URL=https://overpass.kumi.systems/api/interpreter npm run osm:csv
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Keep in step with PARK.bounds in src/lib/config.ts
const BOX = { south: 40.875, west: -73.91, north: 40.92, east: -73.86 };
const ENDPOINT = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const DESCRIPTION = 'Location from OpenStreetMap. Length and style are not recorded there, so defaults are shown.';

export function buildQuery(box = BOX) {
  const b = `${box.south},${box.west},${box.north},${box.east}`;
  return `[out:json][timeout:60];(node["amenity"="bench"](${b});way["amenity"="bench"](${b}););out center tags;`;
}

function cell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function elementsToCsv(elements, box = BOX) {
  const benches = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (lat < box.south || lat > box.north || lng < box.west || lng > box.east) continue;
    benches.push({ id: `OSM-${el.type}-${el.id}`, name: el.tags?.name, lat, lng });
  }
  // North to south, so "Bench 1, Bench 2..." comes out the same every time you run it.
  benches.sort((a, b) => b.lat - a.lat || a.lng - b.lng);

  const header = ['bench_id', 'name', 'description', 'area', 'style', 'length_ft', 'latitude', 'longitude', 'image_url'];
  const rows = benches.map((b, i) => [b.id, b.name || `Bench ${i + 1}`, DESCRIPTION, '', 'worlds_fair', 8, b.lat, b.lng, '']);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

async function main() {
  console.log(`Asking OpenStreetMap for benches (${ENDPOINT})...`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'vcp-bench-adoption/1.0 (student project; https://github.com/4amGrind/vcp-bench-adoption)',
    },
    body: 'data=' + encodeURIComponent(buildQuery()),
  });
  if (!res.ok) {
    throw new Error(`The server answered ${res.status}. Wait a minute and try again, or use another server (see the note at the top of this file).`);
  }
  const json = await res.json();
  const csv = elementsToCsv(json.elements ?? []);
  const count = csv.trim().split('\n').length - 1;
  writeFileSync('benches-osm.csv', csv);
  console.log(`Wrote benches-osm.csv with ${count} benches.`);
  if (count === 0) console.log('No benches came back. Nothing to import. Keep the placeholders.');
  else console.log('Next: npx tsx scripts/sample-adoptions.ts   (makes sample adoptions for these benches)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
