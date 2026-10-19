import type { DotLabels } from '@/components/DotLabels';
import type { FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor, DEGREES, type DotColor } from '@/components/fretboard/theme';
import { positionsOnNeck, TUNING } from '@/lib/music';
import type { ChordInfo, ChordTone } from '@/lib/chords/chordTypes';
import type { Voicing } from '@/lib/chords/voicings';

/** The chord tone a string plays at a fret. Voicings only hold chord tones. */
export function toneAt(chord: ChordInfo, string: number, fret: number): ChordTone {
  const semis = (TUNING[string] + fret - chord.rootPc + 120) % 12;
  return chord.tones.find(t => t.semis === semis)!;
}

/** A tone's dot colour: its degree, so a 9 looks like a 2 and a 13 like a 6. */
export const toneColor = (tone: ChordTone): DotColor => degreeColor(DEGREES[tone.degree - 1]);

/** What a tone's dot says: its interval, its spelled note, or nothing. */
function toneLabel(chord: ChordInfo, tone: ChordTone, labels: DotLabels): string {
  if (labels === 'note') return chord.notes[chord.tones.indexOf(tone)];
  return labels === 'interval' ? tone.label : '';
}

/** One chord tone as a dot for the big `Fretboard`; the root is square. */
function toneDot(chord: ChordInfo, s: number, f: number, labels: DotLabels): FretDot {
  const tone = toneAt(chord, s, f);
  const label = toneLabel(chord, tone, labels);
  return {
    s, f,
    kind: tone.label === 'R' ? 'root' : 'note',
    shape: tone.label === 'R' ? 'square' : 'circle',
    ...toneColor(tone),
    label,
    fontSize: label.length > 2 ? 9 : 11,
  };
}

/** A voicing as dots for the big `Fretboard`, labelled by interval unless `labels` says otherwise. */
export function voicingDots(
  chord: ChordInfo, voicing: Voicing, labels: DotLabels = 'interval',
): FretDot[] {
  return voicing.flatMap((fret, s) => (fret === null ? [] : [toneDot(chord, s, fret, labels)]));
}

/** The strings a voicing leaves out, for the big `Fretboard` to mark. */
export function mutedStrings(voicing: Voicing): number[] {
  return voicing.flatMap((fret, s) => (fret === null ? [s] : []));
}

/** The arpeggio: every chord tone from the nut to `maxFret`, labelled as the shape's dots are. */
export function arpeggioDots(
  chord: ChordInfo, maxFret: number, labels: DotLabels = 'interval',
): FretDot[] {
  return positionsOnNeck(chord.rootPc, chord.tones.map(t => t.semis), maxFret)
    .map(p => toneDot(chord, p.s, p.f, labels));
}
