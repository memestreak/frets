/**
 * A chord named from picked notes (issue #464, `docs/specs/2026-11-13-tab-chord-from-notes-design.md`): a
 * column or a run of columns read as one chord, counted from the capo; its shape each string's first note;
 * every Voice in the selection's time; and written over the first column, its shape in the Chord set under a
 * free name when its name already has another shape.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writePart } from '@/features/tab/alphatex';
import { chordFromNotes, writeChordFromNotes } from '@/features/tab/chordFromNotes';
import { partOf, type Part } from '@/features/tab/clip';
import type { Selection } from '@/features/tab/editing';

function partFrom(tex: string, voice = 0): Part {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip, 0, voice);
}
const cols = (from: number, to: number): Selection => ({ anchor: from, focus: to });

describe('chordFromNotes', () => {
  it('names the shape counted from the capo: 5 5 5 7 under Capo 2 is Am (it sounds Bm)', () => {
    const part = partFrom('\\capo 2 (5.1 5.2 5.3 7.4).8 r.8 r.4 r.2 |');
    expect(chordFromNotes(part, cols(0, 0))).toEqual({ name: 'Am', frets: [5, 5, 5, 7, null, null] });
    // With the sounding name chosen (Settings › Tab › Editing), the capo counts: Bm, the shape the same.
    expect(chordFromNotes(part, cols(0, 0), 'sounding')).toEqual({ name: 'Bm', frets: [5, 5, 5, 7, null, null] });
  });

  it('reads an arpeggio spread over several beats as one chord', () => {
    const part = partFrom('0.5.8 2.4.8 2.3.8 1.2.8 0.1.8 1.2.8 2.3.8 2.4.8 |');
    expect(chordFromNotes(part, cols(0, 7))).toEqual({ name: 'Am', frets: [0, 1, 2, 2, 0, null] });
  });

  it('names a broken chord (part of one) with what it leaves out', () => {
    // C, E and B♭ of a C7: its 5th left out.
    const part = partFrom('3.5.4 2.4.4 3.3.4 r.4 |');
    expect(chordFromNotes(part, cols(0, 2))).toEqual({ name: 'C7no5', frets: [null, null, 3, 2, 3, null] });
    // Two notes alone (but a 5th) aren't a chord Frets names.
    expect(chordFromNotes(part, cols(0, 1))).toEqual({ problem: expect.stringContaining('can’t name') });
  });

  it('takes each string’s first picked note for the shape, and lets every note count for the name', () => {
    // G B D, then the B string again at fret 3 (D): still G, the shape keeps the first B (open).
    const part = partFrom('3.6.4 0.2.4 0.3.4 3.2.4 |');
    expect(chordFromNotes(part, cols(0, 3))).toEqual({ name: 'G', frets: [null, 0, 0, null, null, 3] });
  });

  it('counts the notes of every Voice in the selection’s time: a bass in Voice 2 makes a slash chord', () => {
    // Voice 1 arpeggiates C E G; Voice 2 holds the low E under it.
    const part = partFrom('\\voiceMode barWise \\voice 1.2.4 0.1.4 0.3.4 0.1.4 \\voice 0.6.1 |');
    expect(chordFromNotes(part, cols(0, 3))).toEqual({ name: 'C/E', frets: [0, 1, 0, null, null, 0] });
    // From Voice 2's side the same time holds Voice 1's notes.
    expect(chordFromNotes(partFrom('\\voiceMode barWise \\voice 1.2.4 0.1.4 0.3.4 0.1.4 \\voice 0.6.1 |', 1), cols(0, 0))).toEqual({ name: 'C/E', frets: [0, 1, 0, null, null, 0] });
  });

  it('refuses fewer than two different notes, and notes no chord spells', () => {
    expect(chordFromNotes(partFrom('5.1.4 5.1.4 17.1.4 r.4 |'), cols(0, 2))).toEqual({ problem: expect.stringContaining('two different notes') });
    // C C♯ D D♯ E: no chord type has them all.
    const cluster = partFrom('1.2.4 2.2.4 3.2.4 4.2.4 5.2.4 r.4 r.4 r.4 |');
    expect(chordFromNotes(cluster, cols(0, 4))).toEqual({ problem: expect.stringContaining('can’t name') });
  });

  it('says to pick notes first when the columns hold only rests or dead notes', () => {
    expect(chordFromNotes(partFrom('r.1 |'), cols(0, 0))).toEqual({ problem: expect.stringContaining('Pick some notes first') });
    expect(chordFromNotes(partFrom('x.1.4 x.2.4 r.2 |'), cols(0, 2))).toEqual({ problem: expect.stringContaining('Pick some notes first') });
  });

  it('skips dead notes and rests', () => {
    const part = partFrom('x.6.8 0.5.8 r.8 2.4.8 2.3.8 1.2.8 r.4 |');
    expect(chordFromNotes(part, cols(0, 5))).toEqual({ name: 'Am', frets: [null, 1, 2, 2, 0, null] });
  });
});

describe('writeChordFromNotes', () => {
  const at = { bar: 0, column: 0, string: 0 };

  it('writes the name over the column and adds the shape to the Chord set', () => {
    const part = partFrom('(0.1 1.2 2.3 2.4 0.5).4 r.4 r.2 |');
    const { part: next, name } = writeChordFromNotes(part, at, 'Am', [0, 1, 2, 2, 0, null]);
    expect(name).toBe('Am');
    expect(writePart(next)).toContain('\\chord ("Am" 0 1 2 2 0 x)');
    expect(writePart(next)).toContain('(0.1 1.2 2.3 2.4 0.5).4{ch "Am"}');
  });

  it('uses a chord the set already has with the same shape again, adding nothing', () => {
    const part = partFrom('\\chord ("Am" 0 1 2 2 0 x) (0.1 1.2 2.3 2.4 0.5).4 r.4 r.2 |');
    const { part: next, name } = writeChordFromNotes(part, at, 'Am', [0, 1, 2, 2, 0, null]);
    expect(name).toBe('Am');
    expect(next.chords).toEqual(part.chords);
  });

  it('adds a chord whose name the set has with another shape under a free name, leaving the other alone', () => {
    const part = partFrom('\\chord ("Am" 0 1 2 2 0 x) (0.1 1.2 2.3 2.4 0.5).4{ch "Am"} (5.1 5.2 5.3 7.4).4 r.2 |');
    const { part: next, name } = writeChordFromNotes(part, { ...at, column: 1 }, 'Am', [5, 5, 5, 7, null, null]);
    expect(name).toBe('Am 2');
    expect(next.chords).toEqual([{ name: 'Am', frets: [0, 1, 2, 2, 0, null] }, { name: 'Am 2', frets: [5, 5, 5, 7, null, null] }]);
    expect(next.bars[0].columns.map(c => c.chord)).toEqual(['Am', 'Am 2', undefined]);
  });

  it('treats a name only typed over a column as taken by the shape it is drawn with', () => {
    // "C" typed with no definition is drawn with C's first shape (x32010); a 3rd-fret C barre is another.
    const part = partFrom('r.4{ch "C"} (3.1 5.2 5.3 5.4 3.5).4 r.2 |');
    const { name } = writeChordFromNotes(part, { ...at, column: 1 }, 'C', [3, 5, 5, 5, 3, null]);
    expect(name).toBe('C 2');
    const same = writeChordFromNotes(part, { ...at, column: 1 }, 'C', [0, 1, 0, 2, 3, null]);
    expect(same.name).toBe('C');
  });

  it('replaces a name the column had', () => {
    const part = partFrom('(0.1 1.2 2.3 2.4 0.5).4{ch "X"} r.4 r.2 |');
    const { part: next } = writeChordFromNotes(part, at, 'Am', [0, 1, 2, 2, 0, null]);
    expect(next.bars[0].columns[0].chord).toBe('Am');
  });
});
