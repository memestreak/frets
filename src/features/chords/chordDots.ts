import type { FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor, DEGREES, type DotColor } from '@/components/fretboard/theme';
import { positionsOnNeck, TUNING } from '@/lib/music';
import type { ChordInfo, ChordTone } from './chordTypes';
import type { Voicing } from './voicings';

/** The chord tone a string plays at a fret. Voicings only hold chord tones. */
export function toneAt(chord: ChordInfo, string: number, fret: number): ChordTone {
  const semis = (TUNING[string] + fret - chord.rootPc + 120) % 12;
  return chord.tones.find(t => t.semis === semis)!;
}

/** A tone's dot colour: its degree, so a 9 looks like a 2 and a 13 like a 6. */
export const toneColor = (tone: ChordTone): DotColor => degreeColor(DEGREES[tone.degree - 1]);

/** One chord tone as a dot for the big `Fretboard`, labelled by interval; the root is square. */
function toneDot(chord: ChordInfo, s: number, f: number): FretDot {
  const tone = toneAt(chord, s, f);
  return {
    s, f,
    kind: tone.label === 'R' ? 'root' : 'note',
    shape: tone.label === 'R' ? 'square' : 'circle',
    ...toneColor(tone),
    label: tone.label,
    fontSize: tone.label.length > 2 ? 9 : 11,
  };
}

/** A voicing as dots for the big `Fretboard`. */
export function voicingDots(chord: ChordInfo, voicing: Voicing): FretDot[] {
  return voicing.flatMap((fret, s) => (fret === null ? [] : [toneDot(chord, s, fret)]));
}

/** The arpeggio: every chord tone from the nut to `maxFret`. */
export function arpeggioDots(chord: ChordInfo, maxFret: number): FretDot[] {
  return positionsOnNeck(chord.rootPc, chord.tones.map(t => t.semis), maxFret)
    .map(p => toneDot(chord, p.s, p.f));
}
