import { LIMITS } from './config';
import type { AdoptInput, Settings } from './types';

export type ValidationResult =
  | { ok: true; value: AdoptInput }
  | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks everything the server needs before it touches the database. The browser checks too, but never trust the browser. */
export function validateAdoption(raw: unknown, settings: Settings): ValidationResult {
  const errors: Record<string, string> = {};
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const side = body.side === 'A' || body.side === 'B' ? body.side : null;
  if (!side) errors.side = 'Choose side A or B.';

  const name = typeof body.adopterName === 'string' ? body.adopterName.trim() : '';
  if (name.length < 2) errors.adopterName = 'Enter your name (at least 2 characters).';
  else if (name.length > LIMITS.nameMax) errors.adopterName = `Keep your name under ${LIMITS.nameMax} characters.`;

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL.test(email) || email.length > LIMITS.emailMax) errors.email = 'Enter a valid email address.';

  const plaque = typeof body.plaqueText === 'string' ? body.plaqueText.replace(/\r\n/g, '\n').trim() : '';
  if (plaque.split('\n').length > LIMITS.plaqueMaxLines) errors.plaqueText = `Plaques hold up to ${LIMITS.plaqueMaxLines} lines.`;
  else if (plaque.length > LIMITS.plaqueMaxChars) errors.plaqueText = `Keep the plaque under ${LIMITS.plaqueMaxChars} characters.`;

  const term = typeof body.termMonths === 'number' ? body.termMonths : Number(body.termMonths);
  if (!Number.isInteger(term)) errors.termMonths = 'Choose how long to adopt for.';
  else if (term < settings.minTermMonths || term > settings.maxTermMonths) errors.termMonths = 'That length is not allowed.';

  if (Object.keys(errors).length > 0 || !side) return { ok: false, errors };

  return {
    ok: true,
    value: {
      side,
      adopterName: name,
      email,
      plaqueText: plaque,
      termMonths: term,
      anonymous: body.anonymous === true,
    },
  };
}

export function validateSettings(raw: unknown): { ok: true; value: Settings } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (k: string) => Number(b[k]);
  const s: Settings = {
    defaultTermMonths: n('defaultTermMonths'),
    minTermMonths: n('minTermMonths'),
    maxTermMonths: n('maxTermMonths'),
    expiringSoonDays: n('expiringSoonDays'),
  };
  for (const [key, v] of Object.entries(s)) {
    if (!Number.isInteger(v) || v < 1) return { ok: false, error: `${key} must be a whole number of 1 or more.` };
  }
  if (s.maxTermMonths > LIMITS.maxSettingMonths) return { ok: false, error: `The longest term cannot be over ${LIMITS.maxSettingMonths} months.` };
  if (s.minTermMonths > s.maxTermMonths) return { ok: false, error: 'The shortest term cannot be longer than the longest term.' };
  if (s.defaultTermMonths < s.minTermMonths || s.defaultTermMonths > s.maxTermMonths)
    return { ok: false, error: 'The default term must sit between the shortest and longest terms.' };
  if (s.expiringSoonDays > 365) return { ok: false, error: 'Expiring soon window cannot be over 365 days.' };
  return { ok: true, value: s };
}
