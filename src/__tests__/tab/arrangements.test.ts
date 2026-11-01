import {
  arrangementKey, clearDraft, DRAFT_KEY, EMPTY_LIBRARY, loadArrangement, loadDraft, openOnLoad, parseLibrary, saveDraft, storeArrangement,
} from '@/features/tab/arrangements';
import { emptyClip } from '@/features/tab/clip';
import { clipReducer, initClipState, type ClipState } from '@/features/tab/clipState';

beforeEach(() => localStorage.clear());

describe('arrangements', () => {
  it('reads the index, dropping what is malformed', () => {
    expect(parseLibrary(null)).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary({ open: 3, items: 'x' })).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary({ open: 'a', items: [{ id: 'a', name: 'Riff', changed: 5 }, { id: '', name: 'x', changed: 1 }, { id: 'b', name: 'y' }] }))
      .toEqual({ open: 'a', folders: [], items: [{ id: 'a', name: 'Riff', changed: 5 }] });
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

  it('opens the arrangement the index names, else a new empty clip, Untitled', () => {
    storeArrangement(EMPTY_LIBRARY, 'a', { ...emptyClip(), name: 'Riff' }, 1);
    expect(openOnLoad({ ...EMPTY_LIBRARY, open: 'a' })).toMatchObject({ id: 'a', clip: { name: 'Riff' } });
    const fresh = openOnLoad({ ...EMPTY_LIBRARY, open: 'gone' });
    expect(fresh.id).not.toBe('gone');
    // Titled Untitled: the title is never blank (issue #281).
    expect(fresh.clip).toEqual({ ...emptyClip(), name: 'Untitled' });
  });
});

describe('the draft (issue #259)', () => {
  const riff = { ...emptyClip(), name: 'Riff' };
  const edited = { ...emptyClip(), name: 'Riff, edited' };

  it('keeps a clip never saved with its base, and a saved one without (its base is the saved clip)', () => {
    saveDraft({ id: 'new', clip: edited, base: riff }, false);
    expect(loadDraft(EMPTY_LIBRARY)).toEqual({ id: 'new', clip: edited, base: riff });

    const library = storeArrangement(EMPTY_LIBRARY, 'a', riff, 1);
    saveDraft({ id: 'a', clip: edited, base: riff }, true);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).not.toHaveProperty('base');
    expect(loadDraft(library)).toEqual({ id: 'a', clip: edited, base: riff });
  });

  it('reads back a draft that is its base again as that very clip, so nothing shows as unsaved', () => {
    saveDraft({ id: 'new', clip: { ...riff }, base: riff }, false);
    const draft = loadDraft(EMPTY_LIBRARY)!;
    expect(draft.clip).toBe(draft.base);
  });

  it('has none once cleared, or when it is malformed', () => {
    saveDraft({ id: 'new', clip: riff, base: riff }, false);
    clearDraft();
    expect(loadDraft(EMPTY_LIBRARY)).toBeNull();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: '', clip: riff }));
    expect(loadDraft(EMPTY_LIBRARY)).toBeNull();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: 'x', clip: 'nonsense' }));
    expect(loadDraft(EMPTY_LIBRARY)).toBeNull();
  });

  it('opens the draft on load ahead of the arrangement the index names', () => {
    const library = { ...storeArrangement(EMPTY_LIBRARY, 'a', riff, 1), open: 'a' };
    expect(initClipState({ library, draft: null })).toMatchObject({ id: 'a', clip: riff });
    const state = initClipState({ library, draft: { id: 'b', clip: edited, base: riff } });
    expect(state).toMatchObject({ id: 'b', clip: edited, base: riff });
  });
});

describe('clipReducer saving', () => {
  const mine = { ...emptyClip(), name: 'Mine' };
  const start: ClipState = { clip: mine, past: [], future: [], id: 'a', base: mine };
  const edit = (state: ClipState, name: string) => clipReducer(state, { type: 'replace', clip: { ...state.clip, name } });

  it('has unsaved changes until the clip is the one saved again, as by undo', () => {
    const edited = edit(start, 'Riff');
    expect(edited.clip).not.toBe(edited.base);
    expect(clipReducer(edited, { type: 'undo' }).clip).toBe(start.base);
  });

  it('saves the clip as it is, keeping the history', () => {
    const edited = edit(start, 'Riff');
    const saved = clipReducer(edited, { type: 'saved', id: 'b', clip: edited.clip });
    expect(saved).toMatchObject({ id: 'b', clip: edited.clip, base: edited.clip, past: [mine] });
  });

  it('renames a saved arrangement at once, leaving other changes unsaved', () => {
    const renamed = clipReducer(start, { type: 'renameSaved', name: 'Riff' });
    expect(renamed.clip).toBe(renamed.base);
    expect(renamed.base.name).toBe('Riff');

    const edited = clipReducer(start, { type: 'replace', clip: { ...mine, header: ['\\artist "Me"'] } });
    const both = clipReducer(edited, { type: 'renameSaved', name: 'Riff' });
    expect(both.clip).not.toBe(both.base);
    expect(both.clip.name).toBe('Riff');
    // Undo goes back to the saved clip, under its new name: nothing unsaved.
    const undone = clipReducer(both, { type: 'undo' });
    expect(undone.clip).toBe(undone.base);
    expect(undone.clip.name).toBe('Riff');
  });

  it('opens another arrangement with a fresh history, nothing unsaved', () => {
    const other = { ...emptyClip(), name: 'Other' };
    const opened = clipReducer(edit(start, 'Riff'), { type: 'open', id: 'c', clip: other });
    expect(opened).toEqual({ id: 'c', clip: other, base: other, past: [], future: [] });
  });
});
