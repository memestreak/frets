import type { ChordInfo } from '@/lib/chords/chordTypes';
import type { Voicing } from '@/lib/chords/voicings';
import { pitchClass, samePos, STRING_NAMES, type Position } from '@/lib/music';

/*
 * The Triads page's logic: every grip of a triad on three neighbouring
 * strings (docs/specs/2026-10-18-triads-design.md). No React.
 */

/** The triads the page offers: a tonal chord type id and its name in the menu. */
export const TRIAD_TYPES = [
  ['M', 'Major'], ['m', 'Minor'], ['dim', 'Diminished'], ['aug', 'Augmented'],
] as const;
export type TriadType = (typeof TRIAD_TYPES)[number][0];

/** A string set by its lowest string: 0 is D A E, 3 is e B G. */
export const STRING_SETS = [0, 1, 2, 3] as const;
export type StringSet = (typeof STRING_SETS)[number];

/** The set's strings, low to high. */
export const setStrings = (set: StringSet): number[] => [set, set + 1, set + 2];

/** "e B G": the set's strings named high to low, as guitarists say them. */
export const setLabel = (set: StringSet, between = ' '): string =>
  setStrings(set).reverse().map(s => STRING_NAMES[s]).join(between);

/** The board shows the open strings through this fret. */
export const TRIADS_MAX_FRET = 15;
/** Highest fretted note minus lowest, as for the chord shapes. */
const MAX_SPAN = 4;

/** Which tone is in the bass: 0 root position, 1 first inversion, 2 second. */
export type Inversion = 0 | 1 | 2;

export interface Grip {
  inversion: Inversion;
  /** The three sounding strings; the others are null. */
  voicing: Voicing;
  /** The dots, low string first. */
  points: Position[];
}

/**
 * Every grip of a triad on a string set, from the nut up: each inversion's
 * tones in close position, one per string, the bass on the lowest, within
 * `MAX_SPAN` frets.
 */
export function triadGrips(chord: ChordInfo, set: StringSet): Grip[] {
  const tones = chord.tones.map(t => (chord.rootPc + t.semis) % 12);
  const strings = setStrings(set);
  const grips: Grip[] = [];
  for (const inversion of [0, 1, 2] as const) {
    const order = [0, 1, 2].map(k => tones[(inversion + k) % 3]);
    for (let bass = 0; bass <= TRIADS_MAX_FRET; bass++) {
      if (pitchClass(strings[0], bass) !== order[0]) continue;
      const frets = [bass];
      for (let k = 1; k < 3; k++) {
        // Within the stretch there is one fret at most for each note.
        for (let f = Math.max(0, bass - MAX_SPAN); f <= Math.min(TRIADS_MAX_FRET, bass + MAX_SPAN); f++) {
          if (pitchClass(strings[k], f) === order[k]) frets.push(f);
        }
      }
      if (frets.length !== 3 || Math.max(...frets) - Math.min(...frets) > MAX_SPAN) continue;
      const voicing = Array.from({ length: 6 }, (_, s) => {
        const i = strings.indexOf(s);
        return i < 0 ? null : frets[i];
      });
      grips.push({ inversion, voicing, points: strings.map((s, i) => ({ s, f: frets[i] })) });
    }
  }
  return grips.sort((a, b) => Math.min(...a.points.map(p => p.f)) - Math.min(...b.points.map(p => p.f)));
}

/**
 * The grip a tap at `pos` picks: one with a dot there that isn't the picked
 * one, so a tap on a shared dot moves to the other grip; null to clear.
 */
export function gripAt(grips: readonly Grip[], pos: Position, picked: number | null): number | null {
  const here = grips.flatMap((g, i) => (g.points.some(p => samePos(p, pos)) ? [i] : []));
  return here.find(i => i !== picked) ?? null;
}

export const INVERSION_NAMES = ['Root', '1st', '2nd'] as const;
const INVERSION_TITLES = ['Root position', '1st inversion', '2nd inversion'] as const;
const BASS_NAMES = ['root', '3rd', '5th'] as const;

/** "1st inversion, C/E · 3rd in the bass" */
export function gripCaption(chord: ChordInfo, grip: Grip): string {
  const name = grip.inversion === 0
    ? chord.symbol : `${chord.symbol}/${chord.notes[grip.inversion]}`;
  return `${INVERSION_TITLES[grip.inversion]}, ${name} · ${BASS_NAMES[grip.inversion]} in the bass`;
}
