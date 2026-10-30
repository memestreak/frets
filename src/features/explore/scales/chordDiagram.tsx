import { DEGREES, type Degree } from '@/components/fretboard/theme';
import { prettyNote } from '@/lib/theory/notes';
import type { ChordIntervals } from './settings';
import type { DiatonicChord } from '@/lib/theory/diatonic';
import { intervalWords } from '@/lib/theory/intervals';
import type { Scale, ScaleDegree } from '@/lib/theory/scales';

/** Chord tones take the colours of root, third, fifth and seventh. */
const ROLES: readonly Degree[] = ['root', 'third', 'fifth', 'seventh'];

export const toneFill = (k: number) => `var(--degree-${ROLES[k]})`;
export const toneInk = (k: number) => `var(--on-degree-${ROLES[k]})`;

/** With no chord, scale notes take their degree colours, as on the neck. */
export const degreeFill = (d: ScaleDegree) => `var(--degree-${DEGREES[d.degree - 1]})`;
export const degreeInk = (d: ScaleDegree) => `var(--on-degree-${DEGREES[d.degree - 1]})`;

/** A scale note's label, with "R" for the root. */
export const degreeLabel = (d: ScaleDegree) => (d.semis === 0 ? 'R' : d.label);

/** A tone's label against the chord root, with "R" for the root. */
export const toneLabel = (chord: DiatonicChord, k: number) =>
  k === 0 ? 'R' : chord.labels[k];

/** One annotated interval: from one stacked tone up to another. */
export interface Span {
  /** Indices into the chord's tones. */
  from: number;
  to: number;
  /** "M3", "P5". */
  name: string;
  /** 1 for the lowest bracket or innermost arc. */
  level: number;
  colour: string;
}

/**
 * The intervals a diagram names. From the root: one per tone, stacked so the
 * farther the tone, the higher it sits, each in its tone's colour. Between
 * tones: the thirds, side by side on one level.
 */
export function chordSpans(chord: DiatonicChord, intervals: ChordIntervals): Span[] {
  return intervals === 'root'
    ? chord.fromRoot.map((name, i) => ({
      from: 0, to: i + 1, name, level: i + 1, colour: toneFill(i + 1),
    }))
    : chord.thirds.map((name, i) => ({
      from: i, to: i + 1, name, level: 1, colour: 'var(--primary)',
    }));
}

/** The scale alone, for screen readers. */
export function describeScale(scale: Scale): string {
  const notes = scale.degrees.map(d => `${d.label} ${prettyNote(d.note)}`);
  return `${prettyNote(scale.root)} ${scale.type.title}: ${notes.join(', ')}`;
}

/** What the diagram shows, for screen readers. */
export function describeChord(chord: DiatonicChord, intervals: ChordIntervals): string {
  const note = (k: number) => prettyNote(chord.tones[k]);
  const steps = chordSpans(chord, intervals)
    .map(s => `${intervalWords(s.name)} up to ${note(s.to)}`);
  return intervals === 'root'
    ? `${chord.symbol} from its root ${note(0)}: ${steps.join(', ')}`
    : `${chord.symbol} in thirds from ${note(0)}: ${steps.join(', then ')}`;
}

const TAG_W = 34;
const TAG_H = 18;

/** The interval's name in a small box, centred on (x, y); smaller on the ladder. */
export function IntervalTag({ x, y, name, colour, small = false }: {
  x: number; y: number; name: string; colour: string; small?: boolean;
}) {
  const w = small ? 24 : TAG_W;
  const h = small ? 13 : TAG_H;
  return (
    <g>
      <rect
        x={x - w / 2} y={y - h / 2} width={w} height={h} rx={small ? 3 : 4}
        fill="var(--surface-raised)" stroke={colour}
      />
      <text
        x={x} y={y + (small ? 3.5 : 4)} textAnchor="middle"
        className={small ? 'interval-tag interval-tag-small' : 'interval-tag'} fill={colour}
      >
        {name}
      </text>
    </g>
  );
}
