'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatTerm } from '@/lib/dates';
import type { Settings } from '@/lib/types';

type Phase = 'loading' | 'login' | 'disabled' | 'ready';
type Message = { kind: 'ok' | 'error'; text: string; details?: string[] } | null;

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<Message>(null);
  const [importMsg, setImportMsg] = useState<Message>(null);
  const [removePlaceholders, setRemovePlaceholders] = useState(true);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const { res, json } = await call('/api/admin/settings');
    if (res.status === 503) return setPhase('disabled');
    if (res.status === 401) return setPhase('login');
    if (res.ok) {
      setSettings(json.settings);
      setPhase('ready');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    const { res, json } = await call('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setPassword('');
      check();
    } else setLoginError(json.error ?? 'Could not log in.');
  }

  async function logout() {
    await call('/api/admin/logout', { method: 'POST' });
    setPhase('login');
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSettingsMsg(null);
    const { res, json } = await call('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSettings(json.settings);
      setSettingsMsg({ kind: 'ok', text: `Saved. New adoptions now default to ${formatTerm(json.settings.defaultTermMonths)}.` });
    } else setSettingsMsg({ kind: 'error', text: json.error ?? 'Could not save.' });
  }

  async function importFile(type: 'benches' | 'adoptions', file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setImportMsg(null);
    const csv = await file.text();
    const { res, json } = await call('/api/admin/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, csv, removePlaceholders }),
    });
    setBusy(false);
    if (res.ok) {
      const r = json.result;
      setImportMsg({
        kind: 'ok',
        text:
          type === 'benches'
            ? `Imported ${r.inserted} new and ${r.updated} updated benches.${r.removedPlaceholders ? ` Removed ${r.removedPlaceholders} placeholder benches.` : ''}`
            : `Imported ${r.inserted} adoptions.`,
      });
    } else setImportMsg({ kind: 'error', text: json.error ?? 'Import failed.', details: json.details });
  }

  async function reset() {
    if (!window.confirm('This deletes every bench and adoption and loads fresh placeholder data. Continue?')) return;
    setBusy(true);
    const { res, json } = await call('/api/admin/reseed', { method: 'POST' });
    setBusy(false);
    setImportMsg(res.ok ? { kind: 'ok', text: 'Placeholder data restored.' } : { kind: 'error', text: json.error ?? 'Could not reset.' });
  }

  const num = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setSettings((s) => (s ? { ...s, [key]: Number(e.target.value) } : s));

  return (
    <div className="admin">
      <header className="topbar">
        <div>
          <h1>Bench program admin</h1>
          <p>Change the defaults and load your own data.</p>
        </div>
        <div className="topbar__end">
          <Link href="/" className="topbar__link">
            Back to the map
          </Link>
          {phase === 'ready' && (
            <button type="button" className="topbar__link topbar__button" onClick={logout}>
              Log out
            </button>
          )}
        </div>
      </header>

      <main className="admin__main">
        {phase === 'loading' && <p>Loading</p>}

        {phase === 'disabled' && (
          <section className="card">
            <h2>Admin is turned off</h2>
            <p>Set the ADMIN_PASSWORD environment variable, restart the app, and reload this page.</p>
          </section>
        )}

        {phase === 'login' && (
          <form className="card" onSubmit={login}>
            <h2>Log in</h2>
            <label className="field">
              <span>Admin password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              {loginError && <em className="field__error">{loginError}</em>}
            </label>
            <button type="submit" className="btn">
              Log in
            </button>
          </form>
        )}

        {phase === 'ready' && settings && (
          <>
            <form className="card" onSubmit={saveSettings}>
              <h2>Adoption length</h2>
              <p className="fine">All lengths are in months. 120 months is 10 years, the standard term today.</p>
              <div className="grid">
                <label className="field">
                  <span>Default length (months)</span>
                  <input type="number" min={1} value={settings.defaultTermMonths} onChange={num('defaultTermMonths')} />
                  <small>{formatTerm(settings.defaultTermMonths)}. Pre-selected in the adopt form.</small>
                </label>
                <label className="field">
                  <span>Shortest allowed (months)</span>
                  <input type="number" min={1} value={settings.minTermMonths} onChange={num('minTermMonths')} />
                  <small>{formatTerm(settings.minTermMonths)}</small>
                </label>
                <label className="field">
                  <span>Longest allowed (months)</span>
                  <input type="number" min={1} value={settings.maxTermMonths} onChange={num('maxTermMonths')} />
                  <small>{formatTerm(settings.maxTermMonths)}</small>
                </label>
                <label className="field">
                  <span>&ldquo;Expiring soon&rdquo; window (days)</span>
                  <input type="number" min={1} value={settings.expiringSoonDays} onChange={num('expiringSoonDays')} />
                  <small>Adoptions ending within this many days turn orange.</small>
                </label>
              </div>
              {settingsMsg && (
                <p className={settingsMsg.kind === 'ok' ? 'ok' : 'alert'} role={settingsMsg.kind === 'ok' ? 'status' : 'alert'}>
                  {settingsMsg.text}
                </p>
              )}
              <button type="submit" className="btn">
                Save settings
              </button>
              <p className="fine">Changing the default does not change adoptions that already exist. Their end dates stay as they were.</p>
            </form>

            <section className="card">
              <h2>Import from a spreadsheet</h2>
              <p>
                Save your sheet as CSV. Import benches first, then adoptions. Start from a template:{' '}
                <a href="/templates/benches-template.csv" download>
                  benches
                </a>{' '}
                or{' '}
                <a href="/templates/adoptions-template.csv" download>
                  adoptions
                </a>
                . If any row has a problem, nothing is imported and you get a list of what to fix.
              </p>
              <label className="check">
                <input type="checkbox" checked={removePlaceholders} onChange={(e) => setRemovePlaceholders(e.target.checked)} />
                <span>Remove the placeholder benches when importing benches</span>
              </label>
              <div className="grid">
                <label className="field">
                  <span>Benches CSV</span>
                  <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => importFile('benches', e.target.files?.[0])} />
                </label>
                <label className="field">
                  <span>Adoptions CSV</span>
                  <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => importFile('adoptions', e.target.files?.[0])} />
                </label>
              </div>
              {importMsg && (
                <div className={importMsg.kind === 'ok' ? 'ok' : 'alert'} role={importMsg.kind === 'ok' ? 'status' : 'alert'}>
                  <p>{importMsg.text}</p>
                  {importMsg.details && (
                    <ul>
                      {importMsg.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="card">
              <h2>Download your data</h2>
              <p>
                <a href="/api/admin/export?type=benches">Benches CSV</a> and <a href="/api/admin/export?type=adoptions">Adoptions CSV</a> (includes emails, keep it private).
              </p>
            </section>

            <section className="card">
              <h2>Reset demo data</h2>
              <p>Deletes every bench and adoption and loads new placeholders. Useful after people have tried the adopt form.</p>
              <button type="button" className="btn btn-danger" onClick={reset} disabled={busy}>
                Reset to placeholder data
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
