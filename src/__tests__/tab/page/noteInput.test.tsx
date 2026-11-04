import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTex, undo } from './helpers';

setUpPage();

describe('TabPage normal mode and note input (issue #238)', () => {
  const pencil = () => screen.getByRole('button', { name: 'Note input' });

  it('starts in normal mode; N and the pencil go in and out of note input, Esc out', () => {
    renderAt();
    act(() => editor().focus());
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    keys('n', 'ArrowDown');
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    expect(editor()).toHaveAccessibleName(/note input/);
    // Esc leaves note input and keeps the tab.
    keys('Escape');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    expect(editor()).toHaveFocus();
    fireEvent.click(pencil());
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    keys('n', 'ArrowDown');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws the cursor outlined in note input and the selected note filled in normal mode', () => {
    renderAt();
    act(() => editor().focus());
    keys('5');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    keys('n', 'ArrowDown');
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(screen.queryByTestId('selected-note')).toBeNull();
  });

  it('in normal mode a digit types the selected tab note’s fret, ↑ ↓ change it by one, Ctrl/⌘+↑ ↓ move it a string', () => {
    renderAt();
    act(() => editor().focus());
    keys('5', 'ArrowUp');
    expect(alphaTex()).toBe('6.1.1 |');
    keys('ArrowDown', 'ArrowDown');
    expect(alphaTex()).toBe('4.1.1 |');
    // The open string is as low as it goes.
    keys('0', 'ArrowDown');
    expect(alphaTex()).toBe('0.1.1 |');
    keys('4', { key: 'ArrowDown', ctrlKey: true });
    expect(alphaTex()).toBe('9.2.1 |');
    keys({ key: 'ArrowUp', metaKey: true });
    expect(alphaTex()).toBe('4.1.1 |');
  });

  it('in normal mode ← → select the next column and add no rests; in note input → adds one to type on', () => {
    renderAt();
    act(() => editor().focus());
    keys('5', 'ArrowRight', 'ArrowRight');
    expect(alphaTex()).toBe('5.1.1 |');
    // Going in picks no string; ↑ picks the last one back.
    keys('n', 'ArrowUp', 'ArrowRight', '7');
    // From the clip's last Column → starts a new bar, and 7 takes the length of the note there.
    expect(alphaTex()).toBe('5.1.1 |\n7.1.1 |');
    // Back in normal mode, ← on a column with no note on the string selects the column.
    keys('Escape', 'ArrowDown');
    expect(alphaTex()).toBe('5.1.1 |\n6.1.1 |');
  });

  it('Alt+↑ ↓ select the next note up or down in the chord', () => {
    renderAt();
    act(() => editor().focus());
    // A chord typed in note input: 5 on the high e, 7 on the B.
    keys('n', 'ArrowDown', '5', 'ArrowDown', '7', 'Escape');
    // The B's 7 is selected; Alt+↑ selects the e's 5, which ↑ then raises.
    keys({ key: 'ArrowUp', altKey: true }, 'ArrowUp');
    expect(alphaTex()).toBe('(6.1 7.2).4 r.4 r.2 |');
    keys({ key: 'ArrowDown', altKey: true }, 'ArrowDown');
    expect(alphaTex()).toBe('(6.1 6.2).4 r.4 r.2 |');
  });

  it('Shift with a digit’s key sets the selected note’s length in normal mode, the next note’s in note input', () => {
    renderAt();
    act(() => editor().focus());
    keys('5', { key: '^', shiftKey: true, code: 'Digit6' });
    expect(alphaTex()).toBe('5.1.2 r.2 |');
    // In note input the note already there keeps its length; the next one takes the new one.
    keys('n', { key: '$', shiftKey: true, code: 'Digit4' });
    expect(alphaTex()).toBe('5.1.2 r.2 |');
    keys('ArrowUp', 'ArrowRight', '7');
    expect(alphaTex()).toMatch(/^5\.1\.2 7\.1\.8 /);
  });

  it('in note input W Q, + − and the Duration buttons set the next note’s length and light it', () => {
    renderAt();
    act(() => editor().focus());
    keys('n', 'ArrowDown', '5', 'ArrowRight');
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

  it('a note of note input’s length takes its time from the rests after it', async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.4 r.4 r.4 r.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('5.1.4 r.4 r.4 r.4 |'), SLOW);
    act(() => editor().focus());
    keys('n', 'ArrowDown', 'ArrowRight', { key: '^', shiftKey: true, code: 'Digit6' }, '7');
    expect(alphaTex()).toBe('5.1.4 7.1.2 r.4 |');
  });

  it('going into note input picks no string, on a note or off one (Jeremy, 2026-10-30, 2026-10-31)', () => {
    renderAt();
    act(() => editor().focus());
    keys('n');
    // No box goes round the column either: the shadow square under the mouse is the cursor (Jeremy, 2026-10-31).
    expect(screen.queryByTestId('input-cursor')).toBeNull();
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    // A digit types nothing until ↑ ↓ or a press picks a string.
    keys('5');
    expect(alphaTex()).toBe('|');
    keys('ArrowDown', '5');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    // Off a note again (the B string, empty), going back in picks nothing.
    keys('ArrowDown', 'Escape', 'n');
    expect(screen.queryByTestId('input-cursor')).toBeNull();
    // On a note, too, nothing is picked (the first ↑ picks the B string back, the second goes up to the 5).
    keys('ArrowUp', 'ArrowUp', 'Escape');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    keys('n');
    expect(screen.queryByTestId('input-cursor')).toBeNull();
    expect(screen.queryByTestId('selected-note')).toBeNull();
    // ↑ ↓ pick the string back.
    keys('ArrowUp');
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    // The palette's pencil does the same as N.
    keys('ArrowDown', 'Escape');
    fireEvent.click(screen.getByRole('button', { name: 'Note input' }));
    expect(screen.queryByTestId('input-cursor')).toBeNull();
  });

  it('N anywhere on the page goes into note input, but not in a text field', () => {
    renderAt();
    const pencil = () => screen.getByRole('button', { name: 'Note input' });
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    expect(editor()).toHaveFocus();
    keys('n', 'ArrowDown');
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

  it('Shift+N steps the harmonic, as N did', () => {
    renderAt();
    act(() => editor().focus());
    keys('5', 'N');
    expect(alphaTex()).toBe('5.1{nh}.1 |');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('Insert puts in a Gap as long as the picked note, the selection, or note input’s length, pushing the music on (step 4)', async () => {
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
    // Note input, an eighth: an eighth later, notes tied over where the beats now fall.
    keys('Escape');
    act(() => editor().focus());
    keys('n', 'ArrowDown', 'q', 'Insert');
    expect(alphaTex()).toBe('1.1.4 r.8 2.1.8 -.1.8 3.1.4 4.1.8 |\n-.1.8 r.8 r.4 r.2 |');
  });
});
