import { findChord, normalizeType } from '@/features/chords/chordSearch';
import { CHORD_TYPES } from '@/lib/chords/chordTypes';

const found = (text: string) => {
  const chord = findChord(text);
  return chord && `${chord.root} ${chord.type}`;
};

describe('findChord', () => {
  it('reads a root and a type symbol', () => {
    expect(found('Am7')).toBe('A m7');
    expect(found('F#m7b5')).toBe('F# m7b5');
    expect(found('Cmaj9')).toBe('C maj9');
    expect(found('E7#9')).toBe('E 7#9');
    expect(found('C')).toBe('C M');
  });

  it('ignores case but for a lone M or m', () => {
    expect(found('am7')).toBe('A m7');
    expect(found('AM7')).toBe('A maj7');
    expect(found('CMAJ7')).toBe('C maj7');
    expect(found('CMadd9')).toBe('C Madd9');
    expect(found('Cmadd9')).toBe('C madd9');
    expect(found('C7SUS4')).toBe('C 7sus4');
  });

  it('finds every type by its id, its symbol and each alias', () => {
    for (const t of CHORD_TYPES) {
      for (const spelling of [t.id, t.symbol, ...t.aliases]) {
        // A space keeps "b9sus" from reading as D♭ 9sus.
        expect(found(`D ${spelling}`)).toBe(`D ${t.id}`);
      }
    }
  });

  it('takes the common alternates and the names written out', () => {
    expect(found('Cmin7')).toBe('C m7');
    expect(found('C-7')).toBe('C m7');
    expect(found('C−7')).toBe('C m7');
    expect(found('CΔ7')).toBe('C maj7');
    expect(found('CΔ')).toBe('C maj7');
    expect(found('Bø')).toBe('B m7b5');
    expect(found('Bb°7')).toBe('Bb dim7');
    expect(found('C+')).toBe('C aug');
    expect(found('A minor seventh')).toBe('A m7');
    expect(found('C major')).toBe('C M');
    expect(found('C dominant seventh')).toBe('C 7');
    expect(found('C half-diminished')).toBe('C m7b5');
    expect(found('C 7th')).toBe('C 7');
  });

  it('ignores spaces, brackets, commas and ♭ ♯ as b #', () => {
    expect(found('  C maj 7 ')).toBe('C maj7');
    expect(found('C7(b9)')).toBe('C 7b9');
    expect(found('C7(b9, #11)')).toBe('C 7b9#11');
    expect(found('Cm(maj7)')).toBe('C m/ma7');
    expect(found('f♯m7♭5')).toBe('F# m7b5');
  });

  it('leaves off a slash bass but keeps 6/9', () => {
    expect(found('Am7/G')).toBe('A m7');
    expect(found('D/F#')).toBe('D M');
    expect(found('C6/9')).toBe('C 6add9');
  });

  it('spells the root as the Chords page does', () => {
    expect(found('C#m')).toBe('Db m');
    expect(found('Gb7')).toBe('F# 7');
    expect(found('Cb')).toBe('B M');
    expect(found('E#m')).toBe('F m');
  });

  it('reads an accidental as the root’s where it can', () => {
    expect(found('Ab9sus')).toBe('Ab 9sus4');
    expect(found('Bb')).toBe('Bb M');
  });

  it('finds nothing for what is not a chord', () => {
    expect(found('')).toBeNull();
    expect(found('Hm7')).toBeNull();
    expect(found('Am8')).toBeNull();
    expect(found('hello')).toBeNull();
  });
});

describe('normalizeType', () => {
  it('gives no two types the same spelling', () => {
    const owner = new Map<string, string>();
    for (const t of CHORD_TYPES) {
      for (const spelling of [t.symbol, ...t.aliases]) {
        const key = normalizeType(spelling);
        expect(owner.get(key) ?? t.id).toBe(t.id);
        owner.set(key, t.id);
      }
    }
  });
});
