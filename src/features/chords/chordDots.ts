import type { FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor, DEGREES, type DotColor } from '@/components/fretboard/theme';
import { TUNING } from '@/lib/music';
import type { ChordInfo, ChordTone } from './chordTypes';
import type { Voicing } from './voicings';

/** The chord tone a string plays at a fret. Voicings only hold chord tones. */
export function toneAt(chord: ChordInfo, string: number, fret: number): ChordTone {
  const semis = (TUNING[string] + fret - chord.rootPc + 120) % 12;
  return chord.tones.find(t => t.semis === semis)!;
}

/** A tone's dot colour: its degree, so a 9 looks like a 2 and a 13 like a 6. */
export const toneColor = (tone: ChordTone): DotColor => degreeColor(DEGREES[tone.degree - 1]);

/** A voicing as dots for the big `Fretboard`, labelled by interval; the root is square. */
export function voicingDots(chord: ChordInfo, voicing: Voicing): FretDot[] {
  return voicing.flatMap((fret, s) => {
    if (fret === null) return [];
    const tone = toneAt(chord, s, fret);
    return [{
      s, f: fret,
      kind: tone.label === 'R' ? 'root' : 'note',
      shape: tone.label === 'R' ? 'square' : 'circle',
      ...toneColor(tone),
      label: tone.label,
      fontSize: tone.label.length > 2 ? 9 : 11,
    }];
  });
}
