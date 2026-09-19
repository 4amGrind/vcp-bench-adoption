import type { BenchDTO, BenchStatus, PublicAdoption, Side, SideInfo, SideStatus, Style } from './types';
import { daysBetween } from './dates';

export interface Window {
  startDate: string;
  endDate: string;
}

/** Status is never stored. It is worked out from the dates every time, so an expired adoption opens up on its own. */
export function isCurrent(a: Window, today: string): boolean {
  return a.startDate <= today && today <= a.endDate; // ISO dates compare correctly as strings
}

export function overlaps(a: Window, b: Window): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function sidesFor(lengthFt: number): Side[] {
  return lengthFt === 8 ? ['A', 'B'] : ['A'];
}

export function sideStatusFor(a: Window | null, today: string, expiringSoonDays: number): SideStatus {
  if (!a) return 'available';
  return daysBetween(today, a.endDate) <= expiringSoonDays ? 'expiring' : 'adopted';
}

export function benchStatusFor(sides: { status: SideStatus }[]): BenchStatus {
  if (sides.some((s) => s.status === 'expiring')) return 'expiring';
  const taken = sides.filter((s) => s.status === 'adopted').length;
  if (taken === 0) return 'available';
  return taken < sides.length ? 'partial' : 'adopted';
}

export interface BenchRecord {
  id: string;
  name: string;
  description: string;
  area: string;
  style: Style;
  length_ft: number;
  lat: number;
  lng: number;
  image_url: string;
  is_placeholder: boolean;
}

export interface CurrentAdoptionRecord {
  id: number;
  bench_id: string;
  side: Side;
  adopter_name: string;
  plaque_text: string;
  is_anonymous: boolean;
  start_date: string;
  end_date: string;
}

export function buildBenchDto(
  bench: BenchRecord,
  current: CurrentAdoptionRecord[],
  today: string,
  expiringSoonDays: number,
): BenchDTO {
  const sides: SideInfo[] = sidesFor(bench.length_ft).map((side) => {
    const rec = current
      .filter((a) => a.side === side && isCurrent({ startDate: a.start_date, endDate: a.end_date }, today))
      .sort((x, y) => (x.end_date < y.end_date ? 1 : -1))[0];
    const adoption: PublicAdoption | null = rec
      ? {
          id: rec.id,
          side,
          displayName: rec.is_anonymous ? 'Anonymous donor' : rec.adopter_name,
          plaqueText: rec.plaque_text,
          startDate: rec.start_date,
          endDate: rec.end_date,
          daysLeft: daysBetween(today, rec.end_date),
        }
      : null;
    return {
      side,
      adoption,
      status: sideStatusFor(adoption && { startDate: adoption.startDate, endDate: adoption.endDate }, today, expiringSoonDays),
    };
  });

  return {
    id: bench.id,
    name: bench.name,
    description: bench.description,
    area: bench.area,
    style: bench.style,
    lengthFt: bench.length_ft === 4 ? 4 : 8,
    lat: bench.lat,
    lng: bench.lng,
    imageUrl: bench.image_url,
    isPlaceholder: bench.is_placeholder,
    status: benchStatusFor(sides),
    sides,
  };
}
