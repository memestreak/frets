import { CHORD_ROOTS, CHORD_TYPES } from '@/lib/chords/chordTypes';
import {
  chordFromSlug, chordHref, chordSlug, DEFAULT_CHORD,
} from '@/lib/chords/chordUrls';

describe('chord URLs', () => {
  it('spells slugs in lower case, with maj for a capital M and sharp for #', () => {
    expect(chordSlug({ root: 'A', type: 'm7b5' })).toBe('am7b5');
    expect(chordSlug({ root: 'A', type: 'M7b5' })).toBe('amaj7b5');
    expect(chordSlug({ root: 'C', type: 'M' })).toBe('c');
    expect(chordSlug({ root: 'Bb', type: 'maj7' })).toBe('bbmaj7');
    expect(chordSlug({ root: 'F#', type: '7#9' })).toBe('fsharp7sharp9');
    expect(chordSlug({ root: 'E', type: 'm/ma7' })).toBe('emmaj7');
    expect(chordHref({ root: 'D', type: '9' })).toBe('/chords/library?chord=d9');
    expect(chordHref({ root: 'A', type: 'm7' }, [null, 0, 2, 0, 1, 0]))
      .toBe('/chords/library?chord=am7&shape=x-0-2-0-1-0');
  });

  it('gives every root and type its own slug of plain letters and digits', () => {
    for (const root of CHORD_ROOTS) {
      for (const { id: type } of CHORD_TYPES) {
        const slug = chordSlug({ root, type });
        expect(slug).toMatch(/^[a-z0-9]+$/);
        expect(chordFromSlug(slug)).toEqual({ root, type });
      }
    }
  });

  it('falls back to Am7 for a missing or unknown slug', () => {
    expect(chordFromSlug(null)).toEqual(DEFAULT_CHORD);
    expect(chordFromSlug('Am7')).toEqual(DEFAULT_CHORD);
    expect(DEFAULT_CHORD).toEqual({ root: 'A', type: 'm7' });
  });
});
