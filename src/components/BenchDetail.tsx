'use client';

import { useState } from 'react';
import { addDays, formatLong, formatTerm } from '@/lib/dates';
import type { BenchDTO, Settings, Side, SideInfo } from '@/lib/types';
import BenchIllustration from './BenchIllustration';
import { STYLE_LABEL } from './ui';

interface Props {
  bench: BenchDTO;
  settings: Settings;
  onBack: () => void;
  onAdopt: (side: Side) => void;
}

const SIDE_PILL: Record<SideInfo['status'], string> = {
  available: 'Available',
  adopted: 'Adopted',
  expiring: 'Ending soon',
};

export function Plaque({ text, fallback }: { text: string; fallback: string }) {
  const lines = (text.trim() || fallback).split('\n');
  return (
    <figure className="plaque">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </figure>
  );
}

export default function BenchDetail({ bench, settings, onBack, onAdopt }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const twoSides = bench.sides.length === 2;

  return (
    <article className="detail">
      <button type="button" className="back" onClick={onBack}>
        Back to results
      </button>

      <div className="detail__media">
        {bench.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bench.imageUrl} alt={`${bench.name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <BenchIllustration style={bench.style} lengthFt={bench.lengthFt} />
        )}
      </div>

      <h2 className="detail__title">{bench.name}</h2>
      <p className="detail__meta">
        {bench.id}. {bench.area}. {STYLE_LABEL[bench.style]}, {bench.lengthFt} ft{twoSides ? ', a plaque on each side' : ''}.
      </p>

      {bench.sides.map((s) => (
        <section key={s.side} className={`side side-${s.status}`} aria-label={twoSides ? `Side ${s.side}` : 'Plaque'}>
          <header className="side__head">
            <h3>{twoSides ? `Side ${s.side}` : 'Plaque'}</h3>
            <span className={`pill pill-${s.status}`}>{SIDE_PILL[s.status]}</span>
          </header>

          {s.adoption ? (
            <>
              <Plaque text={s.adoption.plaqueText} fallback={`Adopted by ${s.adoption.displayName}`} />
              <dl className="facts">
                <div>
                  <dt>Adopted by</dt>
                  <dd>{s.adoption.displayName}</dd>
                </div>
                <div>
                  <dt>Since</dt>
                  <dd>{formatLong(s.adoption.startDate)}</dd>
                </div>
                <div>
                  <dt>Runs through</dt>
                  <dd>
                    {formatLong(s.adoption.endDate)} ({s.adoption.daysLeft.toLocaleString('en-US')} days left)
                  </dd>
                </div>
              </dl>
              {s.status === 'expiring' && (
                <p className="side__notice">This side opens up again on {formatLong(addDays(s.adoption.endDate, 1))}.</p>
              )}
            </>
          ) : (
            <div className="side__open">
              <p>Nobody has adopted this side. A new adoption lasts {formatTerm(settings.defaultTermMonths)} unless you pick another length.</p>
              <button type="button" className="btn" onClick={() => onAdopt(s.side)}>
                Adopt {twoSides ? `side ${s.side}` : 'this bench'}
              </button>
            </div>
          )}
        </section>
      ))}

      {bench.description && <p className="detail__text">{bench.description}</p>}
      {bench.isPlaceholder && <p className="note">Sample data. This bench, its position and its adopters are placeholders.</p>}
    </article>
  );
}
