import { chordFromTones } from '@/lib/chords/chordTypes';
import { nameNotes } from '@/features/chords/naming';

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
