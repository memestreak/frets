import {
  defaultTriadsSettings, parseTriadsSettings,
} from '@/features/explore/triads/settings';

describe('parseTriadsSettings', () => {
  it('falls back to the defaults for missing or non-object data', () => {
    expect(parseTriadsSettings(null)).toEqual(defaultTriadsSettings());
    expect(parseTriadsSettings('C major')).toEqual(defaultTriadsSettings());
  });

  it('keeps valid fields', () => {
    const set = { root: 'Eb', triad: 'dim', strings: 0, labels: 'note' };
    expect(parseTriadsSettings(set)).toEqual(set);
  });

  it('replaces each invalid field with its default', () => {
    expect(parseTriadsSettings({
      root: 'D#', triad: 'sus4', strings: 4, labels: 'finger',
    })).toEqual(defaultTriadsSettings());
  });
});
