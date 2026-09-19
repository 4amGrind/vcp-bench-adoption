'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BenchDTO, BenchesResponse, BenchStatus, Side } from '@/lib/types';
import AdoptForm from './AdoptForm';
import BenchDetail from './BenchDetail';
import BenchList from './BenchList';
import { STATUS_LABEL, STATUS_ORDER, STYLE_LABEL } from './ui';

// Leaflet touches `window`, so the map only loads in the browser.
const BenchMap = dynamic(() => import('./BenchMap'), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map</div>,
});

function haystackFor(b: BenchDTO): string {
  const parts = [b.id, b.name, b.description, b.area, STYLE_LABEL[b.style], `${b.lengthFt} ft`, STATUS_LABEL[b.status]];
  for (const s of b.sides) {
    if (s.adoption) parts.push(s.adoption.displayName, s.adoption.plaqueText);
  }
  return parts.join(' ').toLowerCase();
}

export default function BenchApp() {
  const [data, setData] = useState<BenchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<Set<BenchStatus>>(new Set(STATUS_ORDER));
  const [area, setArea] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adopting, setAdopting] = useState<{ benchId: string; side: Side } | null>(null);
  const [fitKey, setFitKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/benches', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not load benches.');
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load benches.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const haystacks = useMemo(() => new Map((data?.benches ?? []).map((b) => [b.id, haystackFor(b)])), [data]);
  const areas = useMemo(() => [...new Set((data?.benches ?? []).map((b) => b.area).filter(Boolean))].sort(), [data]);
  const counts = useMemo(() => {
    const c: Record<BenchStatus, number> = { available: 0, partial: 0, adopted: 0, expiring: 0 };
    for (const b of data?.benches ?? []) c[b.status]++;
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return data.benches.filter(
      (b) => statuses.has(b.status) && (area === 'all' || b.area === area) && tokens.every((t) => haystacks.get(b.id)?.includes(t)),
    );
  }, [data, query, statuses, area, haystacks]);

  const selected = data?.benches.find((b) => b.id === selectedId) ?? null;
  const adoptingBench = adopting ? data?.benches.find((b) => b.id === adopting.benchId) ?? null : null;
  const hasFilters = query !== '' || area !== 'all' || statuses.size !== STATUS_ORDER.length;

  // The selected bench stays on the map even if the filters would hide it.
  const mapBenches = useMemo(() => (selected && !filtered.some((b) => b.id === selected.id) ? [...filtered, selected] : filtered), [filtered, selected]);

  // After the filters settle, zoom the map to the results.
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setFitKey((k) => k + 1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statuses, area]);

  // On a phone the map is above the panel, so bring it back into view when a bench is picked.
  const select = useCallback((id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 860px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  function toggleStatus(s: BenchStatus) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function clearFilters() {
    setQuery('');
    setArea('all');
    setStatuses(new Set(STATUS_ORDER));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Van Cortlandt Park bench adoption</h1>
          <p>Find a bench, see who adopted it, or adopt one yourself.</p>
        </div>
        <div className="topbar__end">
          {data && data.sampleCount > 0 && (
            <span className="badge" title="The benches, positions and adopters are placeholders. Load real data from the admin page.">
              Sample data
            </span>
          )}
          <Link href="/admin" className="topbar__link">
            Admin
          </Link>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel" aria-label="Bench search and details">
          {!selected && (
          <div className="panel__controls">
            <label className="visually-hidden" htmlFor="search">
              Search benches
            </label>
            <input
              id="search"
              type="search"
              className="search"
              placeholder="Search by name, area, adopter or plaque"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <div className="chips" role="group" aria-label="Filter by status">
              {STATUS_ORDER.map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={statuses.has(s)} onClick={() => toggleStatus(s)}>
                  <span className={`dot dot-${s}`} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                  <span className="chip__count">{counts[s]}</span>
                </button>
              ))}
            </div>
            {areas.length > 1 && (
              <label className="area">
                <span>Area</span>
                <select value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="all">All areas</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {data && (
              <p className="count" aria-live="polite">
                Showing {filtered.length.toLocaleString('en-US')} of {data.benches.length.toLocaleString('en-US')} benches
                {hasFilters && (
                  <>
                    {' '}
                    <button type="button" className="linklike" onClick={clearFilters}>
                      Clear
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          )}

          <div className="panel__body">
            {error && (
              <div className="empty">
                <p role="alert">{error}</p>
                <button type="button" className="btn btn-quiet" onClick={load}>
                  Try again
                </button>
              </div>
            )}
            {!data && !error && <p className="empty">Loading benches</p>}
            {data && selected && (
              <BenchDetail bench={selected} settings={data.settings} onBack={() => setSelectedId(null)} onAdopt={(side) => setAdopting({ benchId: selected.id, side })} />
            )}
            {data && !selected && (
              <BenchList benches={filtered} selectedId={selectedId} onSelect={select} onClear={clearFilters} hasFilters={hasFilters} />
            )}
            <p className="disclaimer">Unofficial demo built for a coding exercise. Not connected to the Van Cortlandt Park Alliance or NYC Parks.</p>
          </div>
        </aside>

        <section className="mapwrap" aria-label="Map">
          <BenchMap benches={mapBenches} selectedId={selectedId} onSelect={select} fitKey={fitKey} />
          <div className="legend" aria-hidden="true">
            {STATUS_ORDER.map((s) => (
              <span key={s}>
                <i className={`dot dot-${s}`} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </section>
      </main>

      {data && adopting && adoptingBench && (
        <AdoptForm
          key={`${adopting.benchId}-${adopting.side}`}
          bench={adoptingBench}
          side={adopting.side}
          settings={data.settings}
          today={data.today}
          onSuccess={load}
          onClose={() => setAdopting(null)}
        />
      )}
    </div>
  );
}
