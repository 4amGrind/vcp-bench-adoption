import type { Style } from '@/lib/types';

/** A simple drawn bench, used when a bench has no photo. Shape follows the real style and length. */
export default function BenchIllustration({ style, lengthFt }: { style: Style; lengthFt: 4 | 8 }) {
  const w = lengthFt === 8 ? 230 : 130;
  const x = (320 - w) / 2;
  const wood = '#a06f39';
  const woodDark = '#7d5528';
  const iron = '#2b302d';
  const concrete = '#b7b7ae';
  const label = `${style === 'worlds_fair' ? "World's Fair style" : 'Concrete base'} bench, ${lengthFt} feet`;

  return (
    <svg viewBox="0 0 320 170" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} className="illustration">
      <rect x="0" y="128" width="320" height="42" fill="#cfe0cb" />
      <ellipse cx="160" cy="138" rx={w / 2 + 16} ry="7" fill="#00000026" />
      {style === 'worlds_fair' ? (
        <g>
          {[x + 4, x + w - 14].map((ex) => (
            <g key={ex}>
              <rect x={ex} y="34" width="10" height="100" rx="2" fill={iron} />
              <rect x={ex - 6} y="92" width="22" height="7" rx="2" fill={iron} />
              <rect x={ex - 3} y="60" width="16" height="6" rx="2" fill={iron} />
            </g>
          ))}
          <rect x={x + 14} y="38" width={w - 28} height="10" rx="2" fill={wood} />
          <rect x={x + 14} y="52" width={w - 28} height="10" rx="2" fill={woodDark} />
          <rect x={x + 14} y="66" width={w - 28} height="10" rx="2" fill={wood} />
          <rect x={x + 8} y="97" width={w - 16} height="9" rx="2" fill={wood} />
          <rect x={x + 8} y="108" width={w - 16} height="9" rx="2" fill={woodDark} />
        </g>
      ) : (
        <g>
          <rect x={x} y="96" width="26" height="38" rx="2" fill={concrete} />
          <rect x={x + w - 26} y="96" width="26" height="38" rx="2" fill={concrete} />
          <rect x={x + 30} y="42" width="8" height="54" fill={iron} />
          <rect x={x + w - 38} y="42" width="8" height="54" fill={iron} />
          <rect x={x + 22} y="44" width={w - 44} height="11" rx="2" fill={wood} />
          <rect x={x + 22} y="58" width={w - 44} height="11" rx="2" fill={woodDark} />
          <rect x={x - 4} y="85" width={w + 8} height="10" rx="2" fill={wood} />
        </g>
      )}
    </svg>
  );
}
