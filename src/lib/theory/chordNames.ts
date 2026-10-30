import {
  CHORD_ROOTS, CHORD_TYPES, chordOf, withBass, type ChordInfo, type ChordTypeDef,
} from './chords';
import { mod12 } from './notes';

/*
 * Every name for a set of notes, for the Chord lab's "Name it". Each note
 * is tried as the root, and the tones above it are compared with every
 * chord type. The spec (docs/specs/2026-10-05-chord-lab-design.md) gives
 * the rules and the order.
 */

export interface ChordName {
  /** "C", "C/E", "C7 (no 5)". */
  symbol: string;
  /** Why this reading: "root in the bass", "♭3 in the bass", "♭9 in the bass, outside the chord". */
  why: string;
  /** The chord named, with all its tones: labels and shapes come from it. */
  chord: ChordInfo;
}

/**
 * The types a name may be: all but the sus4♯5, which only the Scale lab's
 * Hungarian major stacks. Over a bass it would read every inverted 6th
 * chord as one (G B E over G as Bsus4♯5/F𝄪).
 */
const NAMING_TYPES = CHORD_TYPES.filter(t => t.id !== 'sus4#5');

interface Match {
  type: ChordTypeDef;
  /** Labels of the type's optional tones that weren't played: ["5"]. */
  missing: string[];
}

/** Types with exactly these tones above the root. */
function exactMatches(tones: ReadonlySet<number>): Match[] {
  return NAMING_TYPES
    .filter(t => t.semis.length === tones.size && t.semis.every(s => tones.has(s)))
    .map(type => ({ type, missing: [] }));
}

/**
 * Types that have every played tone and every required tone, so only
 * optional tones are missing. Only those missing the fewest are kept.
 */
function matchesMissingOptional(rootPc: number, tones: ReadonlySet<number>): Match[] {
  const matches = NAMING_TYPES.flatMap(type => {
    if (![...tones].every(s => type.semis.includes(s))) return [];
    const unplayed = unplayedTones(chordOf(CHORD_ROOTS[rootPc], type.id), tones);
    if (unplayed.some(t => t.required)) return [];
    return [{ type, missing: unplayed.map(t => t.label) }];
  });
  const fewest = Math.min(...matches.map(m => m.missing.length));
  return matches.filter(m => m.missing.length === fewest);
}

/** The chord's tones that these tones above its root leave out. */
const unplayedTones = (chord: ChordInfo, tones: ReadonlySet<number>) =>
  chord.tones.filter(t => !tones.has(t.semis));

/**
 * A chord's name over a bass note, with the labels of the tones left out.
 * The bass is a tone of `chord`: one of its type's, or one `withBass` added.
 */
function nameOf(chord: ChordInfo, bassPc: number, missing: string[]): ChordName {
  const bassSemis = mod12(bassPc - chord.rootPc);
  const bassIndex = chord.tones.findIndex(t => t.semis === bassSemis);
  const inBass = bassPc === chord.rootPc;
  const outside = !chord.type?.semis.includes(bassSemis);
  return {
    symbol: chord.symbol
      + (inBass ? '' : `/${chord.notes[bassIndex]}`)
      + (missing.length ? ` (no ${missing.join(', ')})` : ''),
    why: inBass ? 'root in the bass'
      : `${chord.tones[bassIndex].label} in the bass${outside ? ', outside the chord' : ''}`,
    chord,
  };
}

/**
 * The notes named as a voicing of one chord: "Gm7add11 (no 5)". Null when
 * they aren't one: a note isn't a tone of the chord, a tone it needs is
 * left out, or the chord has no name.
 */
export function nameAs(chord: ChordInfo, pcs: readonly number[], bassPc: number): ChordName | null {
  if (!chord.type || !pcs.length) return null;
  const tones = new Set(pcs.map(pc => mod12(pc - chord.rootPc)));
  if (![...tones].every(s => chord.tones.some(t => t.semis === s))) return null;
  const unplayed = unplayedTones(chord, tones);
  if (unplayed.some(t => t.required)) return null;
  return nameOf(chord, mod12(bassPc), unplayed.map(t => t.label));
}

/**
 * Every chord name for the notes (pitch classes 0–11), best first: exact
 * names before ones missing a tone other than the 5th (leaving out the
 * 5th is how guitarists play most chords, so G B E over G is G6 before
 * Em/G), then common types (so C/E comes before Em♯5), then root in the
 * bass, then the Type list's order. Fewer than two different notes have
 * no name.
 *
 * Only when no chord of every note has a name are the notes above the
 * bass named over it as a bass outside the chord (F♯ under F A♭ C E B is
 * Fm(maj7)♯11/G♭), in the same order. That needs three different notes
 * above the bass, none of them the bass's note again.
 *
 * `keep` is the chord whose shape the notes are, when they came from one:
 * its name comes first, whatever else the notes spell (`nameAs`).
 */
export function nameNotes(
  pcs: readonly number[], bassPc: number, keep: ChordInfo | null = null,
): ChordName[] {
  const kept = keep && nameAs(keep, pcs, bassPc);
  const rest = namesFromNotes(pcs, bassPc);
  return kept ? [kept, ...rest.filter(n => n.symbol !== kept.symbol)] : rest;
}

function namesFromNotes(pcs: readonly number[], bassPc: number): ChordName[] {
  const bass = mod12(bassPc);
  const notes = [...new Set(pcs.map(mod12))];
  if (notes.length < 2) return [];
  const above = notes.filter(n => n !== bass);
  const bassOnce = pcs.filter(pc => mod12(pc) === bass).length === 1;

  const inChord = readings(notes, bass, false);
  const ranked = inChord.length || !bassOnce || above.length < 3
    ? inChord
    : readings(above, bass, true);
  return ranked
    .sort((a, b) => a.rank.reduce((diff, r, i) => diff || r - b.rank[i], 0))
    .map(r => r.name);
}

/**
 * Each note of `notes` tried as the root of a chord of them all, named over
 * the bass, and ranked. With `outside`, the bass isn't one of `notes`.
 */
function readings(notes: readonly number[], bassPc: number, outside: boolean) {
  return notes.flatMap(rootPc => {
    const tones = new Set(notes.map(n => mod12(n - rootPc)));
    const exact = exactMatches(tones);
    const matches = exact.length ? exact : matchesMissingOptional(rootPc, tones);
    return matches.map(({ type, missing }) => {
      const chord = chordOf(CHORD_ROOTS[rootPc], type.id);
      const name = nameOf(outside ? withBass(chord, bassPc) : chord, bassPc, missing);
      const rank = [
        missing.some(label => label !== '5') ? 1 : 0,
        type.group === 'Common' ? 0 : 1,
        bassPc === rootPc ? 0 : 1,
        CHORD_TYPES.indexOf(type),
      ];
      return { name, rank };
    });
  });
}
