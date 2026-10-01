import {
  intervalClass, midi, NOTE_LABELS, pitchClass, TUNING,
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

  it('wraps interval classes at the octave', () => {
    expect(intervalClass(0)).toBe(0);
    expect(intervalClass(1)).toBe(1);
    expect(intervalClass(-3)).toBe(3);
    expect(intervalClass(12)).toBe(12);
    expect(intervalClass(13)).toBe(1);
    expect(intervalClass(24)).toBe(12);
    expect(intervalClass(-19)).toBe(7);
  });

  it('labels notes with both spellings', () => {
    expect(NOTE_LABELS).toEqual([
      'C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A',
      'A♯/B♭', 'B',
    ]);
  });
});
