import {
  defaultScaleLabSettings, parseScaleLabSettings,
} from '@/features/explore/scales/settings';

describe('parseScaleLabSettings', () => {
  it('falls back to the defaults for missing or non-object data', () => {
    expect(parseScaleLabSettings(null)).toEqual(defaultScaleLabSettings());
    expect(parseScaleLabSettings('A dorian')).toEqual(defaultScaleLabSettings());
  });

  it('keeps valid fields', () => {
    const set = {
      root: 'Eb', scale: 'harmonic-minor', mode: 4, chordSize: 3, numerals: 'relative', labels: 'note',
      chordView: 'clock', chordIntervals: 'between',
    };
    expect(parseScaleLabSettings(set)).toEqual(set);
  });

  it('replaces each invalid field with its default', () => {
    expect(parseScaleLabSettings({
      root: 'H', scale: 'bebop', mode: 7, chordSize: 5, numerals: 'roman', labels: 'finger',
      chordView: 'staff', chordIntervals: 'above',
    })).toEqual(defaultScaleLabSettings());
    expect(parseScaleLabSettings({ root: 'E#' }).root).toBe('A');
    expect(parseScaleLabSettings({ mode: 1.5 }).mode).toBe(0);
    // Only seven-note scales rotate.
    expect(parseScaleLabSettings({ scale: 'minor-blues', mode: 2 }).mode).toBe(0);
  });
});
