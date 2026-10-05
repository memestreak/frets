import {
  defaultChordLibrarySettings, parseChordLibrarySettings,
} from '@/features/chords/library/settings';

describe('parseChordLibrarySettings', () => {
  it('defaults to Am7', () => {
    expect(parseChordLibrarySettings(null)).toEqual({ root: 'A', type: 'm7' });
  });

  it('keeps valid fields', () => {
    expect(parseChordLibrarySettings({ root: 'F#', type: '7b9' })).toEqual({ root: 'F#', type: '7b9' });
  });

  it('replaces each bad field with its default', () => {
    const d = defaultChordLibrarySettings();
    expect(parseChordLibrarySettings({ root: 'H', type: 'm7' })).toEqual({ ...d, type: 'm7' });
    expect(parseChordLibrarySettings({ root: 'C', type: 'nope' })).toEqual({ root: 'C', type: d.type });
    expect(parseChordLibrarySettings({ root: 3, type: null })).toEqual(d);
    expect(parseChordLibrarySettings('Am7')).toEqual(d);
  });
});
