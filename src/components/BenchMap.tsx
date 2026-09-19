'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { PARK } from '@/lib/config';
import type { BenchDTO, BenchStatus } from '@/lib/types';
import { STATUS_LABEL } from './ui';

interface Props {
  benches: BenchDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  fitKey: number;
}

type Leaflet = typeof import('leaflet');

const BENCH_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2.2H4zM4 9.6h16v2.2H4zM4 13h16v2.6H4zM5 15.6h2.2V19H5zM16.8 15.6H19V19h-2.2z"/></svg>';

function iconFor(L: Leaflet, status: BenchStatus, selected: boolean) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin pin-${status}${selected ? ' pin-selected' : ''}">${BENCH_GLYPH}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function BenchMap({ benches, selectedId, onSelect, fitKey }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; key: string }>());
  const benchesRef = useRef(benches);
  const onSelectRef = useRef(onSelect);
  const didFirstFit = useRef(false);
  const [ready, setReady] = useState(false);

  benchesRef.current = benches;
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      const L = (await import('leaflet')).default as unknown as Leaflet;
      if (cancelled || !container.current) return;
      leafletRef.current = L;
      const map = L.map(container.current, { center: [PARK.center.lat, PARK.center.lng], zoom: 15, zoomControl: true, zoomSnap: 0.5, zoomDelta: 0.5 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      // Pins shrink to small dots when zoomed out so hundreds of benches stay readable.
      const applyZoom = () => {
        const z = map.getZoom();
        const el = map.getContainer();
        el.classList.toggle('zoom-far', z < 16);
        el.classList.toggle('zoom-mid', z >= 16 && z < 17);
      };
      applyZoom();
      map.on('zoomend', applyZoom);
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markers.current.clear();
      setReady(false);
    };
  }, []);

  // Keep the markers in step with the bench list. Only markers that changed are touched.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    const wanted = new Set(benches.map((b) => b.id));
    for (const [id, entry] of markers.current) {
      if (!wanted.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    }
    for (const b of benches) {
      const selected = b.id === selectedId;
      const key = `${b.status}|${selected}`;
      const existing = markers.current.get(b.id);
      if (existing) {
        if (existing.key !== key) {
          existing.marker.setIcon(iconFor(L, b.status, selected));
          existing.marker.setZIndexOffset(selected ? 1000 : 0);
          existing.key = key;
        }
      } else {
        const marker = L.marker([b.lat, b.lng], {
          icon: iconFor(L, b.status, selected),
          title: `${b.name}. ${STATUS_LABEL[b.status]}`,
          alt: b.name,
          zIndexOffset: selected ? 1000 : 0,
        });
        marker.on('click', () => onSelectRef.current(b.id));
        marker.addTo(map);
        markers.current.set(b.id, { marker, key });
      }
    }
  }, [ready, benches, selectedId]);

  // Zoom to fit: the first time benches arrive, and again when the filters change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const list = benchesRef.current;
    if (!ready || !L || !map || list.length === 0) return;
    if (!didFirstFit.current || fitKey > 0) {
      didFirstFit.current = true;
      map.fitBounds(L.latLngBounds(list.map((b) => [b.lat, b.lng] as [number, number])), { paddingTopLeft: [40, 40], paddingBottomRight: [40, 80], maxZoom: 17 });
    }
  }, [ready, fitKey, benches.length > 0]);

  // Move to the bench that was picked.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const b = benchesRef.current.find((x) => x.id === selectedId);
    if (b) map.setView([b.lat, b.lng], Math.max(map.getZoom(), 17), { animate: true });
  }, [ready, selectedId]);

  return <div ref={container} className="map" role="application" aria-label="Map of benches in Van Cortlandt Park" />;
}
