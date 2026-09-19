// Everything a park manager might want to tweak lives here or in the admin page.

export const PARK = {
  name: 'Van Cortlandt Park',
  center: { lat: 40.89778, lng: -73.88389 },
  // Rough box around the park. Used to catch swapped or mistyped coordinates in CSV imports.
  bounds: { south: 40.875, west: -73.91, north: 40.92, east: -73.86 },
  timeZone: 'America/New_York',
};

// First-run values for the settings. After that, the admin page changes them (stored in the database).
export const DEFAULT_SETTINGS = {
  defaultTermMonths: 120, // 10 years. This is the real VCPA term.
  minTermMonths: 12,
  maxTermMonths: 120,
  expiringSoonDays: 90,
};

export const LIMITS = {
  plaqueMaxLines: 7, // matches the real program
  plaqueMaxChars: 350,
  nameMax: 80,
  emailMax: 254,
  maxSettingMonths: 600,
};

export const PLACEHOLDER_BENCH_COUNT = 540;
