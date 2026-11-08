import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTex, undo } from './helpers';

setUpPage();

// A clip from a link takes alphaTab a while to draw the first time in a busy run.
describe('TabPage normal mode and note input mode (issue #238)', { timeout: 20000 }, () => {
  const pencil = () => screen.getByRole('button', { name: 'Note input mode' });
  /** A clip to start from: digits type no frets in normal mode (Jeremy, 2026-11-07, issue #396). */
  const openWith = async (bar: string) => {
    renderAt(`#tab=${encodeURIComponent(`\\ts (4 4)\n${bar}`)}`);
    await waitFor(() => expect(alphaTex()).toBe(bar), SLOW);
    act(() => editor().focus());
  };

  it('starts in normal mode; N and the pencil go in and out of note input mode, Esc out', () => {
    renderAt();
    act(() => editor().focus());
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    keys('n');
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    expect(editor()).toHaveAccessibleName(/note input mode:/);
    // Esc leaves note input mode and keeps the tab.
    keys('Escape');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    expect(editor()).toHaveFocus();
    fireEvent.click(pencil());
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    keys('n');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws the cursor outlined in note input mode and the selected note filled in normal mode', async () => {
    await openWith('5.1.1 |');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    keys('n');
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(screen.queryByTestId('selected-note')).toBeNull();
  });

  it('in normal mode a digit sets the selected tab note’s length, never its fret; Alt+↑ ↓ change the fret by one, Ctrl/⌘+↑ ↓ move it a string', async () => {
    await openWith('5.1.1 |');
    // Alt changes the fret, as Dorico's Alt+arrows change what is picked (Jeremy, 2026-11-07, issue #396).
    keys({ key: 'ArrowUp', altKey: true });
    expect(alphaTex()).toBe('6.1.1 |');
    keys({ key: 'ArrowDown', altKey: true }, { key: 'ArrowDown', altKey: true });
    expect(alphaTex()).toBe('4.1.1 |');
    // A digit is a length, as Dorico's duration keys on a selection (Jeremy, 2026-11-07): 0 is none.
    keys('0');
    expect(alphaTex()).toBe('4.1.1 |');
    keys('5');
    expect(alphaTex()).toBe('4.1.4 r.4 r.2 |');
    keys('7');
    expect(alphaTex()).toBe('4.1.1 |');
    // The open string is as low as it goes.
    const altDown = { key: 'ArrowDown', altKey: true };
    const altUp = { key: 'ArrowUp', altKey: true };
    keys(altDown, altDown, altDown, altDown, altDown);
    expect(alphaTex()).toBe('0.1.1 |');
    keys(altUp, altUp, altUp, altUp, { key: 'ArrowDown', ctrlKey: true });
    expect(alphaTex()).toBe('9.2.1 |');
    keys({ key: 'ArrowUp', metaKey: true });
    expect(alphaTex()).toBe('4.1.1 |');
  });

  it('in normal mode ← → select the next column and add no rests; in note input mode → adds one to type on', async () => {
    await openWith('5.1.1 |');
    keys('ArrowRight', 'ArrowRight');
    expect(alphaTex()).toBe('5.1.1 |');
    // Going in on the note picks its string (Jeremy, 2026-11-07).
    keys('n', 'ArrowRight', '7');
    // From the clip's last Column → starts a new bar, and 7 takes the length of the note there.
    expect(alphaTex()).toBe('5.1.1 |\n7.1.1 |');
    // Back in normal mode the note typed stays picked, and Alt+↓ lowers it.
    keys('Escape', { key: 'ArrowDown', altKey: true });
    expect(alphaTex()).toBe('5.1.1 |\n6.1.1 |');
  });

  it('in normal mode ↑ ↓ go string by string, and Alt+↑ ↓ change the fret of the note picked (issue #396)', async () => {
    await openWith('(5.1 7.2).1 |');
    // The e's 5 is picked; ↓ picks the B's 7, which Alt+↓ lowers; nothing else changes.
    keys('ArrowDown', { key: 'ArrowDown', altKey: true });
    expect(alphaTex()).toBe('(5.1 6.2).1 |');
    keys('ArrowUp', { key: 'ArrowUp', altKey: true });
    expect(alphaTex()).toBe('(6.1 6.2).1 |');
    // ↓ to a string with no note picks the column there; Alt+↓ then has nothing to lower.
    keys('ArrowDown', 'ArrowDown', { key: 'ArrowDown', altKey: true });
    expect(alphaTex()).toBe('(6.1 6.2).1 |');
  });

  it('Shift with a digit’s key sets the selected note’s length in normal mode, the next note’s in note input mode', async () => {
    await openWith('5.1.1 |');
    keys({ key: '^', shiftKey: true, code: 'Digit6' });
    expect(alphaTex()).toBe('5.1.2 r.2 |');
    // In note input mode the note already there keeps its length; the next one takes the new one.
    keys('n', { key: '$', shiftKey: true, code: 'Digit4' });
    expect(alphaTex()).toBe('5.1.2 r.2 |');
    keys('ArrowUp', 'ArrowRight', '7');
    expect(alphaTex()).toMatch(/^5\.1\.2 7\.1\.8 /);
  });

  it('in note input mode W Q, + − and the Duration buttons set the next note’s length and light it', () => {
    renderAt();
    act(() => editor().focus());
    keys('n', '5', 'ArrowRight');
    const button = (name: string) => screen.getByRole('button', { name });
    // Going in, the length is the note's there (a quarter); Q halves it.
    keys('q');
    expect(button('Eighth note')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Quarter note')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button('Sixteenth note'));
    expect(button('Sixteenth note')).toHaveAttribute('aria-pressed', 'true');
    // The note already entered keeps its quarter.
    expect(alphaTex()).toMatch(/^5\.1\.4 /);
    keys('7', 'ArrowRight', 'w', '+', '3');
    // The quarter crosses the middle of the bar, so it is tied there (step 4).
    expect(alphaTex()).toMatch(/^5\.1\.4 7\.1\.16 3\.1\.16 -\.1\.8 -\.1\.16 /);
    // . dots the next note, not the one entered.
    keys('ArrowRight', '.');
    expect(button('Dotted, then double dotted')).toHaveAttribute('aria-pressed', 'true');
    keys('2');
    expect(alphaTex()).toBe('5.1.4 7.1.16 3.1.16 -.1.8 -.1.16 2.1.16 -.1.8 -.1.8{d} r.16 |');
  });

  it('a note of note input mode’s length takes its time from the rests after it', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.4 r.4 r.4 r.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.4 r.4 r.4 r.4 |'), SLOW);
    act(() => editor().focus());
    keys('n', 'ArrowRight', { key: '^', shiftKey: true, code: 'Digit6' }, '7');
    expect(alphaTex()).toBe('5.1.4 7.1.2 r.4 |');
  });

  it('going into note input mode lets the selection go, the cursor at its first column (Jeremy, 2026-11-06)', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n3.6.4 5.6.4 7.6.4 8.6.4 |')}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    act(() => editor().focus());
    // The last two columns selected, the cursor on the last.
    keys('ArrowRight', 'ArrowRight', { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByTestId('range-box')).toBeInTheDocument();
    keys('n');
    expect(screen.queryByTestId('range-box')).toBeNull();
    // The cursor went back to the selection's start: a fret typed (on the top string) joins the third note.
    keys('9');
    expect(alphaTex()).toMatch(/^3\.6\.4 5\.6\.4 \(9\.1 7\.6\)\.4 8\.6\.4 /);
  });

  it('going into note input mode picks the string last used off a note, and the note’s own on a picked note (Jeremy, 2026-11-07, 2026-11-08)', () => {
    renderAt();
    act(() => editor().focus());
    keys('n');
    // Off a note the caret's box goes on the string it was last on, so a fret types at once, as Dorico's
    // tab caret is always on a string (Jeremy, 2026-11-08, issue #396; no string was picked before).
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-caret')).toBeNull();
    keys('5');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    // Off a note again (the B string, empty), going back in picks the B string.
    keys('ArrowDown', 'Escape', 'n', '3');
    expect(alphaTex()).toBe('(5.1 3.2).4 r.4 r.2 |');
    // On a note picked in normal mode, the caret goes onto it, its string picked, so a digit retypes it,
    // as Dorico's caret starts on the note selected (Jeremy, 2026-11-07).
    keys('ArrowUp', 'Escape');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    keys('n');
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(screen.queryByTestId('selected-note')).toBeNull();
    keys('7');
    expect(alphaTex()).toBe('(7.1 3.2).4 r.4 r.2 |');
    // The palette's pencil does the same as N.
    keys('Escape');
    fireEvent.click(screen.getByRole('button', { name: 'Note input mode' }));
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
  });

  it('N anywhere on the page goes into note input mode, but not in a text field', () => {
    renderAt();
    const pencil = () => screen.getByRole('button', { name: 'Note input mode' });
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    expect(editor()).toHaveFocus();
    keys('n');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    act(() => editor().blur());
    fireEvent.keyDown(document.body, { key: 'n' });
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: 'n' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    field.remove();
  });

  it('Shift+N steps the harmonic, as N did', async () => {
    await openWith('5.1.1 |');
    keys('N');
    expect(alphaTex()).toBe('5.1{nh}.1 |');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('Insert puts in a Gap as long as the picked note, the selection, or note input mode’s length, pushing the music on (step 4)', async () => {
    const quarters = '\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 |';
    renderAt(`#tab=${encodeURIComponent(quarters)}`);
    await waitFor(() => expect(alphaTex()).toBe('1.1.4 2.1.4 3.1.4 4.1.4 |'), SLOW);
    act(() => editor().focus());
    // Normal mode, the 2 picked: a quarter later.
    keys('ArrowRight', 'Insert');
    expect(alphaTex()).toBe('1.1.4 r.4 2.1.4 3.1.4 |\n4.1.4 r.4 r.2 |');
    undo();
    // Beats 2–3 selected: a half later. Undo left the cursor on the 2.
    keys({ key: 'ArrowRight', shiftKey: true }, 'Insert');
    expect(alphaTex()).toBe('1.1.4 r.4 r.4 2.1.4 |\n3.1.4 4.1.4 r.2 |');
    undo();
    // Note input mode, an eighth: an eighth later, notes tied over where the beats now fall.
    keys('Escape');
    act(() => editor().focus());
    keys('n', 'q', 'Insert');
    expect(alphaTex()).toBe('1.1.4 r.8 2.1.8 -.1.8 3.1.4 4.1.8 |\n-.1.8 r.8 r.4 r.2 |');
  });
});
