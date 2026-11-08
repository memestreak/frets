import { midiOf, pitchClassOf, prettyNote } from '@/lib/theory/notes';

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

  it('reads a sounding note name with its octave as MIDI', () => {
    expect([midiOf('E2'), midiOf('F#3'), midiOf('Bb2'), midiOf('C♯4'), midiOf('Cb4'), midiOf('B#3')]).toEqual([40, 54, 46, 61, 59, 60]);
    expect([midiOf('G𝄪3'), midiOf('Ebb4'), midiOf(' a4 '), midiOf('C-1')]).toEqual([57, 62, 69, 0]);
  });

  it('reads no MIDI from a name without a letter or an octave', () => {
    expect([midiOf('H2'), midiOf('C'), midiOf('C#b4'), midiOf('C10'), midiOf('')]).toEqual([null, null, null, null, null]);
  });

  it('writes accidentals as glyphs', () => {
    expect(prettyNote('F##')).toBe('F𝄪');
    expect(prettyNote('Bb')).toBe('B♭');
  });
});
