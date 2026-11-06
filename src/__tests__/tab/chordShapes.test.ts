/**
 * What the Chords panel and its chord editor share (`docs/specs/2026-11-05-tab-chord-panel-design.md`):
 * the names and fingering of a column's notes, and the chord a shape's diagram is drawn with.
 */
import { emptyPart, type Column } from '@/features/tab/clip';
import { chordToDraw, fretsOfColumn, namesForColumn, namesForFrets } from '@/features/tab/chordShapes';

/** A column with these frets, high e first (null for a string not played). */
const columnOf = (frets: (number | null)[]): Column => ({ notes: frets.map(fret => (fret === null ? null : { fret })) }) as Column;
/** The open C shape, high e first. */
const C = [0, 1, 0, 2, 3, null];

describe('a column’s notes', () => {
  it('a column of two or more fretted notes is a fingering; one note isn’t', () => {
    expect(fretsOfColumn(columnOf(C))).toEqual(C);
    expect(fretsOfColumn(columnOf([3, null, null, null, null, null]))).toBeNull();
    expect(fretsOfColumn(null)).toBeNull();
  });

  it('names the notes, the best first', () => {
    expect(namesForColumn(emptyPart(), columnOf(C))[0]).toBe('C');
    expect(namesForColumn(emptyPart(), columnOf([3, null, null, null, null, null]))).toEqual([]);
  });

  it('names a shape from the capo, as a name’s shapes are: the C shape is C at any capo', () => {
    expect(namesForFrets({ ...emptyPart(), capo: 2 }, C)[0]).toBe('C');
  });
});

describe('the chord a diagram is drawn with', () => {
  it('the name’s chord when the shape’s notes are its tones', () => {
    expect(chordToDraw(emptyPart(), 'C', [...C].reverse())?.rootPc).toBe(0);
  });

  it('else the chord the notes are: a C shape under the name Dsus2, or under a name that isn’t a chord', () => {
    const shape = [...C].reverse();
    expect(chordToDraw(emptyPart(), 'Dsus2', shape)?.rootPc).toBe(0);
    expect(chordToDraw(emptyPart(), 'My C', shape)?.rootPc).toBe(0);
  });

  it('none for one note, which no chord is', () => {
    expect(chordToDraw(emptyPart(), 'Riff', [null, null, null, null, null, 3])).toBeNull();
  });
});
