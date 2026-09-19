// Downloads bench locations in Van Cortlandt Park from OpenStreetMap and writes benches-osm.csv,
// in the format the admin page imports.  Run it on your own computer:   npm run osm:csv
//
// Notes:
//  - OpenStreetMap does not record bench length or style, so every row is set to 8 ft and World's Fair style.
//    Fix those in the CSV if you know better.
//  - OpenStreetMap data is © OpenStreetMap contributors (ODbL). The map already credits them.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Keep in step with PARK.bounds in src/lib/config.ts
const BOX = { south: 40.875, west: -73.91, north: 40.92, east: -73.86 };
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export function buildQuery(box = BOX) {
  const b = `${box.south},${box.west},${box.north},${box.east}`;
  return `[out:json][timeout:60];(node["amenity"="bench"](${b});way["amenity"="bench"](${b}););out center tags;`;
}

function cell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function elementsToCsv(elements, box = BOX) {
  const header = ['bench_id', 'name', 'description', 'area', 'style', 'length_ft', 'latitude', 'longitude', 'image_url'];
  const rows = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (lat < box.south || lat > box.north || lng < box.west || lng > box.east) continue;
    rows.push([`OSM-${el.type}-${el.id}`, el.tags?.name ?? `Bench ${el.id}`, 'Mapped in OpenStreetMap', '', 'worlds_fair', 8, lat, lng, '']);
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

async function main() {
  console.log('Asking OpenStreetMap for benches...');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(buildQuery()),
  });
  if (!res.ok) throw new Error(`Overpass answered ${res.status}. Try again in a minute.`);
  const json = await res.json();
  const csv = elementsToCsv(json.elements ?? []);
  writeFileSync('benches-osm.csv', csv);
  console.log(`Wrote benches-osm.csv with ${csv.trim().split('\n').length - 1} benches. Import it on the admin page.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
