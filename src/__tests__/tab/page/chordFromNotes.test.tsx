/**
 * Chord from notes on the page (issue #464, `docs/specs/2026-11-13-tab-chord-from-notes-design.md`): the note
 * menu's Chord from notes (and the bar menu's, on picked bars) names the selected notes, or the cursor's column,
 * as one chord over the first column, its shape in the Chord set, in one undo step; under a capo the name is the
 * shape's, or with Settings › Tab › Editing set so, the sounding one; the menus offer it only on notes.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { setUpPage, openWith, renderAt, editor, keys, alphaTex, undo, SLOW } from './helpers';
import { EDITING_KEY } from '@/features/tab/editingPrefs';

setUpPage();

/** The tab's menu from the keys (Shift+F10's contextmenu, no press): the note menu on a picked note or selection. */
const openMenu = () => fireEvent.contextMenu(editor());
const chooseChordFromNotes = () => {
  openMenu();
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Chord from notes' }));
};

/** The page open on a clip with header lines (a capo, \\chord definitions), which `openWith` can't wait for. */
async function openText(text: string) {
  renderAt(`#tab=${encodeURIComponent(`\\ts (4 4)\n${text}`)}`);
  await screen.findAllByTestId('tab-system', {}, SLOW);
  act(() => editor().focus());
}

/** An A minor arpeggio, eighths, then a half rest. */
const ARPEGGIO = '0.5.8 2.4.8 2.3.8 1.2.8 r.2 |';

describe('chord from notes', { timeout: 20000 }, () => {
  it('names an arpeggio picked with Shift+Right as one chord over its first note, its shape in the Chord set', async () => {
    await openWith(ARPEGGIO);
    keys({ key: 'ArrowRight', shiftKey: true }, { key: 'ArrowRight', shiftKey: true }, { key: 'ArrowRight', shiftKey: true });
    chooseChordFromNotes();
    expect(alphaTex()).toBe('\\chord ("Am" x 1 2 2 0 x) 0.5.8{ch "Am"} 2.4.8 2.3.8 1.2.8 r.2 |');
    // One undo step takes back the name and the shape.
    undo();
    expect(alphaTex()).toBe(ARPEGGIO);
  });

  it('names the cursor’s column with nothing selected, counted from the capo', async () => {
    await openText('\\capo 2\n(5.1 5.2 5.3 7.4).4 r.4 r.2 |');
    chooseChordFromNotes();
    expect(alphaTex()).toContain('(5.1 5.2 5.3 7.4).4{ch "Am"}');
  });

  it('names what sounds under the capo when Settings › Tab › Editing says so', async () => {
    localStorage.setItem(EDITING_KEY, JSON.stringify({ chordNames: 'sounding' }));
    await openText('\\capo 2\n(5.1 5.2 5.3 7.4).4 r.4 r.2 |');
    chooseChordFromNotes();
    expect(alphaTex()).toContain('(5.1 5.2 5.3 7.4).4{ch "Bm"}');
  });

  it('says why under the clip when the notes aren’t a chord, and changes nothing', async () => {
    await openWith('5.1.4 r.4 r.2 |');
    chooseChordFromNotes();
    expect(screen.getByTestId('tab-notice')).toHaveTextContent('Pick at least two different notes');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
  });

  it('adds a second shape of a name the set has under a free name', async () => {
    await openText('\\chord ("Am" 0 1 2 2 0 x)\n(0.1 1.2 2.3 2.4 0.5).4{ch "Am"} (5.1 5.2 5.3 7.4).4 r.2 |');
    keys('ArrowRight');
    chooseChordFromNotes();
    expect(alphaTex()).toContain('(5.1 5.2 5.3 7.4).4{ch "Am 2"}');
    expect(alphaTex()).toContain('\\chord ("Am 2" 5 5 5 7 x x)');
  });

  it('is offered only on notes: not on a rest', async () => {
    await openWith('r.4 0.1.4 r.2 |');
    openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Chord from notes' })).toBeNull();
  });

  it('is in the bar menu on a selection of whole bars', async () => {
    await openWith(ARPEGGIO);
    keys({ key: 'a', ctrlKey: true });
    openMenu();
    const menu = within(screen.getByRole('menu', { name: 'Bar' }));
    fireEvent.click(menu.getByRole('menuitem', { name: 'Chord from notes' }));
    expect(alphaTex()).toContain('0.5.8{ch "Am"}');
  });
});
