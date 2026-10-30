import { ChordType } from 'tonal';
import {
  CHORD_GROUPS, CHORD_TYPES, chordFromIntervals, chordOf, chordTypeDef, formulaOf, withBass,
} from '@/lib/theory/chords';
import { toneLabel } from '@/lib/theory/intervals';

describe('CHORD_TYPES', () => {
  it('lists every tonal chord type once', () => {
    expect(CHORD_TYPES).toHaveLength(ChordType.all().length);
    expect(new Set(CHORD_TYPES.map(t => t.id)).size).toBe(CHORD_TYPES.length);
  });

  it('puts the common chords first, in order', () => {
    expect(CHORD_TYPES.slice(0, 5).map(t => t.symbol)).toEqual(['', 'm', '7', 'maj7', 'm7']);
    expect(CHORD_TYPES.filter(t => t.group === 'Common')).toHaveLength(19);
  });

  it('groups the rest by what they contain', () => {
    expect(chordTypeDef('5')!.group).toBe('Triads');
    expect(chordTypeDef('7b9')!.group).toBe('Altered');
    expect(chordTypeDef('maj13')!.group).toBe('Extended');
    expect(chordTypeDef('mb6M7')!.group).toBe('Sixths and sevenths');
    expect(new Set(CHORD_TYPES.map(t => t.group))).toEqual(new Set(CHORD_GROUPS));
  });

  it('writes symbols as guitarists do', () => {
    expect(chordTypeDef('M')!.label).toBe('major');
    expect(chordTypeDef('m7')!.label).toBe('m7 · minor seventh');
    expect(chordTypeDef('7b9#11')!.symbol).toBe('7♭9♯11');
    expect(chordTypeDef('m/ma7')!.symbol).toBe('m(maj7)');
    expect(chordTypeDef('Madd9')!.symbol).toBe('add9');
  });
});

describe('withBass', () => {
  it('adds a bass outside the chord as a tone, spelled over the root', () => {
    const over = withBass(chordOf('F', 'mMaj7#11'), 6);
    expect(over.symbol).toBe('Fm(maj7)♯11');
    expect(over.notes).toEqual(['F', 'A♭', 'C', 'E', 'B', 'G♭']);
    expect(formulaOf(over)).toBe('1 ♭3 5 7 ♯11 ♭9');
    expect(withBass(chordOf('C', 'M'), 8).notes.at(-1)).toBe('A♭');
  });

  it('leaves a chord alone over one of its own tones', () => {
    const c = chordOf('C', 'M');
    expect(withBass(c, 4)).toBe(c);
  });
});

describe('chordOf', () => {
  it('spells the notes and labels the tones', () => {
    const cm7 = chordOf('C', 'm7');
    expect(cm7.symbol).toBe('Cm7');
    expect(cm7.notes).toEqual(['C', 'E♭', 'G', 'B♭']);
    expect(formulaOf(cm7)).toBe('1 ♭3 5 ♭7');
    expect(cm7.tones.map(t => t.semis)).toEqual([0, 3, 7, 10]);

    const fsDim7 = chordOf('F#', 'dim7');
    expect(fsDim7.symbol).toBe('F♯°7');
    expect(fsDim7.notes).toEqual(['F♯', 'A', 'C', 'E♭']);
    expect(formulaOf(fsDim7)).toBe('1 ♭3 ♭5 𝄫7');
  });

  it('labels tensions above the octave by their number', () => {
    const bb13 = chordOf('Bb', '13');
    expect(bb13.notes).toEqual(['B♭', 'D', 'F', 'A♭', 'C', 'G']);
    expect(bb13.tones.map(t => t.label)).toEqual(['R', '3', '5', '♭7', '9', '13']);
    expect(bb13.tones.map(t => t.degree)).toEqual([1, 3, 5, 7, 2, 6]);
  });

  it('lets voicings leave out the 5th, and the tones under an 11th or 13th', () => {
    const optional = (root: 'C', id: string) =>
      chordOf(root, id).tones.filter(t => !t.required).map(t => t.label);
    expect(optional('C', 'M')).toEqual([]);
    expect(optional('C', '7')).toEqual(['5']);
    expect(optional('C', 'm11')).toEqual(['5', '9']);
    expect(optional('C', '13')).toEqual(['5', '9']);
    expect(optional('C', '7b9')).toEqual(['5']);
    // With no 7th, a 9th is added, not a tone under the 11th.
    expect(optional('C', 'Madd9add11')).toEqual(['5']);
    expect(optional('C', '69#11')).toEqual(['5']);
  });

  it('names tones with real glyphs', () => {
    expect(toneLabel('1P')).toBe('R');
    expect(toneLabel('9A')).toBe('♯9');
    expect(toneLabel('13m')).toBe('♭13');
    expect(toneLabel('7d')).toBe('𝄫7');
  });
});

describe('chordFromIntervals', () => {
  it('names a stack by its spelling, not only its pitches', () => {
    // C E G♯ B: a maj7♯5, though C E A♭ B (the same pitches) is tonal's M7♭6.
    expect(chordFromIntervals(0, ['1P', '3M', '5A', '7M']).symbol).toBe('Cmaj7♯5');
    expect(chordFromIntervals(9, ['1P', '3m', '5P', '7m']).symbol).toBe('Am7');
  });

  it('reads a stack no type spells by its pitches: a ♯3 sounds as a 4', () => {
    expect(chordFromIntervals(0, ['1P', '3A', '5A', '7M']).symbol).toBe('Cmaj7♯5sus4');
    expect(chordFromIntervals(0, ['1P', '3A', '5A']).symbol).toBe('Csus4♯5');
  });

  it('leaves a stack with no type unnamed', () => {
    const odd = chordFromIntervals(0, ['1P', '2m', '4A']);
    expect(odd.type).toBeNull();
    expect(odd.symbol).toBe('');
  });
});

describe('one table of symbols', () => {
  it('writes the rare sevenths the Scale lab stacks as it does', () => {
    const symbol = (id: string) => chordTypeDef(id)!.symbol;
    expect(symbol('oM7')).toBe('°(maj7)');
    expect(symbol('M7#5sus4')).toBe('maj7♯5sus4');
    expect(symbol('mMaj7#5')).toBe('m(maj7)♯5');
    expect(symbol('maj7#5')).toBe('maj7♯5');
    expect(symbol('sus4#5')).toBe('sus4♯5');
  });
});
