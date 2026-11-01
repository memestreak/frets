import type { ReactNode } from 'react';
import type { Degree } from './fretboard/theme';

/** Horizontal strings and frets across the tile. */
function Strings({ frets = [30, 52, 74] }: { frets?: number[] }) {
  return (
    <>
      <g stroke="var(--fret-wire)" strokeWidth="2">
        {frets.map(x => <line key={x} x1={x} y1="16" x2={x} y2="80" />)}
      </g>
      <g stroke="var(--string)" strokeWidth="1.5">
        {[20, 31, 42, 53, 64, 75].map(y => <line key={y} x1="10" y1={y} x2="86" y2={y} />)}
      </g>
    </>
  );
}

const ring = { stroke: 'var(--dot-ring)', strokeWidth: 2 };

/** A minor pentatonic in two frets per string, low E at the bottom: [x, y, degree]. */
const PENTATONIC: readonly [number, number, Degree][] = [
  [38, 75, 'root'], [78, 75, 'third'], [38, 64, 'other'], [58, 64, 'fifth'],
  [38, 53, 'seventh'], [58, 53, 'root'], [38, 42, 'third'], [58, 42, 'other'],
  [38, 31, 'fifth'], [78, 31, 'seventh'], [38, 20, 'root'], [78, 20, 'third'],
];

/** A fret number on a tab line, on a patch of board that breaks the line behind it. */
function TabNumber({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <>
      <rect x={x - 6} y={y - 6} width="12" height="12" fill="var(--fretboard)" />
      <text
        x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700"
        fill="var(--string)" fontFamily="var(--font-sans)"
      >
        {n}
      </text>
    </>
  );
}

/** The i-th of twelve points round the circle, clockwise from the top, rounded so server and client agree. */
function onCircle(i: number) {
  const a = (i * 30 - 90) * (Math.PI / 180);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(48 + 30 * Math.cos(a)), y: round(48 + 30 * Math.sin(a)) };
}

