import { CHORD_ROOTS, CHORD_TYPES } from '@/lib/theory/chords';
import {
  chordFromSlug, chordHref, chordSlug, DEFAULT_CHORD, shapeFromKey,
} from '@/lib/chords/chordUrls';

describe('chord URLs', () => {
  it('spells slugs in lower case, with maj for a capital M and sharp for #', () => {
    expect(chordSlug({ root: 'A', type: 'm7b5' })).toBe('am7b5');
    expect(chordSlug({ root: 'A', type: 'M7b5' })).toBe('amaj7b5');
    expect(chordSlug({ root: 'C', type: 'M' })).toBe('c');
    expect(chordSlug({ root: 'Bb', type: 'maj7' })).toBe('bbmaj7');
    expect(chordSlug({ root: 'F#', type: '7#9' })).toBe('fsharp7sharp9');
    expect(chordSlug({ root: 'E', type: 'm/ma7' })).toBe('emmaj7');
    expect(chordHref({ root: 'D', type: '9' })).toBe('/chords?chord=d9');
    expect(chordHref({ root: 'A', type: 'm7' }, [null, 0, 2, 0, 1, 0]))
      .toBe('/chords?chord=am7&shape=x-0-2-0-1-0');
    expect(chordHref(null, [null, 3, 4, null, null, null])).toBe('/chords?shape=x-3-4-x-x-x');
    expect(chordHref(null)).toBe('/chords');
  });

  it('reads a shape back from its key, within the neck', () => {
    expect(shapeFromKey('x-0-2-0-1-0', 15)).toEqual([null, 0, 2, 0, 1, 0]);
    expect(shapeFromKey('x-x-x-x-x-15', 15)).toEqual([null, null, null, null, null, 15]);
    expect(shapeFromKey('x-0-2-0-1-16', 15)).toBeNull();
    expect(shapeFromKey('x-0-2-0-1', 15)).toBeNull();
    expect(shapeFromKey('x-0-2-0-1-a', 15)).toBeNull();
    expect(shapeFromKey('x-0-2-0-1--1', 15)).toBeNull();
    expect(shapeFromKey(null, 15)).toBeNull();
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

  it('reads no chord from a missing or unknown slug, and defaults to Am7', () => {
    expect(chordFromSlug(null)).toBeNull();
    expect(chordFromSlug('Am7')).toBeNull();
    expect(DEFAULT_CHORD).toEqual({ root: 'A', type: 'm7' });
  });
});
