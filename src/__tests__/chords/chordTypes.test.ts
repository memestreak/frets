import { ChordType } from 'tonal';
import {
  CHORD_GROUPS, CHORD_TYPES, chordOf, chordTypeDef, formulaOf, toneLabel,
} from '@/features/chords/chordTypes';

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
  });

  it('names tones with real glyphs', () => {
    expect(toneLabel('1P')).toBe('R');
    expect(toneLabel('9A')).toBe('♯9');
    expect(toneLabel('13m')).toBe('♭13');
    expect(toneLabel('7d')).toBe('𝄫7');
  });
});
