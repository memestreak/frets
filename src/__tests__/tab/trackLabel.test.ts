/**
 * The track's name over its Sound and FX in the playback footer (Jeremy, 2026-10-30): at most ten
 * characters, cut with an ellipsis; an unnamed track is named by its place.
 */
import { trackLabel, TRACK_LABEL_LENGTH } from '@/features/tab/PlaybackFooter';

describe('trackLabel', () => {
  it('shows a name of ten characters or fewer whole', () => {
    expect(trackLabel('Gtr I', 0)).toBe('Gtr I');
    expect(trackLabel('Rhythm Gtr', 1)).toBe('Rhythm Gtr');
  });

  it('cuts a longer name to ten characters, the last an ellipsis', () => {
    const label = trackLabel('Lead Guitar (solo)', 0);
    expect(label).toBe('Lead Guit…');
    expect([...label]).toHaveLength(TRACK_LABEL_LENGTH);
  });

  it('names an unnamed track by its place', () => {
    expect(trackLabel('', 0)).toBe('Track 1');
    expect(trackLabel('  ', 2)).toBe('Track 3');
  });

  it('counts a character outside the basic plane as one', () => {
    expect(trackLabel('🎸🎸🎸🎸🎸🎸🎸🎸🎸🎸🎸', 0)).toBe('🎸🎸🎸🎸🎸🎸🎸🎸🎸…');
  });
});
