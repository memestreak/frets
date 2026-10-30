import { keyOnSpoke, keyTonic, spokeOf, wheelKey, type Key } from './keys';
import { mod12, pitchClassOf } from './notes';
import { scaleDef, scaleOf } from './scales';

/*
 * The seven modes of the major scale as the Circle of fifths uses them:
 * each mode's notes are a major key's, and the mode is spelled from that
 * key (`parentKey`), so its chords never need double flats.
 */

export type ModeId = 'lydian' | 'ionian' | 'mixolydian' | 'dorian' | 'aeolian' | 'phrygian' | 'locrian';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** Spokes from the root's major key to the key whose notes the mode uses. */
  offset: number;
  /** The degree of that key (0–6) the mode starts on: Dorian starts on its 2nd. */
  start: number;
  /** Index (0–6) of the chord that carries the mode's sound; null for Ionian. */
  signature: number | null;
  /** The degree that sets the mode apart from major or minor: Dorian's 6. */
  character: string | null;
}

/**
 * The seven modes of the major scale, brightest first. On the circle they
 * run the same way, clockwise from the spoke before the key's own.
 */
export const MODES: readonly ModeDef[] = [
  { id: 'lydian', name: 'Lydian', offset: 1, start: 3, signature: 1, character: '♯4' },
  { id: 'ionian', name: 'Ionian', offset: 0, start: 0, signature: null, character: null },
  { id: 'mixolydian', name: 'Mixolydian', offset: -1, start: 4, signature: 6, character: '♭7' },
  { id: 'dorian', name: 'Dorian', offset: -2, start: 1, signature: 3, character: '6' },
  { id: 'aeolian', name: 'Aeolian', offset: -3, start: 5, signature: 5, character: '♭6' },
  { id: 'phrygian', name: 'Phrygian', offset: -4, start: 2, signature: 1, character: '♭2' },
  { id: 'locrian', name: 'Locrian', offset: -5, start: 6, signature: 4, character: '♭5' },
];

export const modeDef = (id: ModeId): ModeDef => MODES.find(m => m.id === id)!;

const IONIAN = scaleDef('ionian')!;

/** The circle's two major keys in common use by another name too, by fifths: F♯ as G♭, D♭ as C♯. */
const OTHER_NAME: Partial<Record<number, number>> = { 6: -6, [-5]: 7 };

/** The major key whose notes a mode uses, and the mode's root spelled in it. */
export interface ParentKey {
  /** The key's spoke on the circle of fifths. */
  spoke: number;
  /** The key's tonic, tonal ASCII. */
  tonic: string;
  /** tonal ASCII; may be a note the root picker lacks, such as "E#". */
  root: string;
}

/**
 * A mode's notes are a major key's: spell the mode as that key spells
 * them. The root keeps its name where the key's other spelling allows it
 * (F♯ Lydian uses C♯ major's notes, F Locrian G♭ major's); otherwise it
 * takes the key's name for it (D♭ Locrian uses D major's notes, so it is
 * C♯ Locrian).
 */
export function parentKey(root: string, id: ModeId): ParentKey {
  const mode = modeDef(id);
  const spoke = mod12(spokeOf(wheelKey(pitchClassOf(root), false)) + mode.offset);
  const named = keyOnSpoke(spoke, false);
  const keys = [named.fifths, OTHER_NAME[named.fifths]]
    .filter((f): f is number => f !== undefined)
    .map(fifths => keyTonic({ fifths }));
  const options = keys.map(tonic => ({ spoke, tonic, root: scaleOf(tonic, IONIAN).degrees[mode.start].note }));
  return options.find(o => o.root === root) ?? options[0];
}

/** The mode a key is: its tonic, Aeolian if minor, else Ionian. */
export const modeForKey = (k: Key): { root: string; mode: ModeId } =>
  ({ root: keyTonic(k), mode: k.minor ? 'aeolian' : 'ionian' });

/** The key a mode on a root is, as the circle names it: minor for Aeolian, else major. */
export const keyForMode = (root: string, mode: ModeId): Key =>
  wheelKey(pitchClassOf(root), mode === 'aeolian');
