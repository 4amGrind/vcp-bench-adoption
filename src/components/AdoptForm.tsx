'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { endDateForTerm, formatLong, formatTerm } from '@/lib/dates';
import { LIMITS } from '@/lib/config';
import type { BenchDTO, PublicAdoption, Settings, Side } from '@/lib/types';
import { Plaque } from './BenchDetail';
import { termOptions } from './ui';

interface Props {
  bench: BenchDTO;
  side: Side;
  settings: Settings;
  today: string;
  onSuccess: () => void; // called right after the adoption is saved, so the page can refresh behind the dialog
  onClose: () => void;
}

export default function AdoptForm({ bench, side, settings, today, onSuccess, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plaque, setPlaque] = useState('');
  const [term, setTerm] = useState(settings.defaultTermMonths);
  const [anonymous, setAnonymous] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot: real people leave it empty
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState<PublicAdoption | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const twoSides = bench.sides.length === 2;
  const options = useMemo(() => termOptions(settings), [settings]);
  const endDate = endDateForTerm(today, term);
  const plaqueLines = plaque.trim() === '' ? 0 : plaque.replace(/\r\n/g, '\n').trim().split('\n').length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setFormError('');
    try {
      const res = await fetch(`/api/benches/${encodeURIComponent(bench.id)}/adopt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, adopterName: name, email, plaqueText: plaque, termMonths: term, anonymous, website }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setDone(json.adoption);
        onSuccess();
        return;
      }
      if (res.status === 422 && json.fieldErrors) setFieldErrors(json.fieldErrors);
      setFormError(json.error ?? 'Could not save your adoption. Try again.');
      if (res.status === 409) onSuccess(); // someone else got there first: refresh so the screen shows the truth
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = twoSides ? `Adopt side ${side} of ${bench.name}` : `Adopt ${bench.name}`;

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="adopt-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close(); // click on the dimmed backdrop
      }}
    >
      {done ? (
        <div className="dialog__body">
          <h2 id="adopt-title">Adopted</h2>
          <p>
            {twoSides ? `Side ${side}` : 'This bench'} of {bench.name} is yours through <strong>{formatLong(done.endDate)}</strong>. Here is how the plaque text will read:
          </p>
          <Plaque text={done.plaqueText} fallback={`Adopted by ${done.displayName}`} />
          <p className="fine">Demo only: no payment was taken and no email was sent.</p>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => dialog.current?.close()}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className="dialog__body" onSubmit={submit} noValidate>
          <h2 id="adopt-title">{title}</h2>
          <p className="fine">Fields marked with a star are required.</p>

          {formError && (
            <p className="alert" role="alert">
              {formError}
            </p>
          )}

          <label className="field">
            <span>Your name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={LIMITS.nameMax} aria-invalid={!!fieldErrors.adopterName} required />
            {fieldErrors.adopterName && <em className="field__error">{fieldErrors.adopterName}</em>}
          </label>

          <label className="field">
            <span>Email *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!fieldErrors.email} required />
            <small>We use this to contact you. It is never shown on the site.</small>
            {fieldErrors.email && <em className="field__error">{fieldErrors.email}</em>}
          </label>

          <label className="field">
            <span>How long?</span>
            <select value={term} onChange={(e) => setTerm(Number(e.target.value))} aria-invalid={!!fieldErrors.termMonths}>
              {options.map((m) => (
                <option key={m} value={m}>
                  {formatTerm(m)}
                  {m === settings.defaultTermMonths ? ' (standard)' : ''}
                </option>
              ))}
            </select>
            <small>Your adoption would run through {formatLong(endDate)}.</small>
            {fieldErrors.termMonths && <em className="field__error">{fieldErrors.termMonths}</em>}
          </label>

          <label className="field">
            <span>Plaque text</span>
            <textarea rows={3} value={plaque} onChange={(e) => setPlaque(e.target.value)} aria-invalid={!!fieldErrors.plaqueText} placeholder={'In loving memory of\nAda Lovelace'} />
            <small>
              {plaqueLines} of {LIMITS.plaqueMaxLines} lines. Leave it blank to show your name.
            </small>
            {fieldErrors.plaqueText && <em className="field__error">{fieldErrors.plaqueText}</em>}
          </label>

          <label className="check">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>Show me as &ldquo;Anonymous donor&rdquo; in the public list. The plaque text still shows.</span>
          </label>

          {/* Honeypot. Hidden from people, tempting to bots. */}
          <div className="hp" aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <p className="fine">Demo only: no payment is taken.</p>

          <div className="dialog__actions">
            <button type="button" className="btn btn-quiet" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Saving' : twoSides ? `Adopt side ${side}` : 'Adopt this bench'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
