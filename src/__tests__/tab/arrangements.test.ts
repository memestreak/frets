import { arrangementKey, EMPTY_LIBRARY, loadArrangement, openOnLoad, parseLibrary, storeArrangement, worthKeeping } from '@/features/tab/arrangements';
import { emptyClip } from '@/features/tab/clip';
import { clipReducer, type ClipState } from '@/features/tab/clipState';

beforeEach(() => localStorage.clear());

describe('arrangements', () => {
  it('reads the index, dropping what is malformed', () => {
    expect(parseLibrary(null)).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary({ open: 3, items: 'x' })).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary({ open: 'a', items: [{ id: 'a', name: 'Riff', changed: 5 }, { id: '', name: 'x', changed: 1 }, { id: 'b', name: 'y' }] }))
      .toEqual({ open: 'a', items: [{ id: 'a', name: 'Riff', changed: 5 }] });
  });

  it('stores a clip under its own key, listing it by its last change', () => {
    const riff = { ...emptyClip(), name: 'Riff' };
    let library = storeArrangement(EMPTY_LIBRARY, 'a', riff, 10);
    library = storeArrangement(library, 'b', { ...riff, name: 'Lick' }, 20);
    expect(library.items.map(i => i.name)).toEqual(['Lick', 'Riff']);
    // An older change goes back where it was (an undone delete).
    library = storeArrangement(library, 'c', { ...riff, name: 'Old' }, 15);
    expect(library.items.map(i => i.id)).toEqual(['b', 'c', 'a']);
    expect(loadArrangement('a')?.name).toBe('Riff');
    expect(localStorage.getItem(arrangementKey('b'))).toContain('Lick');
  });

  it('keeps a clip once it has a title or a note', () => {
    expect(worthKeeping(emptyClip())).toBe(false);
    expect(worthKeeping({ ...emptyClip(), name: ' ' })).toBe(false);
    expect(worthKeeping({ ...emptyClip(), name: 'Riff' })).toBe(true);
  });

  it('opens the arrangement the index names, else a new empty clip', () => {
    storeArrangement(EMPTY_LIBRARY, 'a', { ...emptyClip(), name: 'Riff' }, 1);
    expect(openOnLoad({ open: 'a', items: [] })).toMatchObject({ id: 'a', clip: { name: 'Riff' } });
    const fresh = openOnLoad({ open: 'gone', items: [] });
    expect(fresh.id).not.toBe('gone');
    expect(fresh.clip).toEqual(emptyClip());
  });
});

describe('clipReducer rename', () => {
  const mine = { ...emptyClip(), name: 'Mine' };
  const base: ClipState = { clip: mine, past: [], future: [], id: 'a', example: null };

  it('renames the clip as an undo step', () => {
    const next = clipReducer(base, { type: 'rename', name: 'Riff' });
    expect(next.clip.name).toBe('Riff');
    expect(clipReducer(next, { type: 'undo' }).clip.name).toBe('Mine');
  });

  it('renames the clip an example set aside, which leaving the example brings back', () => {
    const shown = clipReducer(base, { type: 'openExample', id: 'bends', clip: { ...emptyClip(), name: 'Bends' } });
    const renamed = clipReducer(shown, { type: 'rename', name: 'Riff' });
    expect(renamed.clip.name).toBe('Bends');
    const back = clipReducer(renamed, { type: 'leaveExample' });
    expect(back).toMatchObject({ id: 'a', clip: { name: 'Riff' }, example: null });
    expect(clipReducer(back, { type: 'undo' }).clip.name).toBe('Mine');
  });
});
