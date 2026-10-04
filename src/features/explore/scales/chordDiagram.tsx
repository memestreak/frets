import type { Degree } from '@/components/fretboard/theme';
import { DEGREES } from './ScalePanel';
import type { ChordIntervals } from './settings';
import {
  intervalWords, prettyNote, type DiatonicChord, type Scale, type ScaleDegree,
} from './theory';

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

/** The interval's name in a small box, centred on (x, y). */
export function IntervalTag({ x, y, name, colour }: {
  x: number; y: number; name: string; colour: string;
}) {
  return (
    <g>
      <rect
        x={x - TAG_W / 2} y={y - TAG_H / 2} width={TAG_W} height={TAG_H} rx={4}
        fill="var(--surface-raised)" stroke={colour}
      />
      <text x={x} y={y + 4} textAnchor="middle" className="interval-tag" fill={colour}>
        {name}
      </text>
    </g>
  );
}
