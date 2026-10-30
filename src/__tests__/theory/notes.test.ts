import { pitchClassOf, prettyNote } from '@/lib/theory/notes';

describe('notes', () => {
  it('reads a note name in ASCII or glyphs', () => {
    expect(pitchClassOf('F#')).toBe(6);
    expect(pitchClassOf('F♯')).toBe(6);
    expect(pitchClassOf('Bb')).toBe(10);
    expect(pitchClassOf('E#')).toBe(5);
    expect(pitchClassOf('Cb')).toBe(11);
    expect(pitchClassOf('G𝄪')).toBe(9);
    expect(pitchClassOf('a')).toBe(9);
  });

  it('writes accidentals as glyphs', () => {
    expect(prettyNote('F##')).toBe('F𝄪');
    expect(prettyNote('Bb')).toBe('B♭');
  });
});
