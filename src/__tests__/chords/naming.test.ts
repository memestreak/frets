import { chordFromTones, chordOf } from '@/lib/chords/chordTypes';
import { nameAs, nameNotes } from '@/features/chords/naming';

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

  it('says why: the tone in the bass', () => {
    const [first] = nameNotes([PC.E, PC.G, PC.C], PC.E);
    expect(first.why).toBe('3 in the bass');
    expect(nameNotes([PC.C, PC.E, PC.G], PC.C)[0].why).toBe('root in the bass');
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
