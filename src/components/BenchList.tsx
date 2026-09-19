'use client';

import type { BenchDTO } from '@/lib/types';
import { STATUS_LABEL, STYLE_LABEL, summaryFor } from './ui';

interface Props {
  benches: BenchDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}

export default function BenchList({ benches, selectedId, onSelect, onClear, hasFilters }: Props) {
  if (benches.length === 0) {
    return (
      <div className="empty">
        <p>No benches match your search.</p>
        {hasFilters && (
          <button type="button" className="btn btn-quiet" onClick={onClear}>
            Clear search and filters
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="rows">
      {benches.map((b) => (
        <li key={b.id}>
          <button type="button" className="row" aria-current={b.id === selectedId ? 'true' : undefined} onClick={() => onSelect(b.id)}>
            <span className={`dot dot-${b.status}`} role="img" aria-label={STATUS_LABEL[b.status]} />
            <span className="row__main">
              <span className="row__name">{b.name}</span>
              <span className="row__meta">
                {b.area && !b.name.includes(b.area) ? `${b.area}, ` : ''}
                {b.lengthFt} ft, {STYLE_LABEL[b.style]}
              </span>
            </span>
            <span className="row__status">{summaryFor(b)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
