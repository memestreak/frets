import { CHORD_ROOTS, CHORD_TYPES, chordOf, type ChordInfo, type ChordTypeDef } from './chordTypes';

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
    const chord = chordOf(CHORD_ROOTS[rootPc], type.id);
    const unplayed = chord.tones.filter(t => !tones.has(t.semis));
    if (unplayed.some(t => t.required)) return [];
    return [{ type, missing: unplayed.map(t => t.label) }];
  });
  const fewest = Math.min(...matches.map(m => m.missing.length));
  return matches.filter(m => m.missing.length === fewest);
}

/**
 * Every chord name for the notes (pitch classes 0–11), best first: exact
 * names before ones missing a tone, then common types (so C/E comes before
 * Em♯5), then root in the bass, then the Type list's order. Fewer than two
 * different notes have no name.
 */
export function nameNotes(pcs: readonly number[], bassPc: number): ChordName[] {
  const notes = [...new Set(pcs.map(mod12))];
  if (notes.length < 2) return [];

  const ranked = notes.flatMap(rootPc => {
    const tones = new Set(notes.map(n => mod12(n - rootPc)));
    const exact = exactMatches(tones);
    const matches = exact.length ? exact : matchesMissingOptional(rootPc, tones);
    return matches.map(({ type, missing }) => {
      const chord = chordOf(CHORD_ROOTS[rootPc], type.id);
      const bassIndex = chord.tones.findIndex(t => t.semis === mod12(bassPc - rootPc));
      const inBass = bassPc === rootPc;
      const name: ChordName = {
        symbol: chord.symbol
          + (inBass ? '' : `/${chord.notes[bassIndex]}`)
          + (missing.length ? ` (no ${missing.join(', ')})` : ''),
        why: inBass ? 'root in the bass' : `${chord.tones[bassIndex].label} in the bass`,
        chord,
      };
      const rank = [
        missing.length ? 1 : 0,
        type.group === 'Common' ? 0 : 1,
        inBass ? 0 : 1,
        CHORD_TYPES.indexOf(type),
      ];
      return { name, rank };
    });
  });

  return ranked
    .sort((a, b) => a.rank.reduce((diff, r, i) => diff || r - b.rank[i], 0))
    .map(r => r.name);
}
