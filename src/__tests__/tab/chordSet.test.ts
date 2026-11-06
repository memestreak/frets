/**
 * A track's Chord set (`docs/specs/2026-11-05-tab-chord-set-design.md`): `\chord` definitions kept with
 * their shapes, symbols pointing at them by name, typed names joining the set, names understood.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { setChordName } from '@/features/tab/barEdits';
import { chordDefOf, chordSet, withChordShape, withNewChord, withRenamedChord, type ChordDef } from '@/features/tab/chordSet';
import { parseClip, partOf, withPart, type Clip } from '@/features/tab/clip';
import { readChordName } from '@/lib/theory/chordSearch';

function read(text: string): { clip: Clip; warnings: string[] } {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}

const FULL = [
  '\\ts (4 4)',
  '\\chord ("Am7" 0 1 0 2 0 x) {firstfret 1 showdiagram true showfingering false showname true}',
  '\\chord ("F" 1 1 2 3 3 1) {firstfret 1 barre 1}',
  '\\chord ("Bm7b5" x 3 2 3 2 x) {barre (2 3) showdiagram false}',
  '0.5.4{ch "Am7"} r.4{ch "F"} r.4{ch "Bm7b5"} r.4 |',
  '',
].join('\n');

describe('the Chord set in alphaTex', () => {
  it('reads every property of a \\chord and writes it back unchanged, with no warning', () => {
    const { clip, warnings } = read(FULL);
    expect(warnings).toEqual([]);
    expect(clip.tracks[0].chords).toEqual([
      { name: 'Am7', frets: [0, 1, 0, 2, 0, null], firstFret: 1, showDiagram: true, showFingering: false, showName: true },
      { name: 'F', frets: [1, 1, 2, 3, 3, 1], firstFret: 1, barre: [1] },
      { name: 'Bm7b5', frets: [null, 3, 2, 3, 2, null], barre: [2, 3], showDiagram: false },
    ]);
    expect(writeAlphaTex(clip)).toBe(FULL);
  });

  it('keeps a \\chord no column names (an unused chord)', () => {
    const text = '\\ts (4 4)\n\\chord ("G" 3 0 0 0 2 3)\n0.5.4 r.4 r.2 |\n';
    const { clip } = read(text);
    expect(chordSet(clip.tracks[0])).toEqual([
      { name: 'G', def: { name: 'G', frets: [3, 0, 0, 0, 2, 3] }, uses: 0, reading: { root: 'G', type: 'M' } },
    ]);
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('keeps two definitions of one name with different shapes; symbols point at the last, as alphaTab links them', () => {
    const text = '\\ts (4 4)\n\\chord ("A" 0 2 2 2 0 x)\n\\chord ("A" 5 5 6 7 7 5)\n0.5.4{ch "A"} r.4 r.2 |\n';
    const { clip } = read(text);
    const set = chordSet(clip.tracks[0]);
    expect(set.map(e => [e.name, e.def?.frets, e.uses])).toEqual([
      ['A', [0, 2, 2, 2, 0, null], 0],
      ['A', [5, 5, 6, 7, 7, 5], 1],
    ]);
    expect(chordDefOf(clip.tracks[0].chords, 'A')?.frets).toEqual([5, 5, 6, 7, 7, 5]);
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('reads each symbol as written, case and all, though alphaTab links "AM7" and "Am7" as one', () => {
    const { clip } = read('\\ts (4 4)\n0.5.4{ch "AM7"} r.4{ch "Am7"} r.2 |\n');
    expect(clip.tracks[0].bars[0].voices[0].map(c => c.chord)).toEqual(['AM7', 'Am7', undefined]);
    expect(chordSet(clip.tracks[0]).map(e => e.name)).toEqual(['AM7', 'Am7']);
  });

  it('reads a \\chord with fewer strings as the rest not played, and x or a negative fret as not played', () => {
    const { clip } = read('\\ts (4 4)\n\\chord ("C" 0 1 0 2 3)\n\\chord ("D" 2 3 2 0 -1 x)\n0.5.1 |\n');
    expect(clip.tracks[0].chords?.map(d => d.frets)).toEqual([[0, 1, 0, 2, 3, null], [2, 3, 2, 0, null, null]]);
    expect(writeAlphaTex(clip)).toContain('\\chord ("C" 0 1 0 2 3 x)\n\\chord ("D" 2 3 2 0 x x)');
  });

  it('names strings past six and reads the first six', () => {
    const { clip, warnings } = read('\\ts (4 4)\n\\chord ("C" 0 1 0 2 3 x 3)\n0.5.1 |\n');
    expect(clip.tracks[0].chords?.[0].frets).toEqual([0, 1, 0, 2, 3, null]);
    expect(warnings).toContain('\\chord "C" gives 7 strings; read the first 6.');
  });

  it('keeps a \\chord with no strings, as written', () => {
    const text = '\\ts (4 4)\n\\chord ("N.C.")\n0.5.4{ch "N.C."} r.4 r.2 |\n';
    const { clip } = read(text);
    expect(clip.tracks[0].chords).toEqual([{ name: 'N.C.' }]);
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('keeps each track\'s set on its own staff', () => {
    const text = [
      '\\track "Gtr I"',
      '\\ts (4 4)',
      '\\chord ("E5" 0 x x x 2 0)',
      '0.6.4{ch "E5"} r.4 r.2 |',
      '\\track "Gtr II"',
      '\\chord ("E5" x x x 9 7 7)',
      '\\chord ("A5" x x x 2 2 0)',
      '7.5.4{ch "E5"} r.4{ch "A5"} r.2 |',
      '',
    ].join('\n');
    const { clip } = read(text);
    expect(clip.tracks.map(t => t.chords?.map(d => `${d.name} ${d.frets?.join(',')}`))).toEqual([
      ['E5 0,,,,2,0'],
      ['E5 ,,,9,7,7', 'A5 ,,,2,2,0'],
    ]);
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('is kept in storage, and a stored set is checked', () => {
    const { clip } = read(FULL);
    expect(parseClip(JSON.parse(JSON.stringify(clip)))?.tracks[0].chords).toEqual(clip.tracks[0].chords);
    const bad = JSON.parse(JSON.stringify(clip));
    bad.tracks[0].chords[0].frets = [0, 1];
    expect(parseClip(bad)).toBeNull();
  });
});

describe('typed names', () => {
  const text = '\\ts (4 4)\n\\chord ("Am7" 0 1 0 2 0 x)\n0.5.4 r.4 r.2 |\n';

  it('a new name joins the set with no shape; an existing one points at its entry', () => {
    const { clip } = read(text);
    let part = partOf(clip);
    part = setChordName(part, { bar: 0, column: 0, string: 0 }, 'Dm7');
    part = setChordName(part, { bar: 0, column: 1, string: 0 }, 'Am7');
    const edited = withPart(clip, part);
    expect(chordSet(edited.tracks[0]).map(e => [e.name, e.def ? 'shape' : 'no shape', e.uses])).toEqual([
      ['Am7', 'shape', 1],
      ['Dm7', 'no shape', 1],
    ]);
    // The new name is written as its symbol alone; the definitions stay.
    expect(writeAlphaTex(edited)).toBe('\\ts (4 4)\n\\chord ("Am7" 0 1 0 2 0 x)\n0.5.4{ch "Dm7"} r.4{ch "Am7"} r.2 |\n');
  });

  it('a name typed and cleared leaves the set; a definition stays when its last symbol goes', () => {
    const { clip } = read('\\ts (4 4)\n\\chord ("Am7" 0 1 0 2 0 x)\n0.5.4{ch "Am7"} r.4{ch "Dm7"} r.2 |\n');
    let part = partOf(clip);
    part = setChordName(part, { bar: 0, column: 0, string: 0 }, '');
    part = setChordName(part, { bar: 0, column: 1, string: 0 }, '');
    expect(chordSet(withPart(clip, part).tracks[0]).map(e => [e.name, e.uses])).toEqual([['Am7', 0]]);
  });
});

describe('names understood', () => {
  it('reads root, type and bass', () => {
    expect(readChordName('Am7')).toEqual({ root: 'A', type: 'm7' });
    expect(readChordName('C/G')).toEqual({ root: 'C', type: 'M', bass: 'G' });
    expect(readChordName('F#m7b5')).toEqual({ root: 'F#', type: 'm7b5' });
  });

  it('leaves a name that isn\'t a chord as plain text', () => {
    expect(readChordName('N.C.')).toBeNull();
    expect(readChordName('Hendrix chord')).toBeNull();
    const { clip, warnings } = read('\\ts (4 4)\n0.5.4{ch "N.C."} r.4 r.2 |\n');
    expect(warnings).toEqual([]);
    expect(chordSet(clip.tracks[0])).toEqual([{ name: 'N.C.', uses: 1, reading: null }]);
  });
});

describe('changing the Chord set from the Chords panel (issue #251)', () => {
  const G = [3, 0, 0, 0, 2, 3];
  const G_OTHER = [3, 3, 0, 0, 2, 3];

  it('gives the definition symbols point at (the last of the name) the new shape, keeping its show props', () => {
    const track = { chords: [
      { name: 'G', frets: [1, 1, 1, 1, 1, 1] },
      { name: 'G', frets: G, firstFret: 1, barre: [3], showDiagram: false, showName: true },
    ] };
    const next = withChordShape(track, 'G', G_OTHER);
    expect(next.chords).toEqual([
      { name: 'G', frets: [1, 1, 1, 1, 1, 1] },
      { name: 'G', frets: G_OTHER, showDiagram: false, showName: true },
    ]);
    // The track it was given is not changed.
    expect(track.chords[1].frets).toBe(G);
  });

  it('adds a definition, at the end, for a name with none; names match case and all', () => {
    expect(withChordShape<{ chords?: ChordDef[] }>({}, 'Am', [0, 1, 2, 2, 0, null]).chords).toEqual([{ name: 'Am', frets: [0, 1, 2, 2, 0, null] }]);
    expect(withChordShape({ chords: [{ name: 'AM' }] }, 'Am', G).chords).toEqual([{ name: 'AM' }, { name: 'Am', frets: G }]);
  });

  it('Add puts a definition with its shape at the end, or with none when there is no shape', () => {
    expect(withNewChord<{ chords?: ChordDef[] }>({}, 'Dsus2', [0, 3, 2, 0, null, null]).chords).toEqual([{ name: 'Dsus2', frets: [0, 3, 2, 0, null, null] }]);
    expect(withNewChord({ chords: [{ name: 'G' }] }, 'Riff', null).chords).toEqual([{ name: 'G' }, { name: 'Riff' }]);
  });

  it('Add leaves a name that already has a definition as it is', () => {
    const track = { chords: [{ name: 'G', frets: G }] };
    expect(withNewChord(track, 'G', G_OTHER)).toBe(track);
  });

  it('Save chord renames the definitions and every column naming it, in this Voice and the others', () => {
    const part = partOf(read([
      '\\chord ("G" 3 0 0 0 2 3) {showname true}',
      '\\voiceMode barWise \\ts (4 4) \\voice 3.6.2{ch "G"} 0.6.2{ch "C"} \\voice 3.6.2{ch "G"} r.2 |',
    ].join('\n')).clip);
    const next = withRenamedChord(part, 'G', 'G barre');
    expect(next.chords).toEqual([{ name: 'G barre', frets: G, showName: true }]);
    expect(next.bars[0].columns.map(c => c.chord)).toEqual(['G barre', 'C']);
    expect(next.bars[0].otherVoices?.[0].columns.map(c => c.chord)).toEqual(['G barre', undefined]);
    // A name already taken, by a definition or a column, renames nothing.
    expect(withRenamedChord(part, 'G', 'C')).toBe(part);
    expect(withRenamedChord(next, 'G barre', 'G barre')).toBe(next);
  });
});