/** Each page's pictogram, by href, in the tile's 96-unit viewBox. */
export const PAGE_GLYPHS: Readonly<Record<string, ReactNode>> = {
  '/practice/intervals': (
    <>
      <Strings />
      <rect x="34" y="57" width="14" height="14" rx="3" fill="var(--degree-root)" {...ring} />
      <line x1="47" y1="57" x2="58" y2="40" stroke="var(--nut)" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="63" cy="31" r="8" fill="var(--dot-quiz)" {...ring} />
    </>
  ),
  '/practice/notes': (
    <>
      <Strings />
      <circle cx="63" cy="42" r="12" fill="var(--dot-quiz)" {...ring} />
      <text
        x="63" y="43" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700"
        fill="var(--on-dot-quiz)" fontFamily="var(--font-sans)"
      >
        ?
      </text>
    </>
  ),
  '/explore/scales': (
    <>
      <Strings frets={[28, 48, 68]} />
      {PENTATONIC.map(([x, y, d]) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r="5" fill={`var(--degree-${d})`} />
      ))}
    </>
  ),
  '/explore/triads': (
    <>
      <Strings />
      {/* A 1st-inversion grip on the top three strings, joined by its band. */}
      <polyline
        points="63,42 41,31 41,20" fill="none" stroke="var(--string)" strokeOpacity="0.3"
        strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="63" cy="42" r="6" fill="var(--degree-third)" {...ring} />
      <circle cx="41" cy="31" r="6" fill="var(--degree-fifth)" {...ring} />
      <rect x="35" y="14" width="12" height="12" rx="2.5" fill="var(--degree-root)" {...ring} />
    </>
  ),
  '/explore/circle': (
    <>
      <circle cx="48" cy="48" r="30" fill="none" stroke="var(--string)" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const { x, y } = onCircle(i);
        return i === 0
          ? <circle key={i} cx={x} cy={y} r="8" fill="var(--degree-root)" {...ring} />
          : <circle key={i} cx={x} cy={y} r="4" fill={i === 1 || i === 11 ? 'var(--degree-fifth)' : 'var(--inlay)'} />;
      })}
    </>
  ),
  '/chords': (
    <>
      <g stroke="var(--fret-wire)" strokeWidth="2">
        {[49, 66, 83].map(y => <line key={y} x1="12" y1={y} x2="84" y2={y} />)}
      </g>
      <rect x="12" y="28" width="72" height="4" rx="1.5" fill="var(--nut)" />
      <g stroke="var(--string)" strokeWidth="1.5">
        {[16, 28.8, 41.6, 54.4, 67.2, 80].map(x => <line key={x} x1={x} y1="32" x2={x} y2="87" />)}
      </g>
      {/* Am7: x 0 2 0 1 0 */}
      <circle cx="41.6" cy="57.5" r="6" fill="var(--degree-fifth)" {...ring} />
      <circle cx="67.2" cy="40.5" r="6" fill="var(--degree-third)" {...ring} />
      <g fill="none" stroke="var(--dot-ring)" strokeWidth="2">
        <rect x="24.3" y="13.5" width="9" height="9" rx="1.5" />
        <circle cx="54.4" cy="18" r="4.5" />
        <circle cx="80" cy="18" r="4.5" />
      </g>
      <text x="16" y="19" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--string)">×</text>
    </>
  ),
  '/tuner': (
    <>
      {/* A dial: its scale, the in-tune zone at the top, the needle just flat. */}
      <path d="M16.2 55.1 A36 36 0 0 1 79.8 55.1" fill="none" stroke="var(--fret-wire)" strokeWidth="8" strokeLinecap="round" />
      <path d="M43.6 36.3 A36 36 0 0 1 52.4 36.3" fill="none" stroke="var(--degree-fifth)" strokeWidth="8" />
      <line x1="48" y1="72" x2="40.5" y2="41.9" stroke="var(--degree-root)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="72" r="6" fill="var(--nut)" />
    </>
  ),
  '/metronome': (
    <>
      {/* A pyramid metronome, its pendulum swung right, the weight high on the arm. */}
      <path
        d="M39 16 H57 L72 80 H24 Z" fill="none" stroke="var(--string)" strokeWidth="2.5" strokeLinejoin="round"
      />
      <line x1="20" y1="80" x2="76" y2="80" stroke="var(--nut)" strokeWidth="4" strokeLinecap="round" />
      <line x1="48" y1="68" x2="64" y2="24" stroke="var(--nut)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="-7" y="-4.5" width="14" height="9" rx="2" transform="translate(58.5 39) rotate(20)" fill="var(--degree-root)" {...ring} />
      <circle cx="48" cy="68" r="4" fill="var(--nut)" />
    </>
  ),
  '/tab': (
    <>
      {/* A tab staff: T A B stacked at its opening line, then a three-note run. */}
      <g stroke="var(--string)" strokeWidth="1.5">
        {[24, 34, 44, 54, 64, 74].map(y => <line key={y} x1="26" y1={y} x2="84" y2={y} />)}
      </g>
      <line x1="26" y1="24" x2="26" y2="74" stroke="var(--nut)" strokeWidth="2" />
      <g textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill="var(--nut)" fontFamily="var(--font-sans)">
        <text x="17" y="34">T</text>
        <text x="17" y="49">A</text>
        <text x="17" y="64">B</text>
      </g>
      <TabNumber x={44} y={54} n={5} />
      <TabNumber x={60} y={44} n={7} />
      <TabNumber x={76} y={34} n={8} />
    </>
  ),
  '/agents': (
    <>
      {/* A speech bubble holding three notes: an agent talking guitar. */}
      <path
        d="M22 20 H74 a8 8 0 0 1 8 8 V56 a8 8 0 0 1 -8 8 H44 L30 77 V64 H22 a8 8 0 0 1 -8 -8 V28 a8 8 0 0 1 8 -8 Z"
        fill="none" stroke="var(--string)" strokeWidth="2.5" strokeLinejoin="round"
      />
      <rect x="25" y="36" width="12" height="12" rx="2.5" fill="var(--degree-root)" {...ring} />
      <circle cx="48" cy="42" r="6" fill="var(--degree-third)" {...ring} />
      <circle cx="65" cy="42" r="6" fill="var(--degree-fifth)" {...ring} />
    </>
  ),
};

/**
 * A page's icon on the home and section index cards: its pictogram on a
 * rosewood tile like the brand mark, drawn from the board and degree tokens
 * so it follows the theme. Nothing for a page with no pictogram.
 */
export function PageIcon({ href }: { href: string }) {
  const glyph = PAGE_GLYPHS[href];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 96 96" width={56} height={56} aria-hidden="true"
      className="shrink-0" data-testid="page-icon"
    >
      <rect width="96" height="96" rx="22" fill="var(--fretboard)" />
      {glyph}
    </svg>
  );
}
