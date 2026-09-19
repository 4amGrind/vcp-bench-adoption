import { addDays, formatLong } from '@/lib/dates';
import type { BenchDTO, BenchStatus, Settings, Style } from '@/lib/types';

export const STATUS_ORDER: BenchStatus[] = ['available', 'partial', 'adopted', 'expiring'];

export const STATUS_LABEL: Record<BenchStatus, string> = {
  available: 'Available',
  partial: 'Partly adopted',
  adopted: 'Adopted',
  expiring: 'Expiring soon',
};

export const STYLE_LABEL: Record<Style, string> = {
  worlds_fair: "World's Fair style",
  concrete_base: 'Concrete base',
};

/** The term choices in the adopt form. They always follow the admin settings. */
export function termOptions(s: Settings): number[] {
  const all = [12, 24, 36, 60, 120, s.defaultTermMonths, s.minTermMonths, s.maxTermMonths];
  return [...new Set(all)].filter((m) => m >= s.minTermMonths && m <= s.maxTermMonths).sort((a, b) => a - b);
}

/** One short line for the results list. */
export function summaryFor(b: BenchDTO): string {
  const open = b.sides.filter((s) => s.status === 'available').length;
  const ends = b.sides.flatMap((s) => (s.adoption ? [s.adoption.endDate] : [])).sort();
  switch (b.status) {
    case 'available':
      return b.sides.length === 2 ? 'Both sides open' : 'Open to adopt';
    case 'partial':
      return `${open} side open`;
    case 'adopted':
      return `Adopted through ${formatLong(ends[ends.length - 1])}`;
    case 'expiring': {
      const soon = b.sides.filter((s) => s.status === 'expiring').flatMap((s) => (s.adoption ? [s.adoption.endDate] : [])).sort();
      return `Opens ${formatLong(addDays(soon[0], 1))}`;
    }
  }
}
