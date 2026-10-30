import { CHORD_ROOTS, CHORD_TYPES, type ChordRoot } from './chords';

/*
 * Reads a chord name typed or pasted into the Chords page's search box
 * (docs/specs/2026-10-16-chord-search-design.md): a root, then a type in
 * any of the ways it is commonly written. Generous about everything but
 * a lone M or m, which tell major from minor.
 */

export interface FoundChord {
  root: ChordRoot;
  /** A `ChordTypeDef` id. */
  type: string;
}

/** Words spelled out, as a chord's type is, in their short form. */
const WORDS: readonly [RegExp, string][] = [
  [/major/gi, 'maj'], [/minor/gi, 'min'], [/diminished/gi, 'dim'],
  [/augmented/gi, 'aug'], [/dominant/gi, 'dom'], [/suspended/gi, 'sus'],
  [/flat/gi, 'b'], [/sharp/gi, '#'],
  [/maj|min|dim|aug|dom|sus|add|alt|quartal|phryg/gi, ''],
];

/**
 * One spelling for every way a type is written. Spaces, brackets and
 * commas go ("7(b9, #11)" is "7b9#11"), so do ordinals ("7th"); ♭ ♯ are
 * b #, Δ is maj; words are lower case; then every letter but M is lower case, so
 * "M7" stays major and "m7" minor.
 */
export function normalizeType(text: string): string {
  let s = text
    .replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[−–—]/g, '-')
    .replace(/º/g, '°').replace(/Ø/g, 'ø')
    // Δ is maj before a number ("Δ9") and maj7 alone ("Δ", "Δ#11").
    .replace(/[Δ△](?=\d)/g, 'maj').replace(/[Δ△]/g, 'maj7')
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    // A hyphen inside a word, as in "half-diminished": a hyphen alone means minor.
    .replace(/([a-z])-(?=[a-z])/gi, '$1')
    .replace(/[\s()[\],]/g, '');
  for (const [word, short] of WORDS) {
    s = s.replace(word, w => short || w.toLowerCase());
  }
  return s.replace(/[A-LN-Z]/g, c => c.toLowerCase());
}

/** Each type by every spelling of its aliases, its symbol and its name. */
const TYPE_BY_SPELLING: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const t of CHORD_TYPES) {
    for (const spelling of [...t.aliases, t.symbol, t.name]) {
      // A name is never empty: an empty alias is major's (a bare root).
      if (spelling === t.name && !spelling) continue;
      const key = normalizeType(spelling);
      if (!map.has(key)) map.set(key, t.id);
    }
  }
  return map;
})();

const LETTER_SEMIS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

const ROOT = /^([A-Ga-g])(##|bb|#|b|♯♯|♭♭|♯|♭|𝄪|𝄫)?/u;
/** A bass note after a slash, left off: "Am7/G" is found as Am7. */
const SLASH_BASS = /\/\s*[A-Ga-g](?:##|bb|#|b|♯|♭)?\s*$/u;

function accidentalSemis(acc: string): number {
  if (/^(##|♯♯|𝄪)$/u.test(acc)) return 2;
  if (/^(bb|♭♭|𝄫)$/u.test(acc)) return -2;
  if (/^(#|♯)$/u.test(acc)) return 1;
  if (/^(b|♭)$/u.test(acc)) return -1;
  return 0;
}

/** The chord root at that pitch: Chords spells each pitch one way, C to B. */
const rootAt = (letter: string, acc: string): ChordRoot =>
  CHORD_ROOTS[(LETTER_SEMIS[letter.toLowerCase()] + accidentalSemis(acc) + 12) % 12];

/**
 * The chord a name spells, or null. "Am7", "a min7", "A minor seventh",
 * "Am7/G" and "A-7" all give A and m7. A root's accidental is read as one
 * where it can be: "Ab9sus" is A♭9sus4, not A and ♭9sus.
 */
export function findChord(text: string): FoundChord | null {
  const name = text.trim().replace(SLASH_BASS, '').trim();
  const m = ROOT.exec(name);
  if (!m) return null;
  const [, letter, acc = ''] = m;
  // The accidental as part of the root, then as part of the type.
  for (const rootAcc of acc ? [acc, ''] : ['']) {
    const type = TYPE_BY_SPELLING.get(normalizeType(name.slice(1 + rootAcc.length)));
    if (type !== undefined) return { root: rootAt(letter, rootAcc), type };
  }
  return null;
}
