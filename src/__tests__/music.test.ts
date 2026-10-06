import {
  intervalClass, midi, NOTE_LABELS, pitchClass, positionsOnNeck, TUNING,
} from '@/lib/music';

describe('music', () => {
  it('uses standard tuning E2 A2 D3 G3 B3 E4', () => {
    expect([...TUNING]).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it('computes MIDI and pitch class from string and fret', () => {
    expect(midi(0, 0)).toBe(40);
    expect(midi(5, 12)).toBe(76);
    expect(pitchClass(0, 0)).toBe(4); // E
    expect(pitchClass(1, 3)).toBe(0); // C on the A string
  });

  it('finds every place on the neck a set of intervals above a root sits', () => {
    // A (pc 9) and its 5th E, up to fret 5.
    const found = positionsOnNeck(9, [0, 7], 5);
    expect(found.filter(p => p.s === 0)).toEqual([
      { s: 0, f: 0, semis: 7 }, { s: 0, f: 5, semis: 0 },
    ]);
    expect(found.filter(p => p.s === 1)).toEqual([
      { s: 1, f: 0, semis: 0 },
    ]);
    expect(found).toHaveLength(8);
  });

  it('wraps interval classes at the octave', () => {
    expect(intervalClass(0)).toBe(0);
    expect(intervalClass(1)).toBe(1);
    expect(intervalClass(12)).toBe(12);
    expect(intervalClass(13)).toBe(1);
    expect(intervalClass(24)).toBe(12);
  });

  it('names a lower note by its function against the root', () => {
    expect(intervalClass(-1)).toBe(11); // M7
    expect(intervalClass(-3)).toBe(9); // M6
    expect(intervalClass(-5)).toBe(7); // G below C is a P5
    expect(intervalClass(-6)).toBe(6);
    expect(intervalClass(-7)).toBe(5); // P4
    expect(intervalClass(-12)).toBe(12);
    expect(intervalClass(-19)).toBe(5);
    expect(intervalClass(-24)).toBe(12);
  });

  it('labels notes with both spellings', () => {
    expect(NOTE_LABELS).toEqual([
      'C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A',
      'A♯/B♭', 'B',
    ]);
  });
});
