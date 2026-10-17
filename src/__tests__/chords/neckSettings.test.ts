import { parseNeckSettings } from '@/features/chords/neckSettings';

describe('parseNeckSettings', () => {
  it('keeps a valid choice', () => {
    expect(parseNeckSettings({ labels: 'none' })).toEqual({ labels: 'none' });
  });

  it('falls back to intervals for anything else', () => {
    for (const raw of [null, 'note', {}, { labels: 'degree' }, { labels: 3 }]) {
      expect(parseNeckSettings(raw)).toEqual({ labels: 'interval' });
    }
  });
});
