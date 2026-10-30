import { chordFromTones, chordOf } from '@/lib/theory/chords';
import { nameAs, nameNotes } from '@/lib/theory/chordNames';

const PC: Record<string, number> = {
  C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
};
/** Every name for these notes, the first one the bass. */
const names = (...notes: string[]) =>
  nameNotes(notes.map(n => PC[n]), PC[notes[0]]).map(n => n.symbol);

describe('nameNotes', () => {
  it('names a triad with its root in the bass, and its inversions as slash chords', () => {
    expect(names('C', 'E', 'G')[0]).toBe('C');
    expect(names('E', 'G', 'C')[0]).toBe('C/E');
    expect(names('G', 'C', 'E')[0]).toBe('C/G');
  });

  it('lists rarer readings after the common ones', () => {
    expect(names('E', 'G', 'C')).toEqual(['C/E', 'Em♯5']);
  });

  it('puts the root in the bass first among common chords', () => {
    expect(names('A', 'C', 'E', 'G')).toEqual(['Am7', 'C6/A']);
    expect(names('C', 'E', 'G', 'A')).toEqual(['C6', 'Am7/C']);
  });

  it('gives both names when two chord types have the same tones', () => {
    expect(names('C', 'D', 'F', 'G', 'Bb')).toEqual(expect.arrayContaining(['C11', 'C9sus4']));
  });

  it('names a chord missing an optional tone, and says which', () => {
    expect(names('C', 'E', 'B')[0]).toBe('Cmaj7 (no 5)');
  });

  it('names a major chord with an added 9th and 11th', () => {
    // x 5 4 0 3 0: D F♯ G D E, a common Em9 (no 5) over its ♭7 first.
    expect(names('D', 'F#', 'G', 'D', 'E')).toEqual(['Em9/D (no 5)', 'Dadd9(add11) (no 5)']);
    expect(names('C', 'E', 'G', 'F')[0]).toBe('Cadd11');
  });

  it('puts a chord missing only its 5th, root in the bass, before an inversion', () => {
    // x 10 9 0 8 0: G B G G E.
    expect(names('G', 'B', 'G', 'G', 'E')).toEqual(['G6 (no 5)', 'Em/G']);
  });

  it('says why: the tone in the bass', () => {
    const [first] = nameNotes([PC.E, PC.G, PC.C], PC.E);
    expect(first.why).toBe('3 in the bass');
    expect(nameNotes([PC.C, PC.E, PC.G], PC.C)[0].why).toBe('root in the bass');
  });

  it('names the notes over a bass outside the chord when nothing else names them', () => {
    // 2 2 2 1 1 1: F♯ B E G♯ C F, Fm(maj7)♯11 over a G♭ bass.
    const [first] = nameNotes(['F#', 'B', 'E', 'Ab', 'C', 'F'].map(n => PC[n]), PC['F#']);
    expect(first.symbol).toBe('Fm(maj7)♯11/G♭');
    expect(first.why).toBe('♭9 in the bass, outside the chord');
    expect(first.chord.notes).toEqual(['F', 'A♭', 'C', 'E', 'B', 'G♭']);
    expect(first.chord.tones.at(-1)?.label).toBe('♭9');
  });

  it('keeps a bass outside the chord out of names that have one inside it', () => {
    expect(names('G', 'F', 'Bb', 'C')).not.toContain('Fsus4/G');
    // Two notes above the bass are too few to name a chord over it.
    expect(names('C', 'Db', 'D')).toEqual([]);
  });

  it('keeps a chord named over a bass outside it', () => {
    const notes = ['F#', 'B', 'E', 'Ab', 'C', 'F'].map(n => PC[n]);
    const [first] = nameNotes(notes, PC['F#']);
    expect(nameAs(first.chord, notes, PC['F#'])?.symbol).toBe('Fm(maj7)♯11/G♭');
  });

  it('names a fifth as a power chord, and nothing for one note or a cluster', () => {
    expect(names('C', 'G')).toEqual(['C5']);
    expect(names('C', 'C')).toEqual([]);
    expect(names('C', 'Db', 'D')).toEqual([]);
  });
});

describe('a shape of a kept chord', () => {
  const gm7add11 = chordOf('G', 'm7add11');
  /** 3-x-3-3-1-x: Gm7add11 without its 5th, which is every tone of C7sus4. */
  const NO_FIFTH = ['G', 'F', 'Bb', 'C'].map(n => PC[n]);

  it('reads as another chord from its notes alone', () => {
    expect(names('G', 'F', 'Bb', 'C')).toEqual(['C7sus4/G', 'G4', 'Fsus24/G']);
  });

  it('names the kept chord first, then what else the notes spell', () => {
    const kept = nameNotes(NO_FIFTH, PC.G, gm7add11);
    expect(kept.map(n => n.symbol)).toEqual(['Gm7add11 (no 5)', 'C7sus4/G', 'G4', 'Fsus24/G']);
    expect(kept[0].chord).toBe(gm7add11);
  });

  it('lists the kept chord once when the notes already name it', () => {
    const all = ['G', 'D', 'F', 'Bb', 'C'].map(n => PC[n]);
    const kept = nameNotes(all, PC.G, gm7add11).map(n => n.symbol);
    expect(kept[0]).toBe('Gm7add11');
    expect(kept.filter(n => n === 'Gm7add11')).toHaveLength(1);
  });

  it('names a kept chord over another bass note', () => {
    expect(nameAs(chordOf('C', 'M'), [PC.E, PC.G, PC.C], PC.E)?.symbol).toBe('C/E');
  });

  it('does not keep a chord the notes are not a shape of', () => {
    expect(nameAs(gm7add11, [PC.G, PC.B, PC.D], PC.G)).toBeNull(); // B isn't in it
    expect(nameAs(gm7add11, [PC.G, PC.D, PC.F], PC.G)).toBeNull(); // no ♭3 or 11
    expect(nameAs(chordFromTones(0, [0, 1, 2]), [0, 1, 2], 0)).toBeNull(); // no name
    expect(names('G', 'B', 'D')).toEqual(nameNotes([PC.G, PC.B, PC.D], PC.G, gm7add11).map(n => n.symbol));
  });
});

describe('chordFromTones', () => {
  it('finds the chord type with exactly those tones', () => {
    const chord = chordFromTones(9, [0, 3, 7, 10]);
    expect(chord.symbol).toBe('Am7');
  });

  it('labels a set no type has with plain interval names', () => {
    const chord = chordFromTones(0, [0, 1, 2]);
    expect(chord.type).toBeNull();
    expect(chord.symbol).toBe('');
    expect(chord.tones.map(t => t.label)).toEqual(['R', '♭2', '2']);
    expect(chord.notes).toEqual(['C', 'D♭', 'D']);
  });
});
