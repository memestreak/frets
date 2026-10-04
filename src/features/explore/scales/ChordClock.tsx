import type { ChordIntervals } from './settings';
import {
  chordSpans, describeChord, IntervalTag, toneFill, toneInk, toneLabel,
} from './chordDiagram';
import { prettyNote, type DiatonicChord, type Scale } from './theory';

/** The circle the twelve semitones sit on. */
const R = 86;
/** The innermost interval arc, just outside the circle. */
const ARC = 106;
/** Gap between concentric arcs. */
const RING = 20;
const DOT = 13;

/** Angle of a semitone above the scale root, which sits at the top. */
const angle = (semi: number) => ((semi * 30 - 90) * Math.PI) / 180;
const polar = (a: number, r: number) => [r * Math.cos(a), r * Math.sin(a)] as const;

interface ChordClockProps {
  scale: Scale;
  chord: DiatonicChord;
  intervals: ChordIntervals;
}

/**
 * The twelve semitones round a circle, scale root at the top: scale notes
 * are dots, the notes outside it empty squares. The chord's tones are
 * coloured and named, and its intervals are bracketed arcs outside the
 * circle, so nothing crosses the middle.
 */
export function ChordClock({ scale, chord, intervals }: ChordClockProps) {
  const spans = chordSpans(chord, intervals);
  const fromRoot = intervals === 'root';
  const outer = ARC + RING * (Math.max(...spans.map(s => s.level)) - 1);
  const half = Math.max(158, outer + 30);
  // Outside the circle unless the arcs need the room.
  const nameR = fromRoot ? 60 : 134;
  const scaleSemis = new Set(scale.degrees.map(d => d.semis));

  return (
    <svg
      className="chord-diagram chord-clock"
      viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`}
      role="img"
      aria-label={describeChord(chord, intervals)}
    >
      <circle r={R} fill="none" stroke="var(--line-strong)" strokeWidth={1.25} />

      {spans.map(s => {
        const r = ARC + RING * (s.level - 1);
        const inset = fromRoot ? 0.05 : 0.09;
        const start = chord.rising[s.from];
        const span = chord.rising[s.to] - start;
        const a0 = angle(start) + inset;
        const a1 = angle(start + span) - inset;
        const [x0, y0] = polar(a0, r);
        const [x1, y1] = polar(a1, r);
        const [t0x, t0y] = polar(a0, r - 8);
        const [t1x, t1y] = polar(a1, r - 8);
        const [mx, my] = polar((a0 + a1) / 2, r);
        return (
          <g key={s.to}>
            <path
              d={`M${t0x} ${t0y} L${x0} ${y0} A${r} ${r} 0 ${span > 6 ? 1 : 0} 1 ${x1} ${y1} L${t1x} ${t1y}`}
              fill="none" stroke={s.colour} strokeWidth={2} strokeLinejoin="round"
            />
            <IntervalTag x={mx} y={my} name={s.name} colour={s.colour} />
          </g>
        );
      })}

      {Array.from({ length: 12 }, (_, semi) => {
        const [x, y] = polar(angle(semi), R);
        if (!scaleSemis.has(semi)) {
          return (
            <rect
              key={semi} x={x - 6} y={y - 6} width={12} height={12} rx={2}
              fill="var(--surface-raised)" stroke="var(--line-strong)" strokeWidth={1.25}
            />
          );
        }
        const k = chord.semis.indexOf(semi);
        if (k < 0) {
          return (
            <circle
              key={semi} cx={x} cy={y} r={8}
              fill="var(--surface-sunken)" stroke="var(--line-strong)" strokeWidth={1.25}
            />
          );
        }
        const [nx, ny] = polar(angle(semi), nameR);
        return (
          <g key={semi} data-testid="clock-tone">
            {k === 0 ? (
              <rect
                x={x - DOT} y={y - DOT} width={2 * DOT} height={2 * DOT} rx={3}
                fill={toneFill(k)} stroke="var(--surface-raised)" strokeWidth={2}
              />
            ) : (
              <circle
                cx={x} cy={y} r={DOT}
                fill={toneFill(k)} stroke="var(--surface-raised)" strokeWidth={2}
              />
            )}
            <text x={x} y={y + 4} textAnchor="middle" className="diagram-role" fill={toneInk(k)}>
              {toneLabel(chord, k)}
            </text>
            <text x={nx} y={ny + 5} textAnchor="middle" className="diagram-name" fill="var(--ink)">
              {prettyNote(chord.tones[k])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
