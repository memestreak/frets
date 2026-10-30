import { positionsOnNeck } from '@/lib/music';
import type { DiatonicChord } from '@/lib/theory/diatonic';
import type { Scale } from '@/lib/theory/scales';

/* The Scale lab's neck: the scale's notes, or a chord's, on every string and fret. */

export interface NeckNote {
  s: number;
  f: number;
  note: string;
  /** Interval label: against the chord root when a chord is shown. */
  label: string;
  /** 1–7, picks the colour. */
  degree: number;
}

/**
 * Every scale note from the nut to `maxFret`, low E first; with a chord,
 * only the chord's tones.
 */
export function neckNotes(
  scale: Scale, maxFret: number, chord: DiatonicChord | null = null,
): NeckNote[] {
  const bySemis = new Map(scale.degrees.map(d => [d.semis, d]));
  const shown = chord ? chord.semis : scale.degrees.map(d => d.semis);
  return positionsOnNeck(scale.degrees[0].pc, shown, maxFret).map(({ s, f, semis }) => {
    const d = bySemis.get(semis)!;
    if (!chord) return { s, f, note: d.note, label: d.label, degree: d.degree };
    const k = chord.semis.indexOf(semis);
    return { s, f, note: d.note, label: chord.labels[k], degree: 2 * k + 1 };
  });
}
