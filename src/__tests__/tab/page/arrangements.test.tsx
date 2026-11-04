import { vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { readAscii } from '@/features/tab/ascii';
import { arrangementKey, DRAFT_KEY, LIBRARY_KEY, loadLibrary } from '@/features/tab/arrangements';
import { DOUBLE_TAP_MS, DRAG_TYPE } from '@/features/tab/ArrangementChooser';
import { type Clip } from '@/features/tab/clip';
import { setUpPage, RIFF, renderAt, heading, paste, SLOW, settle, TEX, undo, keepOpen, doubleClick } from './helpers';

setUpPage();

describe('TabPage arrangements', () => {
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
  const openDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Arrangements…' }));
    return screen.getByRole('dialog', { name: 'Arrangements' });
  };
  const places = (dialog: HTMLElement) => within(within(dialog).getByRole('navigation', { name: 'Places' }));
  /** The list in the middle, showing `name`'s files. */
  const files = (dialog: HTMLElement, name = 'My arrangements') => within(within(dialog).getByRole('list', { name }));
  const names = (dialog: HTMLElement, list = 'My arrangements') =>
    files(dialog, list).queryAllByRole('button', { name: /^(?!Rename|Delete)/ }).map(b => b.querySelector('.tab-row-text')?.textContent);
  /** A drag's data, as the browser carries it. */
  const dataTransfer = (data: Record<string, string>) => ({
    get types() { return Object.keys(data); },
    getData: (type: string) => data[type] ?? '', setData: (type: string, value: string) => { data[type] = value; },
    effectAllowed: 'all', dropEffect: 'none',
  });
  /** Drags `from` (an arrangement's line) and drops it on `to`. */
  const drag = (from: Element, to: Element) => {
    const carried = dataTransfer({});
    fireEvent.dragStart(from, { dataTransfer: carried });
    fireEvent.dragOver(to, { dataTransfer: carried });
    fireEvent.drop(to, { dataTransfer: carried });
    fireEvent.dragEnd(from, { dataTransfer: carried });
  };
  const typeNine = () => {
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    fireEvent.keyDown(editor(), { key: 'ArrowDown' });
    fireEvent.keyDown(editor(), { key: '9' });
    fireEvent.keyDown(editor(), { key: 'Escape' });
  };
  const unsaved = () => screen.queryByTestId('unsaved') !== null;
  const saveAsDialog = () => screen.getByRole('dialog', { name: 'Save as' });
  const savedColumns = (id: string) =>
    (JSON.parse(localStorage.getItem(arrangementKey(id))!) as Clip).tracks[0].bars.flatMap(b => b.voices[0]).length;

  it('saves nothing until Save, and brings back unsaved changes after a reload, still unsaved', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const before = savedColumns('kept');
    expect(unsaved()).toBe(false);
    typeNine();
    const columns = screen.getAllByTestId('tab-column').length;
    expect(unsaved()).toBe(true);
    await settle();
    expect(savedColumns('kept')).toBe(before);
    cleanup();
    renderAt();
    expect(heading()).toHaveTextContent('Riff');
    expect(screen.getAllByTestId('tab-column')).toHaveLength(columns);
    expect(unsaved()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save, unsaved changes' }));
    await settle();
    expect(unsaved()).toBe(false);
    expect(savedColumns('kept')).toBe(columns);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    // Saved, it opens again on the next visit.
    cleanup();
    renderAt();
    expect(screen.getAllByTestId('tab-column')).toHaveLength(columns);
    expect(unsaved()).toBe(false);
  });

  it('has nothing unsaved once undo goes back to the clip as saved', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    typeNine();
    expect(unsaved()).toBe(true);
    undo();
    expect(unsaved()).toBe(false);
    undo(true);
    expect(unsaved()).toBe(true);
  });

  it('saves a new clip under a name and in a folder, and Save as… saves a copy that the page then shows', async () => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ open: null, folders: [{ id: 'f', name: 'Riffs' }], items: [] }));
    renderAt();
    await paste(RIFF);
    fireEvent.click(screen.getByRole('button', { name: 'Save, unsaved changes' }));
    let dialog = saveAsDialog();
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Riff');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Riff A' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Folder' }), { target: { value: 'f' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(heading()).toHaveTextContent('Riff A');
    expect(unsaved()).toBe(false);
    expect(loadLibrary().items).toMatchObject([{ name: 'Riff A', folder: 'f' }]);
    const first = loadLibrary().items[0].id;
    // Save as… a saved one: a copy, which the page shows from then on; the first stays as saved.
    typeNine();
    fireEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    dialog = saveAsDialog();
    // My arrangements to start with, whatever folder the open one is in.
    expect(within(dialog).getByRole('combobox', { name: 'Folder' })).toHaveValue('');
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Folder' }), { target: { value: 'f' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Riff B' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(heading()).toHaveTextContent('Riff B');
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Riff B', 'Riff A']);
    expect(loadLibrary().open).not.toBe(first);
    expect(savedColumns(first)).toBeLessThan(screen.getAllByTestId('tab-column').length);
    // Cancel saves nothing.
    typeNine();
    fireEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    fireEvent.click(within(saveAsDialog()).getByRole('button', { name: 'Cancel' }));
    expect(loadLibrary().items).toHaveLength(2);
    expect(unsaved()).toBe(true);
  });

  it('makes a new folder in Save as with Enter, picks it and gives the focus to the list, not saving', async () => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ open: null, folders: [{ id: 'f', name: 'Riffs' }], items: [] }));
    renderAt();
    await paste(RIFF);
    fireEvent.click(screen.getByRole('button', { name: 'Save, unsaved changes' }));
    let dialog = saveAsDialog();
    // The folder comes before the name, My arrangements to start with.
    const folderList = () => within(dialog).getByRole('combobox', { name: 'Folder' });
    expect(folderList().compareDocumentPosition(within(dialog).getByRole('textbox', { name: 'Name' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(folderList()).toHaveValue('');
    // Esc in the new folder's name goes back to the list, the dialog still open.
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'New folder name' }), { key: 'Escape' });
    expect(folderList()).toHaveFocus();
    // So does the ×, making nothing.
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pick a folder instead' }));
    expect(loadLibrary().folders).toHaveLength(1);
    // Enter makes the folder and picks it, the focus on the list; nothing is saved and the dialog stays.
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    const field = within(dialog).getByRole('textbox', { name: 'New folder name' });
    fireEvent.change(field, { target: { value: 'Lines' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const lines = loadLibrary().folders.find(f => f.name === 'Lines')!;
    expect(folderList()).toHaveValue(lines.id);
    expect(folderList()).toHaveFocus();
    expect(dialog).toHaveAttribute('open');
    expect(loadLibrary().items).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(loadLibrary().items).toMatchObject([{ name: 'Riff', folder: lines.id }]);
    // Save with a new folder's name still open makes it too; left empty it is "New folder".
    fireEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    dialog = saveAsDialog();
    expect(folderList()).toHaveValue('');
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(loadLibrary().folders.map(f => f.name).sort()).toEqual(['Lines', 'New folder', 'Riffs']);
  });

  it('saves with Ctrl/⌘+S, opens Save as with Shift, and Arrangements… with Ctrl/⌘+O, anywhere on the page', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    typeNine();
    const save = fireEvent.keyDown(document.body, { key: 's', metaKey: true });
    // The browser's own Save Page doesn't open.
    expect(save).toBe(false);
    expect(unsaved()).toBe(false);
    fireEvent.keyDown(editor(), { key: 'S', ctrlKey: true, shiftKey: true });
    expect(saveAsDialog()).toBeInTheDocument();
    // Not over another dialog.
    fireEvent.keyDown(saveAsDialog(), { key: 'o', ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: 'Arrangements' })).toBeNull();
    fireEvent.click(within(saveAsDialog()).getByRole('button', { name: 'Cancel' }));
    expect(fireEvent.keyDown(document.body, { key: 'o', ctrlKey: true })).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Arrangements' })).toBeInTheDocument();
  });

  it('asks before unsaved changes are replaced: Cancel keeps them, Don\'t save lets them go, Save keeps them first', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const before = savedColumns('kept');
    typeNine();
    const edited = screen.getAllByTestId('tab-column').length;
    // New: Cancel keeps the clip as it is.
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    let ask = screen.getByRole('dialog', { name: 'Save changes?' });
    expect(ask).toHaveTextContent('Save changes to “Riff”?');
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(heading()).toHaveTextContent('Riff');
    expect(unsaved()).toBe(true);
    // Don't save: the new clip, the saved one as it was.
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save changes?' })).getByRole('button', { name: 'Don\'t save' }));
    expect(heading()).toHaveTextContent('Untitled');
    expect(savedColumns('kept')).toBe(before);
    // A clip with nothing changed opens another without asking.
    let dialog = openDialog();
    doubleClick(files(dialog).getByRole('button', { name: /^Riff / }));
    expect(screen.queryByRole('dialog', { name: 'Save changes?' })).toBeNull();
    expect(heading()).toHaveTextContent('Riff');
    // Save, from Import…: saved, then the Import dialog opens.
    typeNine();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    ask = screen.getByRole('dialog', { name: 'Save changes?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Save' }));
    expect(savedColumns('kept')).toBe(edited);
    // The import, asked about at Import…, goes on in its dialog.
    fireEvent.change(screen.getByRole('textbox', { name: /Tab, as alphaTex or ASCII/ }), { target: { value: TEX } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    // An import is a new arrangement, not saved yet.
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Riff']);
    // Opening from Arrangements… asks too, after the dialog closes; a clip never saved asks for a name first.
    typeNine();
    dialog = openDialog();
    doubleClick(files(dialog).getByRole('button', { name: /^Riff / }));
    expect(dialog).not.toHaveAttribute('open');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save changes?' })).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(saveAsDialog()).getByRole('button', { name: 'Save' }));
    expect(loadLibrary().items.map(i => i.name).sort()).toEqual(['Riff', 'Tex riff']);
    expect(heading()).toHaveTextContent('Riff');
  });

  it('closes the browser tab without asking, unless the draft could not keep the unsaved changes', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);
    // Unsaved, but in the draft: no warning.
    typeNine();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(leave()).toBe(false);
    // Storage full: the next change can't be drafted, so closing would lose it.
    // On the prototype: jsdom's Storage would keep an own `setItem` as an item.
    const storage = Object.getPrototypeOf(window.localStorage) as Storage;
    const write = storage.setItem;
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === DRAFT_KEY) throw new DOMException('full', 'QuotaExceededError');
      write.call(this, key, value);
    });
    typeNine();
    expect(leave()).toBe(true);
    // Saved: nothing to lose.
    setItem.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Save, unsaved changes' }));
    expect(leave()).toBe(false);
  });

  it('opens a dropped file as a new arrangement once unsaved changes are let go', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    typeNine();
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    drop.dataTransfer = { files: [], getData: () => TEX };
    await act(async () => { document.body.dispatchEvent(drop); });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save changes?' })).getByRole('button', { name: 'Don\'t save' }));
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Riff']);
  });

  it('lists only what is saved, and says so while nothing is', async () => {
    renderAt();
    let dialog = openDialog();
    expect(files(dialog).getByText('Nothing saved here yet.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await paste(RIFF);
    dialog = openDialog();
    expect(names(dialog)).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    fireEvent.click(within(saveAsDialog()).getByRole('button', { name: 'Save' }));
    dialog = openDialog();
    expect(names(dialog)).toEqual(['Riff']);
    expect(files(dialog).getByRole('button', { name: /^Riff / })).toHaveAttribute('aria-current', 'true');
  });

  it('renames from the list, saving the name at once: the open one\'s title follows, its other changes still unsaved', async () => {
    keepMany(['Riff', 'Line']);
    renderAt();
    typeNine();
    const dialog = openDialog();
    fireEvent.click(files(dialog).getByRole('button', { name: 'Rename Riff' }));
    const field = within(dialog).getByRole('textbox', { name: 'Arrangement name' });
    fireEvent.change(field, { target: { value: 'Old riff' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(heading()).toHaveTextContent('Old riff');
    expect(JSON.parse(localStorage.getItem(arrangementKey('a'))!).name).toBe('Old riff');
    expect(unsaved()).toBe(true);
    // Esc gives up a rename and leaves the dialog open.
    fireEvent.click(files(dialog).getByRole('button', { name: 'Rename Line' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Arrangement name' }), { target: { value: 'Other' } });
    fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'Arrangement name' }), { key: 'Escape' });
    expect(names(dialog).sort()).toEqual(['Line', 'Old riff']);
    // Another one is renamed where it is saved; leaving the field keeps the name.
    fireEvent.click(files(dialog).getByRole('button', { name: 'Rename Line' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Arrangement name' }), { target: { value: 'Line 2' } });
    fireEvent.blur(within(dialog).getByRole('textbox', { name: 'Arrangement name' }));
    expect(names(dialog).sort()).toEqual(['Line 2', 'Old riff']);
    expect(heading()).toHaveTextContent('Old riff');
    // Undo takes back the 9, not the name.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    undo();
    expect(heading()).toHaveTextContent('Old riff');
    expect(unsaved()).toBe(false);
  });

  it('deletes with an undo; deleting the open one opens the next', async () => {
    keepMany(['Riff', 'Tex riff']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(files(dialog).getByRole('button', { name: 'Delete Tex riff' }));
    expect(names(dialog)).toEqual(['Riff']);
    expect(localStorage.getItem(arrangementKey('b'))).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(names(dialog)).toEqual(['Riff', 'Tex riff']);
    fireEvent.click(files(dialog).getByRole('button', { name: 'Delete Riff' }));
    await settle();
    expect(heading()).toHaveTextContent('Tex riff');
    expect(dialog).toHaveAttribute('open');
    fireEvent.click(files(dialog).getByRole('button', { name: 'Delete Tex riff' }));
    await settle();
    expect(heading()).toHaveTextContent('Untitled');
    expect(loadLibrary().items).toEqual([]);
  });

  it('says when each saved arrangement last changed, so two of one name can be told apart', async () => {
    const riff = (readAscii(RIFF) as { clip: { name: string } }).clip;
    localStorage.setItem(arrangementKey('old'), JSON.stringify(riff));
    localStorage.setItem(arrangementKey('new'), JSON.stringify(riff));
    const today = new Date();
    today.setHours(9, 5);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ open: 'new', folders: [], items: [
      { id: 'new', name: 'Riff', changed: today.getTime() },
      { id: 'old', name: 'Riff', changed: new Date(2025, 2, 14, 18, 30).getTime() },
    ] }));
    renderAt();
    const dialog = openDialog();
    expect(files(dialog).getAllByTestId('changed').map(c => c.textContent)).toEqual([
      today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      `${new Date(2025, 2, 14).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(2025, 2, 14, 18, 30).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    ]);
    // The built-in ones say nothing of the kind.
    fireEvent.click(await places(dialog).findByRole('button', { name: 'Rhythm' }));
    expect(files(dialog, 'Rhythm').queryAllByTestId('changed')).toEqual([]);
  });

  it('says beside the title where the list is, and goes back up from there', async () => {
    renderAt();
    const dialog = openDialog();
    const where = () => within(within(dialog).getByRole('navigation', { name: 'Where' }));
    expect(where().getByText('My arrangements')).toHaveAttribute('aria-current', 'location');
    fireEvent.click(await places(dialog).findByRole('button', { name: 'Rhythm' }));
    expect(where().getByText('Rhythm')).toHaveAttribute('aria-current', 'location');
    // Each file has a file icon.
    for (const line of files(dialog, 'Rhythm').getAllByRole('button')) expect(line.querySelector('svg')).not.toBeNull();
    fireEvent.click(where().getByRole('button', { name: 'Built-in' }));
    expect(where().getByText('Built-in')).toHaveAttribute('aria-current', 'location');
    expect(within(dialog).getByRole('list', { name: 'Built-in' })).toBeInTheDocument();
  });

  it('folds My arrangements and Built-in away when the one shown is pressed again', async () => {
    keepMany(['Riff']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    const field = within(dialog).getByRole('textbox', { name: 'Folder name' });
    fireEvent.change(field, { target: { value: 'Riffs' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const mine = places(dialog).getByRole('button', { name: 'My arrangements' });
    expect(mine).toHaveAttribute('aria-expanded', 'true');
    // Shown already, a press folds its folders away; its files stay in the middle.
    fireEvent.click(mine);
    expect(mine).toHaveAttribute('aria-expanded', 'false');
    expect(places(dialog).queryByRole('button', { name: 'Riffs' })).toBeNull();
    expect(names(dialog)).toEqual(['Riff']);
    fireEvent.click(mine);
    expect(places(dialog).getByRole('button', { name: 'Riffs' })).toBeInTheDocument();
    // Built-in: the first press shows it, the next folds it, another place leaves it as it is.
    const builtin = places(dialog).getByRole('button', { name: 'Built-in' });
    await places(dialog).findByRole('button', { name: 'Rhythm' });
    fireEvent.click(builtin);
    expect(builtin).toHaveAttribute('aria-current', 'true');
    expect(builtin).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(builtin);
    expect(places(dialog).queryByRole('button', { name: 'Rhythm' })).toBeNull();
    fireEvent.click(mine);
    expect(builtin).toHaveAttribute('aria-expanded', 'false');
    // Folded from somewhere else, a press shows it and unfolds it.
    fireEvent.click(builtin);
    expect(places(dialog).getByRole('button', { name: 'Rhythm' })).toBeInTheDocument();
  });

  it('keeps arrangements in folders on the left, one level deep, and deletes a folder with what is in it', async () => {
    keepMany(['Riff', 'Tex riff']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    const field = within(dialog).getByRole('textbox', { name: 'Folder name' });
    expect(field).toHaveValue('New folder');
    fireEvent.change(field, { target: { value: 'Riffs' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const folder = places(dialog).getByRole('button', { name: 'Riffs' });
    // Dragged onto the folder on the left, Riff goes in.
    const row = (name: RegExp) => files(dialog).getByRole('button', { name }).closest('li')!;
    drag(row(/^Riff /), folder);
    expect(names(dialog)).toEqual(['Tex riff']);
    expect(loadLibrary().items.find(i => i.name === 'Riff')?.folder).toBe(loadLibrary().folders[0].id);
    fireEvent.click(folder);
    expect(names(dialog, 'Riffs')).toEqual(['Riff']);
    // Dragged onto My arrangements, it comes back out to the top level.
    drag(files(dialog, 'Riffs').getByRole('button', { name: /^Riff / }).closest('li')!, places(dialog).getByRole('button', { name: 'My arrangements' }));
    expect(loadLibrary().items.find(i => i.name === 'Riff')?.folder).toBeUndefined();
    expect(files(dialog, 'Riffs').getByText('Nothing saved here yet.')).toBeInTheDocument();
    // A drag that carries no arrangement (text from elsewhere) lights no folder.
    fireEvent.dragOver(folder, { dataTransfer: dataTransfer({ 'text/plain': 'e|-5-|' }) });
    expect(folder.closest('li')).not.toHaveClass('tab-drop');
    fireEvent.dragOver(folder, { dataTransfer: dataTransfer({ [DRAG_TYPE]: 'x' }) });
    expect(folder.closest('li')).toHaveClass('tab-drop');
    fireEvent.dragLeave(folder.closest('li')!, { relatedTarget: document.body });
    expect(folder.closest('li')).not.toHaveClass('tab-drop');
    // Renamed on the left.
    fireEvent.click(places(dialog).getByRole('button', { name: 'Rename Riffs' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Folder name' }), { target: { value: 'Lines' } });
    fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'Folder name' }), { key: 'Enter' });
    expect(loadLibrary().folders.map(f => f.name)).toEqual(['Lines']);
    // Moving both in, then deleting the folder, opens a new clip.
    fireEvent.click(places(dialog).getByRole('button', { name: 'My arrangements' }));
    drag(row(/^Tex riff /), places(dialog).getByRole('button', { name: 'Lines' }));
    drag(row(/^Riff /), places(dialog).getByRole('button', { name: 'Lines' }));
    fireEvent.click(places(dialog).getByRole('button', { name: 'Delete Lines' }));
    await settle();
    expect(loadLibrary().folders).toEqual([]);
    expect(loadLibrary().items).toEqual([]);
    expect(heading()).toHaveTextContent('Untitled');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Deleted the folder Lines.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(loadLibrary().folders.map(f => f.name)).toEqual(['Lines']);
    expect(loadLibrary().items.map(i => i.name).sort()).toEqual(['Riff', 'Tex riff']);
  });

  it('lists the built-in arrangements in their folders on the left, the samples among them, one line each by name', async () => {
    renderAt();
    const dialog = openDialog();
    await places(dialog).findByRole('button', { name: 'Samples' });
    expect(places(dialog).getAllByRole('button', { name: /^(?!Rename|Delete|My arrangements)/ }).map(b => b.textContent))
      .toEqual(expect.arrayContaining(['Articulations', 'Rhythm', 'Samples', 'Song structure']));
    fireEvent.click(places(dialog).getByRole('button', { name: 'Samples' }));
    expect(places(dialog).getByRole('button', { name: 'Samples' })).toHaveAttribute('aria-current', 'true');
    expect(names(dialog, 'Samples')).toContain('Oceanic Speedy Down Run');
    // Built-ins can't be renamed, deleted or picked several at a time.
    expect(files(dialog, 'Samples').queryAllByRole('button', { name: /^(Rename|Delete)/ })).toEqual([]);
    const lines = files(dialog, 'Samples').getAllByRole('button');
    fireEvent.click(lines[0], { detail: 1 });
    fireEvent.click(lines[1], { detail: 1, shiftKey: true });
    expect(files(dialog, 'Samples').getAllByRole('button', { pressed: true })).toEqual([lines[1]]);
  });

  it('sets each folder on the left a step in from its parent: its chevron\'s room kept empty (Jeremy, 2026-11-03)', async () => {
    renderAt();
    const dialog = openDialog();
    const child = await places(dialog).findByRole('button', { name: 'Samples' });
    const parent = places(dialog).getByRole('button', { name: 'Built-in' });
    // The parent's chevron and the child's empty slot take the same room before each folder icon,
    // and the child's whole line sits in a nested list, indented by that room (tab.css).
    expect(parent.firstElementChild).toHaveClass('tab-chooser-fold');
    expect(parent.firstElementChild?.querySelector('svg')).not.toBeNull();
    expect(child.firstElementChild).toHaveClass('tab-chooser-fold');
    expect(child.firstElementChild).toBeEmptyDOMElement();
    expect(child.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(child.closest('li.tab-chooser-sub')).not.toBeNull();
    expect(parent.closest('li.tab-chooser-sub')).toBeNull();
  });

  it('lists only arrangements in the middle, never folders: they are on the left already (Jeremy, 2026-11-03)', async () => {
    keepMany(['Riff', 'Tex riff'], [{ id: 'f', name: 'Riffs', holds: ['Tex riff'] }]);
    renderAt();
    const dialog = openDialog();
    await places(dialog).findByRole('button', { name: 'Rhythm' });
    const folderLines = (list: string) => files(dialog, list).queryAllByRole('button').filter(b => b.classList.contains('tab-folder'));
    // My arrangements: its arrangement, not the folder Riffs.
    expect(places(dialog).getByRole('button', { name: 'Riffs' })).toBeInTheDocument();
    expect(names(dialog)).toEqual(['Riff']);
    expect(folderLines('My arrangements')).toEqual([]);
    fireEvent.click(places(dialog).getByRole('button', { name: 'Riffs' }));
    expect(names(dialog, 'Riffs')).toEqual(['Tex riff']);
    // Built-in holds only folders, so it lists nothing; a folder of it, only its arrangements.
    fireEvent.click(places(dialog).getByRole('button', { name: 'Built-in' }));
    expect(files(dialog, 'Built-in').queryAllByRole('button')).toEqual([]);
    expect(files(dialog, 'Built-in').getByText('Nothing here.')).toBeInTheDocument();
    fireEvent.click(places(dialog).getByRole('button', { name: 'Rhythm' }));
    expect(folderLines('Rhythm')).toEqual([]);
    expect(files(dialog, 'Rhythm').getAllByRole('button').length).toBeGreaterThan(0);
  });

  /** Saved arrangements named `names` (ids a, b, c…), the first open, in `folder` where given. */
  const keepMany = (names: string[], folders: { id: string; name: string; holds: string[] }[] = []) => {
    const riff = (readAscii(RIFF) as { clip: { name: string } }).clip;
    const ids = names.map((_, i) => String.fromCharCode(97 + i));
    names.forEach((name, i) => localStorage.setItem(arrangementKey(ids[i]), JSON.stringify({ ...riff, name })));
    const folderOf = (name: string) => folders.find(f => f.holds.includes(name))?.id;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({
      open: ids[0], folders: folders.map(({ id, name }) => ({ id, name })),
      items: names.map((name, i) => ({ id: ids[i], name, changed: 100 - i, ...(folderOf(name) ? { folder: folderOf(name) } : {}) })),
    }));
  };
  const line = (dialog: HTMLElement, name: string, list = 'My arrangements') => files(dialog, list).getByRole('button', { name: new RegExp(`^${name} `) });
  const pickedNames = (dialog: HTMLElement) =>
    files(dialog).queryAllByRole('button', { pressed: true }).map(b => b.querySelector('.tab-row-text')?.textContent);

  it('picks a line with a click and opens it only with a double click, a double tap, the keyboard or Open', async () => {
    keepMany(['One', 'Two']);
    renderAt();
    let dialog = openDialog();
    // Open is never greyed; with nothing picked it does nothing.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open' }));
    expect(dialog).toHaveAttribute('open');
    expect(heading()).toHaveTextContent('One');
    // A click picks Two and leaves One open.
    fireEvent.click(line(dialog, 'Two'), { detail: 1 });
    expect(dialog).toHaveAttribute('open');
    expect(heading()).toHaveTextContent('One');
    expect(pickedNames(dialog)).toEqual(['Two']);
    expect(line(dialog, 'One')).toHaveAttribute('aria-current', 'true');
    // A click on another picks it instead: no double click across two lines.
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    expect(pickedNames(dialog)).toEqual(['One']);
    expect(dialog).toHaveAttribute('open');
    // A double click opens.
    doubleClick(line(dialog, 'Two'));
    expect(heading()).toHaveTextContent('Two');
    expect(dialog).not.toHaveAttribute('open');
    // Two taps the browser counts as one each, close together, open too.
    dialog = openDialog();
    expect(pickedNames(dialog)).toEqual([]);
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    expect(heading()).toHaveTextContent('One');
    // Enter or Space on a line (a click with no count) opens it.
    dialog = openDialog();
    fireEvent.click(line(dialog, 'Two'), { detail: 0 });
    expect(heading()).toHaveTextContent('Two');
    // So does Open, on the line picked.
    dialog = openDialog();
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open' }));
    expect(heading()).toHaveTextContent('One');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('does not open on two taps far apart', () => {
    keepMany(['One', 'Two']);
    renderAt();
    const dialog = openDialog();
    const stamp = vi.spyOn(Event.prototype, 'timeStamp', 'get').mockReturnValue(1000);
    fireEvent.click(line(dialog, 'Two'), { detail: 1 });
    stamp.mockReturnValue(1000 + DOUBLE_TAP_MS);
    fireEvent.click(line(dialog, 'Two'), { detail: 1 });
    stamp.mockRestore();
    expect(heading()).toHaveTextContent('One');
    expect(dialog).toHaveAttribute('open');
  });

  it('lets the picked lines go on Esc, keeping the dialog open, or a press on its empty space (Jeremy, 2026-11-01)', async () => {
    keepMany(['A1', 'A2', 'A3']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(line(dialog, 'A1'), { detail: 1 });
    fireEvent.click(line(dialog, 'A2'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2']);
    // Esc is taken (so the dialog's own Esc doesn't close it) and the picks go.
    expect(fireEvent.keyDown(dialog, { key: 'Escape' })).toBe(false);
    expect(pickedNames(dialog)).toEqual([]);
    // With nothing picked, Esc is the dialog's again.
    expect(fireEvent.keyDown(dialog, { key: 'Escape' })).toBe(true);
    // A press on a line, a button or the preview keeps the pick; one on the list's empty space lets it go.
    fireEvent.click(line(dialog, 'A3'), { detail: 1 });
    fireEvent.pointerDown(line(dialog, 'A3'));
    fireEvent.pointerDown(await within(dialog).findByRole('region', { name: 'Preview' }));
    fireEvent.pointerDown(within(dialog).getByRole('button', { name: 'Open' }));
    expect(pickedNames(dialog)).toEqual(['A3']);
    fireEvent.pointerDown(dialog.querySelector('.tab-chooser-list')!);
    expect(pickedNames(dialog)).toEqual([]);
  });

  it('picks a range with Shift and one more with Cmd or Ctrl, and deletes them all with one Undo', async () => {
    keepMany(['A1', 'A2', 'A3', 'A4', 'A5']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(line(dialog, 'A2'), { detail: 1 });
    fireEvent.click(line(dialog, 'A4'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['A2', 'A3', 'A4']);
    // Several picked show no preview, and Open opens nothing.
    expect(within(dialog).queryByRole('button', { name: 'Insert' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open' }));
    expect(dialog).toHaveAttribute('open');
    // Shift again ranges from the same start, upward too.
    fireEvent.click(line(dialog, 'A1'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2']);
    // Cmd adds one, and takes it away again; Ctrl does the same.
    fireEvent.click(line(dialog, 'A5'), { detail: 1, metaKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2', 'A5']);
    fireEvent.click(line(dialog, 'A5'), { detail: 2, metaKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2']);
    expect(dialog).toHaveAttribute('open');
    fireEvent.click(line(dialog, 'A4'), { detail: 1, ctrlKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2', 'A4']);
    // A picked line's Delete (each picked line has one) deletes every picked one, the open one among them.
    const deletes = files(dialog).getAllByRole('button', { name: 'Delete 3 arrangements' });
    expect(deletes).toHaveLength(3);
    fireEvent.click(deletes[1]);
    await settle();
    expect(names(dialog)).toEqual(['A3', 'A5']);
    expect(pickedNames(dialog)).toEqual([]);
    expect(heading()).toHaveTextContent('A3');
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Deleted 3 arrangements.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(names(dialog)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(['a', 'b', 'd'].every(id => localStorage.getItem(arrangementKey(id)) !== null)).toBe(true);
  });

  it('deletes only its own line from a line that is not picked, and the picked ones with the Delete key', async () => {
    keepMany(['A1', 'A2', 'A3', 'A4']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(line(dialog, 'A2'), { detail: 1 });
    fireEvent.click(line(dialog, 'A3'), { detail: 1, shiftKey: true });
    fireEvent.click(files(dialog).getByRole('button', { name: 'Delete A4' }));
    expect(names(dialog)).toEqual(['A1', 'A2', 'A3']);
    expect(pickedNames(dialog)).toEqual([]);
    fireEvent.click(line(dialog, 'A1'), { detail: 1 });
    fireEvent.click(line(dialog, 'A2'), { detail: 1, metaKey: true });
    fireEvent.keyDown(line(dialog, 'A2'), { key: 'Backspace' });
    await settle();
    expect(names(dialog)).toEqual(['A3']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Deleted 2 arrangements.');
    // With nothing picked, Delete does nothing.
    fireEvent.keyDown(line(dialog, 'A3'), { key: 'Delete' });
    expect(names(dialog)).toEqual(['A3']);
  });

  it('shows the open arrangement\'s folder on opening, lets go of picks on leaving a folder, and drags the picked ones together', () => {
    keepMany(['Inside', 'Top 1', 'Top 2'], [{ id: 'f', name: 'Riffs', holds: ['Inside'] }]);
    renderAt();
    const dialog = openDialog();
    expect(places(dialog).getByRole('button', { name: 'Riffs' })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(line(dialog, 'Inside', 'Riffs'), { detail: 1 });
    fireEvent.click(places(dialog).getByRole('button', { name: 'My arrangements' }));
    expect(pickedNames(dialog)).toEqual([]);
    fireEvent.click(line(dialog, 'Top 1'), { detail: 1 });
    fireEvent.click(line(dialog, 'Top 2'), { detail: 1, metaKey: true });
    // Dragging one picked line carries both into the folder.
    drag(line(dialog, 'Top 1').closest('li')!, places(dialog).getByRole('button', { name: 'Riffs' }));
    expect(loadLibrary().items.filter(i => i.folder === 'f').map(i => i.name).sort()).toEqual(['Inside', 'Top 1', 'Top 2']);
  });
});
