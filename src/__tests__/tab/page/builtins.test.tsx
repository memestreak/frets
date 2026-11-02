import { vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readAscii } from '@/features/tab/ascii';
import { loadLibrary } from '@/features/tab/arrangements';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { setUpPage, OTHER, renderAt, heading, notice, SLOW, settle, undo, keepOpen, doubleClick } from './helpers';

setUpPage();

describe('TabPage built-in arrangements (issue #259)', () => {
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
  const openDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Arrangements…' }));
    return screen.getByRole('dialog', { name: 'Arrangements' });
  };
  const place = async (dialog: HTMLElement, name: string) =>
    fireEvent.click(await within(within(dialog).getByRole('navigation', { name: 'Places' })).findByRole('button', { name }));

  it('opens a built-in as a new arrangement, not saved, its link in the address until it is edited', async () => {
    renderAt();
    const dialog = openDialog();
    await place(dialog, 'Articulations');
    doubleClick(within(dialog).getByRole('button', { name: 'Bends and vibrato' }));
    await screen.findByRole('heading', { name: 'Bends and vibrato' }, SLOW);
    expect(window.location.hash).toBe('#example=bends');
    expect(loadLibrary().items).toEqual([]);
    expect(screen.queryByTestId('unsaved')).toBeNull();
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    fireEvent.keyDown(editor(), { key: 'ArrowDown' });
    fireEvent.keyDown(editor(), { key: '9' });
    expect(screen.getByTestId('unsaved')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    // Save asks for a name, the built-in's to start with, and keeps it.
    fireEvent.click(screen.getByRole('button', { name: 'Save, unsaved changes' }));
    const saveAs = screen.getByRole('dialog', { name: 'Save as' });
    expect(within(saveAs).getByRole('textbox', { name: 'Name' })).toHaveValue('Bends and vibrato');
    fireEvent.click(within(saveAs).getByRole('button', { name: 'Save' }));
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Bends and vibrato']);
    expect(screen.queryByTestId('unsaved')).toBeNull();
  });

  it('lists the built-ins at once and opens one without fetching again, closing the dialog at the press', async () => {
    renderAt();
    const fetched = vi.mocked(fetch);
    // Read when the page opens, so the first opening already lists them.
    await waitFor(() => expect(fetched).toHaveBeenCalledWith(BUILTIN_URL, expect.anything()));
    await settle();
    const dialog = openDialog();
    await place(dialog, 'Samples');
    await settle();
    // The sound font may load meanwhile; only the built-ins' list counts.
    const builtinCalls = () => fetched.mock.calls.filter(c => c[0] === BUILTIN_URL).length;
    const calls = builtinCalls();
    doubleClick(within(dialog).getByRole('button', { name: 'Oceanic Speedy Down Run' }));
    expect(screen.queryByRole('dialog', { name: 'Arrangements' })).toBeNull();
    await screen.findByRole('heading', { name: 'Oceanic Speedy Down Run' }, SLOW);
    expect(window.location.hash).toBe('#example=oceanic-speedy-down-run');
    // The text came with the dialog's list: only the reading on opening fetched it again.
    expect(builtinCalls()).toBe(calls);
  });

  it('opens the example in an #example= link and keeps the link until the clip changes', async () => {
    renderAt('#example=repeats');
    await screen.findByRole('heading', { name: 'Repeats and endings' }, SLOW);
    expect(window.location.hash).toBe('#example=repeats');
    expect(screen.getAllByTestId('repeat-start').length).toBeGreaterThan(0);
  });

  it('says so when a link names no example, and takes the link out', async () => {
    renderAt('#example=nope');
    await waitFor(() => expect(notice()).toHaveTextContent('There is no example called "nope".'), SLOW);
    expect(window.location.hash).toBe('');
  });

  it('shows a picked file in a preview, from which Insert puts it in at the cursor as one undo step', async () => {
    keepOpen((readAscii(OTHER) as { clip: unknown }).clip);
    renderAt();
    const pageColumns = () => within(editor()).getAllByTestId('tab-column');
    const columns = pageColumns().length;
    const dialog = openDialog();
    // No preview pane until a file is picked.
    expect(within(dialog).queryByRole('region', { name: 'Preview' })).toBeNull();
    await place(dialog, 'Song structure');
    expect(within(dialog).queryByRole('region', { name: 'Preview' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Drop D' }), { detail: 1 });
    expect(await within(dialog).findByRole('img', { name: 'Drop D, a preview' }, SLOW)).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    // The page is as it was until Insert.
    expect(pageColumns()).toHaveLength(columns);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }));
    expect(dialog).not.toHaveAttribute('open');
    expect(pageColumns().length).toBeGreaterThan(columns);
    // Inserting is an edit of the open arrangement, not a new one.
    expect(heading()).toHaveTextContent('Untitled');
    expect(screen.getByTestId('unsaved')).toBeInTheDocument();
    undo();
    expect(pageColumns()).toHaveLength(columns);
    expect(screen.queryByTestId('unsaved')).toBeNull();
  });

  it('copies a picked file as alphaTex from its preview', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt();
    const dialog = openDialog();
    await place(dialog, 'Song structure');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Drop D' }), { detail: 1 });
    await within(dialog).findByRole('img', { name: 'Drop D, a preview' }, SLOW);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Copy alphaTex' })); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('\\title "Drop D"'));
  });
});
