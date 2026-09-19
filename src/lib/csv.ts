import Papa from 'papaparse';
import { LIMITS, PARK } from './config';
import { endDateForTerm, normalizeDate } from './dates';
import type { AdoptionRow, BenchRow, Side, Style } from './types';

// Reading CSV files that people make in Excel or Google Sheets, so we are forgiving:
// header names are not case sensitive, spaces work, and dates can be 9/19/2026 or 2026-09-19.

export interface ParseResult<T> {
  rows: T[];
  errors: string[];
}

type Raw = Record<string, string>;

function readTable(text: string): { rows: Raw[]; errors: string[] } {
  const parsed = Papa.parse<Raw>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'),
  });
  const errors = parsed.errors
    .filter((e) => e.type === 'Quotes')
    .map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  return { rows: parsed.data, errors };
}

function pick(row: Raw, names: string[]): string {
  for (const n of names) {
    const v = row[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

function parseStyle(raw: string): Style | null {
  if (raw === '') return 'worlds_fair';
  const s = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('world')) return 'worlds_fair';
  if (s.includes('concrete')) return 'concrete_base';
  return null;
}

function parseLength(raw: string): 4 | 8 | null {
  if (raw === '') return 8;
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return n === 4 || n === 8 ? n : null;
}

const TRUE_WORDS = new Set(['yes', 'y', 'true', '1', 'x']);

export function parseBenchCsv(text: string): ParseResult<BenchRow> {
  const { rows: raw, errors } = readTable(text);
  const rows: BenchRow[] = [];
  const seen = new Map<string, number>();
  const b = PARK.bounds;

  if (raw.length === 0) errors.push('The file has no data rows.');

  raw.forEach((r, i) => {
    const line = i + 2; // row 1 is the header
    const id = pick(r, ['bench_id', 'id']);
    const problems: string[] = [];
    if (!id) problems.push('bench_id is required');
    else if (id.length > 40) problems.push('bench_id is over 40 characters');
    else if (seen.has(id)) problems.push(`bench_id ${id} repeats row ${seen.get(id)}`);

    const lat = Number(pick(r, ['latitude', 'lat']));
    const lng = Number(pick(r, ['longitude', 'lng', 'lon', 'long']));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || pick(r, ['latitude', 'lat']) === '' || pick(r, ['longitude', 'lng', 'lon', 'long']) === '') {
      problems.push('latitude and longitude must be numbers');
    } else if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) {
      problems.push(`${lat}, ${lng} is outside the park area (are latitude and longitude swapped?)`);
    }

    const style = parseStyle(pick(r, ['style', 'type']));
    if (!style) problems.push('style must be "worlds_fair" or "concrete_base"');
    const lengthFt = parseLength(pick(r, ['length_ft', 'length', 'size']));
    if (!lengthFt) problems.push('length_ft must be 4 or 8');

    if (problems.length > 0 || !style || !lengthFt) {
      errors.push(`Row ${line}: ${problems.join('; ')}.`);
      return;
    }
    seen.set(id, line);
    rows.push({
      id,
      name: pick(r, ['name', 'bench_name']) || `Bench ${id}`,
      description: pick(r, ['description', 'notes']),
      area: pick(r, ['area', 'zone', 'section']),
      style,
      lengthFt,
      lat,
      lng,
      imageUrl: pick(r, ['image_url', 'image', 'photo', 'photo_url']),
    });
  });

  return { rows, errors };
}

export function parseAdoptionCsv(text: string): ParseResult<AdoptionRow> {
  const { rows: raw, errors } = readTable(text);
  const rows: AdoptionRow[] = [];
  if (raw.length === 0) errors.push('The file has no data rows.');

  raw.forEach((r, i) => {
    const line = i + 2;
    const problems: string[] = [];

    const benchId = pick(r, ['bench_id', 'bench', 'id']);
    if (!benchId) problems.push('bench_id is required');

    const sideRaw = pick(r, ['side']).toUpperCase() || 'A';
    const side: Side | null = sideRaw === 'A' || sideRaw === 'B' ? sideRaw : null;
    if (!side) problems.push('side must be A or B');

    const adopterName = pick(r, ['adopter_name', 'name', 'donor', 'adopter']);
    if (adopterName.length < 2) problems.push('adopter_name is required');
    else if (adopterName.length > LIMITS.nameMax) problems.push('adopter_name is too long');

    const plaqueText = pick(r, ['plaque_text', 'plaque']).replace(/\r\n/g, '\n');
    if (plaqueText.split('\n').length > LIMITS.plaqueMaxLines) problems.push(`plaque_text is over ${LIMITS.plaqueMaxLines} lines`);

    const startRaw = pick(r, ['start_date', 'start']);
    const startDate = startRaw ? normalizeDate(startRaw) : null;
    if (!startDate) problems.push('start_date must look like 2026-09-19 or 9/19/2026');

    let endDate: string | null = null;
    const endRaw = pick(r, ['end_date', 'end', 'expires']);
    const termMonths = Number(pick(r, ['term_months']) || (pick(r, ['term_years']) ? Number(pick(r, ['term_years'])) * 12 : ''));
    if (endRaw) {
      endDate = normalizeDate(endRaw);
      if (!endDate) problems.push('end_date must look like 2036-09-18 or 9/18/2036');
    } else if (startDate && Number.isInteger(termMonths) && termMonths > 0) {
      endDate = endDateForTerm(startDate, termMonths);
    } else {
      problems.push('give end_date, or term_months, or term_years');
    }
    if (startDate && endDate && endDate < startDate) problems.push('end_date is before start_date');

    if (problems.length > 0 || !side || !startDate || !endDate) {
      errors.push(`Row ${line}: ${problems.join('; ')}.`);
      return;
    }
    rows.push({
      benchId,
      side,
      adopterName,
      adopterEmail: pick(r, ['adopter_email', 'email']),
      plaqueText,
      isAnonymous: TRUE_WORDS.has(pick(r, ['anonymous', 'is_anonymous']).toLowerCase()),
      startDate,
      endDate,
    });
  });

  return { rows, errors };
}

// A spreadsheet program treats a cell that starts with = + - or @ as a formula. Defuse those in text fields we export.
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function benchesToCsv(
  rows: { id: string; name: string; description: string; area: string; style: string; length_ft: number; lat: number; lng: number; image_url: string }[],
): string {
  return Papa.unparse({
    fields: ['bench_id', 'name', 'description', 'area', 'style', 'length_ft', 'latitude', 'longitude', 'image_url'],
    data: rows.map((r) => [safeText(r.id), safeText(r.name), safeText(r.description), safeText(r.area), r.style, r.length_ft, r.lat, r.lng, safeText(r.image_url)]),
  });
}

export function adoptionsToCsv(
  rows: {
    bench_id: string;
    side: string;
    adopter_name: string;
    adopter_email: string;
    plaque_text: string;
    is_anonymous: boolean;
    start_date: string;
    end_date: string;
  }[],
): string {
  return Papa.unparse({
    fields: ['bench_id', 'side', 'adopter_name', 'adopter_email', 'plaque_text', 'anonymous', 'start_date', 'end_date'],
    data: rows.map((r) => [
      safeText(r.bench_id),
      r.side,
      safeText(r.adopter_name),
      safeText(r.adopter_email),
      safeText(r.plaque_text),
      r.is_anonymous ? 'yes' : 'no',
      r.start_date,
      r.end_date,
    ]),
  });
}
