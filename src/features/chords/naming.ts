import { CHORD_ROOTS, CHORD_TYPES, chordOf, type ChordInfo, type ChordTypeDef } from '@/lib/chords/chordTypes';

/*
 * Every name for a set of notes, for the Chord lab's "Name it". Each note
 * is tried as the root, and the tones above it are compared with every
 * chord type. The spec (docs/specs/2026-10-05-chord-lab-design.md) gives
 * the rules and the order.
 */

export interface ChordName {
  /** "C", "C/E", "C7 (no 5)". */
  symbol: string;
  /** Why this reading: "root in the bass", "♭3 in the bass". */
  why: string;
  /** The chord named, with all its tones: labels and shapes come from it. */
  chord: ChordInfo;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

interface Match {
  type: ChordTypeDef;
  /** Labels of the type's optional tones that weren't played: ["5"]. */
  missing: string[];
}

/** Types with exactly these tones above the root. */
function exactMatches(tones: ReadonlySet<number>): Match[] {
  return CHORD_TYPES
    .filter(t => t.semis.length === tones.size && t.semis.every(s => tones.has(s)))
    .map(type => ({ type, missing: [] }));
}

/**
 * Types that have every played tone and every required tone, so only
 * optional tones are missing. Only those missing the fewest are kept.
 */
function matchesMissingOptional(rootPc: number, tones: ReadonlySet<number>): Match[] {
  const matches = CHORD_TYPES.flatMap(type => {
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

/** A chord's name over a bass note, with the labels of the tones left out. */
function nameOf(chord: ChordInfo, bassPc: number, missing: string[]): ChordName {
  const bassIndex = chord.tones.findIndex(t => t.semis === mod12(bassPc - chord.rootPc));
  const inBass = bassPc === chord.rootPc;
  return {
    symbol: chord.symbol
      + (inBass ? '' : `/${chord.notes[bassIndex]}`)
      + (missing.length ? ` (no ${missing.join(', ')})` : ''),
    why: inBass ? 'root in the bass' : `${chord.tones[bassIndex].label} in the bass`,
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
  if (![...tones].every(s => chord.type!.semis.includes(s))) return null;
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
  const notes = [...new Set(pcs.map(mod12))];
  if (notes.length < 2) return [];

  const ranked = notes.flatMap(rootPc => {
    const tones = new Set(notes.map(n => mod12(n - rootPc)));
    const exact = exactMatches(tones);
    const matches = exact.length ? exact : matchesMissingOptional(rootPc, tones);
    return matches.map(({ type, missing }) => {
      const name = nameOf(chordOf(CHORD_ROOTS[rootPc], type.id), bassPc, missing);
      const rank = [
        missing.some(label => label !== '5') ? 1 : 0,
        type.group === 'Common' ? 0 : 1,
        bassPc === rootPc ? 0 : 1,
        CHORD_TYPES.indexOf(type),
      ];
      return { name, rank };
    });
  });

  return ranked
    .sort((a, b) => a.rank.reduce((diff, r, i) => diff || r - b.rank[i], 0))
    .map(r => r.name);
}
