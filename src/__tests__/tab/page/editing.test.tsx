import { vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setUpPage, renderAt, alphaTexText, notice, paste, SLOW, settle, undo, pressFirstTimeSignature, litFrets, editor, vibrato, keys, alphaTex, openWith } from './helpers';
import { tool } from '../tool';

setUpPage();

describe('TabPage editing', () => {

  it('types frets, two digits making one, and moves on with the arrows', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('ArrowDown', 'ArrowDown', '1', '2', 'ArrowRight', '1', '4', 'ArrowDown', '0');
    // The bar stays full: each note writes over the bar's Gap (step 4).
    expect(alphaTex()).toBe('12.3.4 (14.3 0.4).4 r.2 |');
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
  });

  it('draws a band only behind a Shift selection, never behind the cursor alone', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('5', 'ArrowRight', '7');
    const band = () => screen.queryByTestId('tab-cursor')?.querySelector('rect[fill="var(--select-soft)"]') ?? null;
    expect(band()).toBeNull();
    expect(litFrets()).toHaveLength(0);
    keys({ key: 'ArrowLeft', shiftKey: true });
    expect(litFrets().length).toBeGreaterThan(0);
    // Starting it let the note go: no box follows the cursor through it, and none is picked after.
    expect(screen.getByTestId('tab-cursor').querySelector('rect')).toBeNull();
    keys('ArrowRight');
    expect(litFrets()).toHaveLength(0);
    // In note input no box goes round the column (Jeremy, 2026-10-31).
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    // Moving the cursor, any way, lets the selection go.
    keys({ key: 'ArrowLeft', shiftKey: true }, 'ArrowUp');
    expect(litFrets()).toHaveLength(0);
    keys({ key: 'ArrowRight', shiftKey: true }, 'ArrowDown');
    expect(litFrets()).toHaveLength(0);
    keys({ key: 'ArrowLeft', shiftKey: true }, 'ArrowRight');
    expect(litFrets()).toHaveLength(0);
  });

  it('marks notes and columns from the keys and from the palette', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    // − shortens the note in normal mode; in note input it is the next note's length (issue #238).
    keys('5', 'ArrowRight', '7', 'h', 'Escape', '-', 'n');
    fireEvent.click(vibrato());
    // A note made shorter leaves rests in the time it gave up, as MuseScore's does (issue #290).
    expect(alphaTex()).toBe('5.1{h}.4 7.1{v}.8 r.8 r.2 |');
    expect(vibrato()).toHaveAttribute('aria-pressed', 'true');
    expect(tool('Eighth note')).toHaveAttribute('aria-pressed', 'true');
    // Off the tab, no button is lit but note input's pencil, which says the mode, not the note.
    act(() => editor().blur());
    expect(screen.getAllByRole('button', { pressed: true }).filter(b => b.closest('.tab-palette')).map(b => b.getAttribute('aria-label'))).toEqual(['Note input']);
  });

  it('acts on nothing from the palette once the cursor has left the tab, by Esc or a press elsewhere', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('5', 'ArrowRight', '7');
    const pressAll = () => {
      fireEvent.click(tool('Eighth note'));
      fireEvent.click(vibrato());
      fireEvent.click(tool('Insert a bar of rests after this bar'));
      fireEvent.click(tool('Bend'));
      fireEvent.click(screen.getByRole('button', { name: 'full' }));
    };
    // The first Esc leaves note input, the second the tab.
    keys('Escape', 'Escape');
    expect(editor()).not.toHaveFocus();
    pressAll();
    expect(alphaTex()).toBe('5.1.4 7.1.4 r.2 |');
    // alphaTex() gave the keys back to the tab; a press off it takes them away again.
    act(() => editor().blur());
    pressAll();
    expect(alphaTex()).toBe('5.1.4 7.1.4 r.2 |');
    // Back on the tab, the same buttons change the cursor's note.
    fireEvent.click(tool('Eighth note'));
    expect(alphaTex()).toBe('5.1.4 7.1.8 r.8 r.2 |');
  });

  it('picks a bend amount from the Bend button\'s panel, and takes it away with None', async () => {
    await openWith('7.1.1 |');
    const bend = () => tool('Bend');
    fireEvent.click(bend());
    expect(bend()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'full' }));
    expect(alphaTex()).toBe('7.1{b (0 4)}.1 |');
    expect(screen.queryByRole('dialog', { name: 'Bend' })).toBeNull();
    expect(bend()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(bend());
    expect(screen.getByRole('button', { name: 'full' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '½' }));
    expect(alphaTex()).toBe('7.1{b (0 2)}.1 |');
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(alphaTex()).toBe('7.1.1 |');
    fireEvent.click(bend());
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(bend());
    // Esc closes the panel and leaves the cursor on the tab.
    fireEvent.click(bend());
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Bend' })).toBeNull();
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
  });

  it('steps V, Shift+N, A and \\ through their kinds, and toggles I, G and S', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('5', 'v', 'v', 'N', 'N', 'a', 'a', '\\', 'i', 'g', 's');
    expect(alphaTex()).toBe('5.1{sod vw ph lr g hac st}.4 r.4 r.2 |');
    expect(vibrato()).toHaveAttribute('aria-pressed', 'true');
    keys('v', 'g');
    expect(alphaTex()).toBe('5.1{sod ph lr hac st}.4 r.4 r.2 |');
  });

  it('marks a bar with something wrong under its start, the words as the tip', async () => {
    // Edits keep bars even, so an Uneven bar comes from a link (step 4).
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.8 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.8 |'), SLOW);
    act(() => editor().focus());
    // One eighth: the bar doesn't add up.
    expect(screen.getByTestId('bar-warning').getAttribute('data-tip')).toBe("Bar 1 doesn't add up to 4/4: 3 beats and an 8th short.");
  });

  it('marks a linked bar holding a broken tuplet, the words as the tip', async () => {
    // A lone triplet eighth (step 6: a tuplet made by the keys keeps the bar full, so this too comes from a link).
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.8{tu 3} |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.8{tu 3} |'), SLOW);
    const warning = screen.getByTestId('bar-warning');
    expect(warning.getAttribute('data-tip')).toBe("Bar 1 doesn't add up to 4/4: 3 beats and a quarter triplet short. The tuplet of 3 in bar 1 has 1 note; it needs 3.");
  });

  it('opens a popover on a press on the ⚠ whose command fixes the bar, and closes after it', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.4 | 7.1.1 7.1.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.4 |\n7.1.1 7.1.4 |'), SLOW);
    const press = (n: number) => fireEvent.pointerDown(screen.getAllByTestId('bar-warning')[n], { button: 0, clientX: 10, clientY: 10 });
    // A short bar 1: Fill with rests, or make it a Pickup bar.
    press(0);
    const popover = screen.getByRole('dialog', { name: 'Fix this bar' });
    expect(within(popover).getAllByRole('button').map(b => b.textContent)).toEqual(['Fill with rests', 'Make pickup bar']);
    fireEvent.click(within(popover).getByRole('button', { name: 'Make pickup bar' }));
    expect(screen.queryByRole('dialog', { name: 'Fix this bar' })).toBeNull();
    expect(screen.getAllByTestId('bar-warning')).toHaveLength(1);
    // The overfull bar: its extra quarter goes on into a new bar.
    press(0);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Fix this bar' })).getByRole('button', { name: 'Move extra into next bar' }));
    expect(screen.queryByTestId('bar-warning')).toBeNull();
    expect(alphaTex()).toBe('\\ac 5.1.4 |\n7.1.1 |\n7.1.4 r.4 r.2 |');
  });

  it('writes free text over a column from the palette, and edits it from a press on it', async () => {
    await openWith('5.1.1 |');
    fireEvent.click(tool('Text over this column'));
    const field = screen.getByRole('textbox', { name: 'Text over the column' });
    // Long enough for a few wrapped lines (issue #323); a chord name's field stops at 40.
    expect(field).toHaveAttribute('maxLength', '200');
    fireEvent.change(field, { target: { value: 'let "it" ring' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('beat-text')).toHaveTextContent('let "it" ring');
    expect(tool('Text over this column')).toHaveAttribute('aria-pressed', 'true');
    expect(alphaTex()).toBe('5.1.1{txt "let \\"it\\" ring"} |');
    // Empty clears it.
    fireEvent.click(tool('Text over this column'));
    const again = screen.getByRole('textbox', { name: 'Text over the column' });
    expect(again).toHaveValue('let "it" ring');
    fireEvent.change(again, { target: { value: '' } });
    fireEvent.keyDown(again, { key: 'Enter' });
    expect(screen.queryByTestId('beat-text')).toBeNull();
  });

  it('names a chord from C and a field over the tab, and sets the capo from the palette', async () => {
    await openWith('5.1.1 |');
    keys('c');
    const field = screen.getByRole('textbox', { name: 'Chord name' });
    fireEvent.change(field, { target: { value: 'Am7' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.queryByRole('textbox', { name: 'Chord name' })).not.toBeInTheDocument();
    fireEvent.click(tool('Capo'));
    const capo = screen.getByRole('textbox', { name: 'Capo on fret, 1 to 12' });
    fireEvent.change(capo, { target: { value: '3' } });
    fireEvent.keyDown(capo, { key: 'Enter' });
    expect(screen.getByTestId('capo')).toHaveTextContent('Capo 3');
    expect(tool('Capo')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\\capo 3\n5.1.1{ch "Am7"} |');
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    // An empty field, or 0, takes the capo off; the palette acts only while the tab has the keys.
    act(() => editor().focus());
    fireEvent.click(tool('Capo'));
    const again = screen.getByRole('textbox', { name: 'Capo on fret, 1 to 12' });
    expect(again).toHaveValue('3');
    fireEvent.change(again, { target: { value: '0' } });
    fireEvent.keyDown(again, { key: 'Enter' });
    expect(screen.queryByTestId('capo')).toBeNull();
  });

  it('selects with Shift+arrows, copies the selection as alphaTex, makes rests of it and deletes it', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('5', 'ArrowRight', '7', 'ArrowRight', '9', { key: 'ArrowLeft', shiftKey: true });
    // The two selected notes are lit, with no band behind them (Jeremy, 2026-10-30).
    expect(litFrets().map(t => t.textContent)).toEqual(['7', '9']);
    const data = new Map<string, string>();
    const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
    act(() => { editor().dispatchEvent(copy); });
    expect(data.get('text/plain')).toBe('\\ts (4 4)\n7.1.4 9.1.4 |\n');
    // Bars stay full (issue #238): Backspace leaves rests, the selection still there; Ctrl+Backspace takes the time.
    keys('Backspace');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    expect(litFrets()).toHaveLength(0);
    // The last bar ends in a Gap: no bars come off the end (step 4).
    keys({ key: 'Backspace', ctrlKey: true });
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
  });

  it('pastes over the time from the cursor, Ctrl/⌘+Shift+V inserts, and a cut leaves rests (issue #238)', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('1.1.4 2.1.4 3.1.4 4.1.4 |'), SLOW);
    act(() => editor().focus());
    keys('ArrowRight');
    await paste('9.2.4 10.2.4 |');
    // alphaTex() changes the page, so it is read after the paste settles, not polled.
    await settle();
    expect(alphaTex()).toBe('1.1.4 9.2.4 10.2.4 4.1.4 |');
    // What was pasted is selected, as MuseScore leaves it (Jeremy, 2026-10-31).
    expect(litFrets().map(t => t.textContent)).toEqual(['9', '10']);
    // Esc lets the selection go, the cursor on its last column; → goes on to the 4, and Insert paste goes before it.
    keys('Escape');
    act(() => editor().focus());
    keys('ArrowRight', { key: 'V', ctrlKey: true, shiftKey: true });
    await paste('7.3.4 |');
    await settle();
    // Insert paste pushes the 4 on into a new bar (step 4).
    expect(alphaTex()).toBe('1.1.4 9.2.4 10.2.4 7.3.4 |\n4.1.4 r.4 r.2 |');
    // A plain paste writes over again: ← selects the 10, which the 8 replaces.
    keys('ArrowLeft');
    await paste('8.3.4 |');
    await settle();
    expect(alphaTex()).toBe('1.1.4 9.2.4 8.3.4 7.3.4 |\n4.1.4 r.4 r.2 |');
    // Cut leaves rests where the notes were, still selected; no box is left round a column.
    keys({ key: 'ArrowRight', shiftKey: true });
    const cut = new Event('cut', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    cut.clipboardData = { setData: () => {} };
    act(() => { editor().dispatchEvent(cut); });
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    expect(alphaTex()).toBe('1.1.4 9.2.4 r.2 |\n4.1.4 r.4 r.2 |');
  }, 20000);



  it('Esc drops a selection and leaves the tab, with nothing drawn', () => {
    renderAt();
    act(() => editor().focus());
    keys('5', 'ArrowRight', '7', 'ArrowRight', '9', { key: 'ArrowLeft', shiftKey: true }, { key: 'ArrowLeft', shiftKey: true });
    keys('Escape');
    expect(litFrets()).toHaveLength(0);
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(editor()).not.toHaveFocus();
  });

  it('Esc on a note leaves the tab at once, with no box left round its column', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('5', 'ArrowRight', '7');
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    // The first Esc leaves note input, the second the tab.
    keys('Escape', 'Escape');
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    expect(editor()).not.toHaveFocus();
    expect(alphaTex()).toBe('5.1.4 7.1.4 r.2 |');
  });

  it('never boxes a column in normal mode: a fret deleted, then the arrows over its rest (Jeremy, 2026-10-31)', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('1.1.4 2.1.4 3.1.4 4.1.4 |'), SLOW);
    const two = screen.getAllByText('2').find(t => t.closest('[data-testid="tab-column"]'))!;
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const top = Number(/translate\(0 ([\d.-]+)\)/.exec(two.closest('[data-testid="tab-system"]')!.getAttribute('transform')!)![1]);
    const at = { clientX: Number(two.getAttribute('x')), clientY: top + Number(two.getAttribute('y')) - 4 };
    fireEvent.pointerDown(svg, { ...at, button: 0 });
    fireEvent.pointerUp(svg, { ...at, button: 0 });
    keys('Delete');
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowRight']) {
      keys(key);
      expect(screen.queryByTestId('column-cursor')).toBeNull();
    }
    // On the rest, it is lit as a selection is.
    expect(alphaTex()).toBe('1.1.4 r.4 3.1.4 4.1.4 |');
  });

  it('Delete off the notes of a column makes it a rest, which stays; Ctrl/⌘+Delete removes it', () => {
    renderAt();
    act(() => editor().focus());
    // Typing is note input's (issue #238).
    keys('n', 'ArrowDown');
    keys('5', 'ArrowDown', '7', 'ArrowRight', '3', 'ArrowDown', 'ArrowDown');
    // On string 3, under a column whose notes are on strings 1 and 2.
    keys('ArrowLeft', 'Delete');
    expect(alphaTex()).toBe('r.4 3.2.4 r.2 |');
    keys('Delete');
    expect(alphaTex()).toBe('r.4 3.2.4 r.2 |');
    // It takes the rest's time and pulls the music after it back (step 4).
    keys({ key: 'Delete', metaKey: true });
    expect(alphaTex()).toBe('3.2.4 r.4 r.2 |');
  });

  it('sets the time signature from the palette, each change one undo step, re-barring the music', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.4 5.1.4 5.1.4 7.1.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.4 5.1.4 5.1.4 7.1.4 |'), SLOW);
    act(() => editor().focus());
    const drawn = () => screen.getAllByTestId('time-signature')[0].textContent;
    // In the first bar the palette button opens the clip's own time signature, as a press on the drawn 4/4 does.
    fireEvent.click(tool('Time signature from this bar'));
    const panel = screen.getByRole('dialog', { name: 'Time signature' });
    const beats = within(panel).getByRole('textbox', { name: 'Beats in a bar' });
    expect(beats).toHaveValue('4');
    // A typed count takes effect on Enter, and the music is re-barred: the 7 goes on into a new bar (step 4).
    fireEvent.change(beats, { target: { value: '3' } });
    expect(drawn()).toBe('44');
    fireEvent.keyDown(beats, { key: 'Enter' });
    expect(drawn()).toBe('34');
    expect(screen.getAllByTestId('tab-column')).toHaveLength(6);
    // ↑ and + step at once; the beat is one of 2, 4, 8, 16, 32.
    fireEvent.keyDown(beats, { key: 'ArrowUp' });
    fireEvent.click(within(panel).getByRole('button', { name: 'More beats' }));
    expect(beats).toHaveValue('5');
    fireEvent.click(within(panel).getByRole('button', { name: '8' }));
    expect(within(panel).getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'true');
    // No bar is left Uneven, so nothing is said.
    expect(screen.queryByTestId('bar-warning')).toBeNull();
    undo();
    expect(drawn()).toBe('54');
    undo();
    expect(beats).toHaveValue('4');
    // Esc closes the panel.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
    // Back in 4/4 the music is as it was, with no bar of rests left over.
    expect(alphaTex()).toBe('5.1.4 5.1.4 5.1.4 7.1.4 |');
  });

  it('sets the key signature on the piano keys, Major or Minor keeping its signs', async () => {
    await openWith('5.1.1 |');
    fireEvent.click(tool('Key signature from this bar'));
    const panel = screen.getByRole('dialog', { name: 'Key signature' });
    expect(panel).toHaveTextContent('Key signature: C major');
    // D♯ is a key no signature writes; the tile picks E♭, as it names it.
    fireEvent.click(within(panel).getByRole('radio', { name: 'E♭' }));
    expect(panel).toHaveTextContent('Key signature: E♭ major');
    fireEvent.click(within(panel).getByRole('button', { name: 'Minor' }));
    expect(panel).toHaveTextContent('Key signature: C minor');
    expect(alphaTex()).toBe('\\ks Cminor 5.1.1 |');
  });

  it('keeps the count when what is typed isn\'t 1 to 32', () => {
    renderAt();
    pressFirstTimeSignature();
    const beats = screen.getByRole('textbox', { name: 'Beats in a bar' });
    for (const typed of ['0', '33', '']) {
      fireEvent.change(beats, { target: { value: typed } });
      fireEvent.blur(beats);
      expect(beats).toHaveValue('4');
    }
    fireEvent.change(beats, { target: { value: '32' } });
    fireEvent.blur(beats);
    expect(beats).toHaveValue('32');
    fireEvent.keyDown(beats, { key: 'ArrowUp' });
    expect(beats).toHaveValue('32');
    fireEvent.change(beats, { target: { value: '1' } });
    fireEvent.blur(beats);
    fireEvent.click(screen.getByRole('button', { name: 'Fewer beats' }));
    expect(beats).toHaveValue('1');
  });

  it('says when a bar doesn\'t add up', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.4 |'), SLOW);
    expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4: 3 beats short.');
  });
});
