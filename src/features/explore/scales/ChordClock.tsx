import type { ChordIntervals } from './settings';
import {
  chordSpans, degreeFill, degreeInk, degreeLabel, describeChord, describeScale,
  IntervalTag, toneFill, toneInk, toneLabel,
} from './chordDiagram';
import { prettyNote, type DiatonicChord, type Scale } from './theory';

/** The circle the twelve semitones sit on. */
const R = 86;
/** The innermost interval arc, just outside the circle. */
const ARC = 106;
/** Gap between concentric arcs. */
const RING = 20;
const DOT = 13;

/** Angle of a semitone above the note at the top. */
const angle = (semi: number) => ((semi * 30 - 90) * Math.PI) / 180;
const polar = (a: number, r: number) => [r * Math.cos(a), r * Math.sin(a)] as const;

interface ChordClockProps {
  scale: Scale;
  /** With no chord, the scale's notes in their degree colours. */
  chord: DiatonicChord | null;
  intervals: ChordIntervals;
  /**
   * Semitones above the scale's root of the note at the top, 0–11: after
   * Rotate mode the picked scale's root stays there and the root moves.
   */
  from?: number;
}

/**
 * The twelve semitones round a circle, the picked root at the top: scale notes
 * are dots, the notes outside it empty squares. A chord's tones are
 * coloured and named, and its intervals are bracketed arcs outside the
 * circle, so nothing crosses the middle. Without a chord, every scale note
 * takes its degree colour and is named.
 */
export function ChordClock({ scale, chord, intervals, from = 0 }: ChordClockProps) {
  const at = (semi: number) => angle(semi - from);
  const spans = chord ? chordSpans(chord, intervals) : [];
  const fromRoot = intervals === 'root';
  const outer = ARC + RING * (Math.max(1, ...spans.map(s => s.level)) - 1);
  const half = Math.max(158, outer + 30);
  // Outside the circle unless concentric arcs need the room.
  const nameR = chord && fromRoot ? 60 : 134;
  const scaleSemis = new Set(scale.degrees.map(d => d.semis));

  return (
    <svg
      className="chord-diagram chord-clock"
      viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`}
      role="img"
      aria-label={chord ? describeChord(chord, intervals) : describeScale(scale)}
    >
      <circle r={R} fill="none" stroke="var(--line-strong)" strokeWidth={1.25} />

      {chord && spans.map(s => {
        const r = ARC + RING * (s.level - 1);
        const inset = fromRoot ? 0.05 : 0.09;
        const start = chord.rising[s.from];
        const span = chord.rising[s.to] - start;
        const a0 = at(start) + inset;
        const a1 = at(start + span) - inset;
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
        const [x, y] = polar(at(semi), R);
        if (!scaleSemis.has(semi)) {
          return (
            <rect
              key={semi} x={x - 6} y={y - 6} width={12} height={12} rx={2}
              fill="var(--surface-raised)" stroke="var(--line-strong)" strokeWidth={1.25}
            />
          );
        }
        const degree = scale.degrees.find(d => d.semis === semi)!;
        const k = chord ? chord.semis.indexOf(semi) : -1;
        if (chord && k < 0) {
          return (
            <circle
              key={semi} cx={x} cy={y} r={8}
              fill="var(--surface-sunken)" stroke="var(--line-strong)" strokeWidth={1.25}
            />
          );
        }
        const fill = chord ? toneFill(k) : degreeFill(degree);
        const ink = chord ? toneInk(k) : degreeInk(degree);
        const label = chord ? toneLabel(chord, k) : degreeLabel(degree);
        const root = chord ? k === 0 : semi === 0;
        const [nx, ny] = polar(at(semi), nameR);
        return (
          <g key={semi} data-testid="clock-tone">
            {root ? (
              <rect
                x={x - DOT} y={y - DOT} width={2 * DOT} height={2 * DOT} rx={3}
                fill={fill} stroke="var(--surface-raised)" strokeWidth={2}
              />
            ) : (
              <circle cx={x} cy={y} r={DOT} fill={fill} stroke="var(--surface-raised)" strokeWidth={2} />
            )}
            <text x={x} y={y + 4} textAnchor="middle" className="diagram-role" fill={ink}>
              {label}
            </text>
            <text x={nx} y={ny + 5} textAnchor="middle" className="diagram-name" fill="var(--ink)">
              {prettyNote(degree.note)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
