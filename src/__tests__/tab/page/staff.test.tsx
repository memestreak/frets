import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setUpPage, renderAt, alphaTexText, SLOW, undo } from './helpers';
import { tool } from '../tool';

setUpPage();

describe('the notation staff (issue #122)', () => {
  it('shows the staff, the tab or both, the two joined by a bracket', async () => {
    renderAt('#example=key-signatures');
    await screen.findAllByTestId('tab-system');
    const count = (id: string) => screen.queryAllByTestId(id).length;
    expect(count('staff')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    expect(count('staff')).toBeGreaterThan(0);
    expect(count('staff-join')).toBe(count('tab-system'));
    // With the staff shown, the time signature is on it and not on the tab.
    expect(count('staff-time-signature')).toBe(1);
    expect(count('time-signature')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
    expect(count('staff-join')).toBe(0);
    // The staff alone is edited too (issue #136), so its palette stays on.
    expect(tool('Key signature from this bar')).toBeEnabled();
  });
});

describe('dragging notes on the staff (issue #174)', () => {
  /** Where a staff head is drawn (jsdom places the drawing at 0, 0): a little inside its left edge, on its line or space. */
  const headAt = (k: number) => {
    const path = screen.getAllByTestId('staff-head')[k].querySelector('path')!;
    const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(path.getAttribute('transform')!)!;
    return { clientX: Number(x) + 4, clientY: Number(y) };
  };
  const frets = () => alphaTexText().split('\n').find(line => line.includes('|'));

  it.each(['both', 'staff'])('a note selected on the staff (%s) lights its own sign where it is drawn (issue #276)', async parts => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
    // C♯ and D♯ a second apart: the heads sit side by side and the lower sign goes a lane further left.
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(6.3 4.2).4 r.4 r.2 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(2), SLOW);
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const staffPaths = () => [...screen.getByTestId('staff').querySelectorAll('path')];
    const unlit = staffPaths().map(p => p.getAttribute('transform'));
    act(() => editor().focus());
    for (const k of [0, 1]) {
      fireEvent.pointerDown(svg, { ...headAt(k), button: 0 });
      fireEvent.pointerUp(svg, { ...headAt(k), button: 0 });
      expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
      // Nothing drawn over the note: the same glyphs in the same places, the head and its sign lit.
      expect(screen.queryByTestId('staff-cursor')).toBeNull();
      expect(staffPaths().map(p => p.getAttribute('transform'))).toEqual(unlit);
      const lit = staffPaths().filter(p => p.getAttribute('fill') === 'var(--select)');
      expect(lit).toHaveLength(2);
      expect(lit).toContain(screen.getByTestId('staff-selected').querySelector('path'));
    }
  });

  it.each(['both', 'staff'])('Esc on a note pressed on the staff (%s) leaves nothing drawn', async parts => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(3), SLOW);
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    const svg = screen.getByRole('img', { name: /drawn as/ });
    act(() => editor().focus());
    fireEvent.pointerDown(svg, { ...headAt(2), button: 0 });
    fireEvent.pointerUp(svg, { ...headAt(2), button: 0 });
    // In normal mode the note pressed is selected (issue #238).
    expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByTestId('staff-selected')).toBeNull();
    expect(screen.queryByTestId('staff-cursor')).toBeNull();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    expect(editor()).not.toHaveFocus();
  });

  describe('normal mode and note input mode on the staff (issue #238)', () => {
    const open = async () => {
      localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
      renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |')}`);
      await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(3), SLOW);
      act(() => screen.getByRole('textbox', { name: /Tab editor/ }).focus());
    };
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    const svg = () => screen.getByRole('img', { name: /drawn as/ });
    const press = (at: { clientX: number; clientY: number }) => {
      fireEvent.pointerDown(svg(), { ...at, button: 0 });
      fireEvent.pointerUp(svg(), { ...at, button: 0 });
    };

    it('in normal mode a digit sets the selected note’s length, Alt+Shift+↑ ↓ a semitone, Ctrl/⌘ an octave', async () => {
      await open();
      press(headAt(2));
      const shown = () => {
        fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
        const line = frets();
        fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
        act(() => editor().focus());
        return line;
      };
      fireEvent.keyDown(editor(), { key: '6' });
      // Longer, the note writes over half the half rest after it, so the bar stays full (issue #290).
      expect(shown()).toBe('(7.5 5.6).4 3.4.2 r.4 |');
      // Alt changes the pitch, as Dorico's Alt+arrows do (Jeremy, 2026-11-07, issue #396).
      fireEvent.keyDown(editor(), { key: 'ArrowUp', altKey: true, shiftKey: true });
      expect(shown()).toBe('(7.5 5.6).4 4.4.2 r.4 |');
      fireEvent.keyDown(editor(), { key: 'ArrowDown', ctrlKey: true });
      // An octave under the D string's 4th fret (F♯) is the low E string's 2nd.
      expect(shown()).toBe('(7.5 5.6).4 2.6.2 r.4 |');
    });

    it('shows a shadow note under the pointer only in note input mode, and a press there enters it, the caret on past it (issue #396)', async () => {
      await open();
      // Over the first column, a few lines above its heads.
      const over = { clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 };
      fireEvent.pointerMove(svg(), over);
      expect(screen.queryByTestId('shadow-note')).toBeNull();
      fireEvent.keyDown(editor(), { key: 'n' });
      fireEvent.pointerMove(svg(), over);
      expect(screen.getByTestId('shadow-note')).toBeInTheDocument();
      press(over);
      expect(screen.getAllByTestId('staff-head')).toHaveLength(4);
      fireEvent.pointerLeave(svg());
      expect(screen.queryByTestId('shadow-note')).toBeNull();
      // The caret goes on past the note by its length, as Dorico's (Jeremy, 2026-11-07): Enter adds the same pitch
      // to the next column, and ← then Enter takes it away again.
      fireEvent.keyDown(editor(), { key: 'Enter' });
      expect(screen.getAllByTestId('staff-head')).toHaveLength(5);
      fireEvent.keyDown(editor(), { key: 'ArrowLeft' });
      fireEvent.keyDown(editor(), { key: 'Enter' });
      expect(screen.getAllByTestId('staff-head')).toHaveLength(4);
    });

    it('in note input mode a digit is the next note’s length, never a fret, and the shadow note shows it', async () => {
      await open();
      const shown = () => {
        fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
        const line = frets();
        fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
        act(() => editor().focus());
        return line;
      };
      fireEvent.keyDown(editor(), { key: 'n' });
      press(headAt(2));
      fireEvent.keyDown(editor(), { key: 'ArrowRight' });
      fireEvent.keyDown(editor(), { key: '3' });
      expect(shown()).toBe('(7.5 5.6).4 3.4.4 r.2 |');
      expect(screen.getByTestId('staff-ghost')).toHaveAttribute('data-value', '16');
      fireEvent.keyDown(editor(), { key: 'Enter' });
      expect(shown()).toMatch(/^\(7\.5 5\.6\)\.4 3\.4\.4 3\.4\.16 /);
    });

    it('Delete on a staff note in normal mode leaves its rest selected, with no head kept lit (Jeremy, 2026-10-31)', async () => {
      await open();
      // The 3 alone in its column; Delete leaves a rest there.
      press(headAt(2));
      expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
      fireEvent.keyDown(editor(), { key: 'Delete' });
      expect(screen.queryByTestId('staff-selected')).toBeNull();
      expect(screen.queryByTestId('staff-cursor')).toBeNull();
      expect(screen.getAllByTestId('staff-head')).toHaveLength(2);
      // Esc lets the rest go: nothing is left drawn.
      fireEvent.keyDown(editor(), { key: 'Escape' });
      expect(screen.queryByTestId('column-cursor')).toBeNull();
      expect(screen.queryByTestId('selected-note')).toBeNull();
    });

    it('a double-click on the staff or the tab goes into note input mode, the caret on the note pressed (Jeremy, 2026-10-31, 2026-11-07)', async () => {
      await open();
      const pencil = () => tool('Note input mode');
      expect(pencil()).toHaveAttribute('aria-pressed', 'false');
      press(headAt(0));
      fireEvent.doubleClick(svg(), headAt(0));
      expect(pencil()).toHaveAttribute('aria-pressed', 'true');
      // On the staff, as Dorico's caret starts on the note selected; nothing on the tab.
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
      expect(screen.queryByTestId('input-cursor')).toBeNull();
      // In note input mode a double-click changes nothing; N goes back out.
      fireEvent.doubleClick(svg(), headAt(0));
      expect(pencil()).toHaveAttribute('aria-pressed', 'true');
      fireEvent.keyDown(editor(), { key: 'n' });
      expect(pencil()).toHaveAttribute('aria-pressed', 'false');
    });

    it('a press on a rest selects that rest alone, boxed, and Shift grows the run to it (issue #276)', async () => {
      await open();
      const restPath = screen.getByTestId('staff-rest').querySelector('path')!;
      const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(restPath.getAttribute('transform')!)!;
      const onRest = { clientX: Number(x) + 4, clientY: Number(y) };
      const lit = () => screen.getAllByTestId('staff-head').map(h => h.hasAttribute('data-selected'));
      press(onRest);
      expect(restPath.getAttribute('fill')).toBe('var(--select)');
      expect(lit()).toEqual([false, false, false]);
      // It lights alone: no box round its column (Jeremy, 2026-11-01).
      expect(screen.queryByTestId('range-box')).toBeNull();
      // Delete leaves it a rest; the bar's notes are untouched.
      fireEvent.keyDown(editor(), { key: 'Delete' });
      expect(screen.getAllByTestId('staff-rest')).toHaveLength(1);
      expect(screen.getAllByTestId('staff-head')).toHaveLength(3);
      // From the D string's note, Shift+press on the rest selects both.
      press(headAt(2));
      fireEvent.pointerDown(svg(), { ...onRest, button: 0, shiftKey: true });
      fireEvent.pointerUp(svg(), { ...onRest, button: 0, shiftKey: true });
      expect(lit()).toEqual([false, false, true]);
      expect(screen.getByTestId('staff-rest').querySelector('path')!.getAttribute('fill')).toBe('var(--select)');
      expect(screen.getAllByTestId('range-box')).toHaveLength(1);
      // In note input mode a press there enters a note, as before.
      fireEvent.keyDown(editor(), { key: 'Escape' });
      fireEvent.keyDown(editor(), { key: 'n' });
      press(onRest);
      expect(screen.getAllByTestId('staff-head')).toHaveLength(4);
    });

    it('in note input mode ⌘/Ctrl+↑ takes the caret up to the staff and ⌘/Ctrl+↓ back down to the tab (issue #396)', async () => {
      await open();
      fireEvent.keyDown(editor(), { key: 'n' });
      fireEvent.keyDown(editor(), { key: 'ArrowDown' });
      expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
      fireEvent.keyDown(editor(), { key: 'ArrowUp', metaKey: true });
      expect(screen.getByTestId('staff-cursor')).toBeInTheDocument();
      expect(screen.queryByTestId('input-cursor')).toBeNull();
      // The staff has the keys: Alt+↑ steps the ghost a line or space.
      fireEvent.keyDown(editor(), { key: 'ArrowUp', altKey: true });
      expect(screen.getByTestId('staff-ghost')).toBeInTheDocument();
      fireEvent.keyDown(editor(), { key: 'ArrowDown', ctrlKey: true });
      expect(screen.queryByTestId('staff-cursor')).toBeNull();
      expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
      // ↑ ↓ are the strings' again: the box moves (it came down on the chord's lowest note, the low E's).
      const y = screen.getByTestId('input-cursor').getAttribute('y');
      fireEvent.keyDown(editor(), { key: 'ArrowUp' });
      expect(screen.getByTestId('input-cursor').getAttribute('y')).not.toBe(y);
    });

    it('in note input mode a fret on the tab leaves the caret; A–G on the staff enter that note and move on, - = 0 first a flat, sharp or natural (issue #396)', async () => {
      await open();
      fireEvent.keyDown(editor(), { key: 'n' });
      fireEvent.keyDown(editor(), { key: 'ArrowRight' });
      fireEvent.keyDown(editor(), { key: 'ArrowRight' });
      const box = () => screen.getByTestId('input-cursor').getAttribute('x');
      const x = box();
      fireEvent.keyDown(editor(), { key: '5', code: 'Digit5' });
      // A fret typed on the tab: the caret stays on it, for a second digit or a chord.
      expect(box()).toBe(x);
      fireEvent.keyDown(editor(), { key: 'ArrowUp', metaKey: true });
      expect(screen.getByTestId('staff-cursor')).toBeInTheDocument();
      const heads = screen.getAllByTestId('staff-head').length;
      // The caret is on the 5 (A4): G is the nearest G, G4, added to its column, and the caret goes on past it.
      fireEvent.keyDown(editor(), { key: 'g' });
      // Then - and B: B♭, then = and F: F♯, each a note on.
      fireEvent.keyDown(editor(), { key: '-' });
      fireEvent.keyDown(editor(), { key: 'b' });
      fireEvent.keyDown(editor(), { key: '=' });
      fireEvent.keyDown(editor(), { key: 'f' });
      expect(screen.getAllByTestId('staff-head')).toHaveLength(heads + 3);
      // A sign lasts only until the next letter: one let go by another key leaves the B plain.
      fireEvent.keyDown(editor(), { key: '-' });
      fireEvent.keyDown(editor(), { key: 'ArrowRight' });
      fireEvent.keyDown(editor(), { key: 'b' });
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(alphaTexText()).toContain('(7.5 5.6).4 3.4.4 (5.1 8.2).4 6.1.4 | 7.2.4 r.4 7.1.4 r.4 |');
    });

    it('N on a rest picked on the staff, or a double-click on it, starts the caret on the staff, not the tab (issue #396)', async () => {
      await open();
      const restPath = screen.getByTestId('staff-rest').querySelector('path')!;
      const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(restPath.getAttribute('transform')!)!;
      press({ clientX: Number(x) + 4, clientY: Number(y) });
      fireEvent.keyDown(editor(), { key: 'n' });
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
      expect(screen.getByTestId('grid-lines')).toHaveAttribute('data-part', 'staff');
      expect(screen.queryByTestId('tab-caret')).toBeNull();
      expect(screen.queryByTestId('input-cursor')).toBeNull();
      // A double-click on the rest does the same.
      fireEvent.keyDown(editor(), { key: 'Escape' });
      fireEvent.doubleClick(svg(), { clientX: Number(x) + 4, clientY: Number(y) });
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
      expect(screen.getByTestId('grid-lines')).toHaveAttribute('data-part', 'staff');
      expect(screen.queryByTestId('tab-caret')).toBeNull();
    });

    it('with only the staff drawn, ⌘/Ctrl+↓ in note input mode keeps the caret on the staff (issue #396)', async () => {
      await open();
      fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
      // A head picked, then N: the caret on its pitch.
      press(headAt(0));
      fireEvent.keyDown(editor(), { key: 'n' });
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
      // It doesn't go off to the tab, which isn't drawn.
      fireEvent.keyDown(editor(), { key: 'ArrowDown', metaKey: true });
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
    });

    it('in note input mode ↑ off the top string takes the caret up to the staff (issue #396)', async () => {
      await open();
      fireEvent.keyDown(editor(), { key: 'n' });
      expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
      fireEvent.keyDown(editor(), { key: 'ArrowUp' });
      expect(screen.getByTestId('staff-cursor')).toBeInTheDocument();
      expect(screen.queryByTestId('input-cursor')).toBeNull();
      // On the staff ↑ goes nowhere and ↓ comes back down to the tab, as Dorico's go between staves.
      const ghost = screen.getByTestId('staff-ghost').innerHTML;
      fireEvent.keyDown(editor(), { key: 'ArrowUp' });
      expect(screen.getByTestId('staff-ghost').innerHTML).toBe(ghost);
      fireEvent.keyDown(editor(), { key: 'ArrowDown' });
      expect(screen.queryByTestId('staff-cursor')).toBeNull();
      expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    });

    it('in normal mode ↑ ↓ go string by string and note by note, between the tab and the staff (issue #396)', async () => {
      await open();
      const staffPicked = () => screen.queryByTestId('staff-selected');
      const tabPicked = () => screen.queryByTestId('selected-note');
      const press = (key: string, times = 1) => { for (let k = 0; k < times; k += 1) fireEvent.keyDown(editor(), { key }); };
      // Down the strings to the low E's 5, then up to the A's 7.
      press('ArrowDown', 5);
      expect(tabPicked()).toBeInTheDocument();
      press('ArrowUp');
      expect(tabPicked()).toBeInTheDocument();
      // On up past the top string to the staff, on the chord's lowest note.
      press('ArrowUp', 5);
      expect(staffPicked()).toBeInTheDocument();
      expect(tabPicked()).toBeNull();
      // On the staff ↑ ↓ go note by note in the chord, and past the lowest back down to the tab.
      press('ArrowUp');
      expect(staffPicked()).toBeInTheDocument();
      press('ArrowDown', 2);
      expect(staffPicked()).toBeNull();
      expect(tabPicked()).toBeInTheDocument();
      // No fret changed on the way.
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(frets()).toBe('(7.5 5.6).4 3.4.4 r.2 |');
    });

    it('lights only the part pressed: a staff note not on the tab, a tab note not on the staff', async () => {
      await open();
      press(headAt(2));
      expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
      expect(screen.queryByTestId('selected-note')).toBeNull();
      // Going into note input mode puts the caret on the note pressed, on the staff (Jeremy, 2026-11-07); nothing on the tab.
      fireEvent.keyDown(editor(), { key: 'n' });
      expect(screen.queryByTestId('staff-selected')).toBeNull();
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
      expect(screen.queryByTestId('tab-caret')).toBeNull();
      expect(screen.queryByTestId('input-cursor')).toBeNull();
      // A press on the staff gives it the keys again, and only it lights: the caret's line and ghost on the
      // note pressed, as the caret always shows (issue #396), then the pitch's ghost once ↑ moves off it.
      press(headAt(2));
      expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
      expect(screen.getByTestId('staff-ghost')).toBeInTheDocument();
      fireEvent.keyDown(editor(), { key: 'ArrowUp' });
      expect(screen.getByTestId('staff-cursor')).toBeInTheDocument();
      expect(screen.queryByTestId('input-cursor')).toBeNull();
      fireEvent.keyDown(editor(), { key: 'Escape' });
      // The tab's 3 on the D string, pressed.
      const three = screen.getAllByText('3').find(t => t.closest('[data-testid="tab-system"]'))!;
      const top = Number(/translate\(0 ([\d.-]+)\)/.exec(three.closest('[data-testid="tab-system"]')!.getAttribute('transform')!)![1]);
      press({ clientX: Number(three.getAttribute('x')), clientY: top + Number(three.getAttribute('y')) - 4 });
      expect(screen.getByTestId('selected-note')).toBeInTheDocument();
      expect(screen.queryByTestId('staff-selected')).toBeNull();
      expect(screen.queryByTestId('staff-cursor')).toBeNull();
    });

    it('draws the heads of a selected run in the selection colour', async () => {
      await open();
      press(headAt(2));
      fireEvent.keyDown(editor(), { key: 'ArrowRight', shiftKey: true });
      const lit = () => screen.getAllByTestId('staff-head').map(h => h.hasAttribute('data-selected'));
      // The chord's two heads, then the D string's 3 and the rest: the run is the 3 and the rest.
      expect(lit()).toEqual([false, false, true]);
      fireEvent.keyDown(editor(), { key: 'Escape' });
      expect(lit()).toEqual([false, false, false]);
    });

    it('in normal mode a press beside the heads selects the bar, as MuseScore’s does, and enters nothing (Jeremy, 2026-10-31)', async () => {
      await open();
      press({ clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 });
      expect(screen.getAllByTestId('staff-head')).toHaveLength(3);
      expect(screen.queryByTestId('column-cursor')).toBeNull();
      expect(screen.getAllByTestId('staff-head').map(h => h.getAttribute('data-selected'))).toEqual(['true', 'true', 'true']);
      // A box round the bar says the bar is selected (issue #276); Shift+← takes a column off it, Esc takes it away.
      const boxWidth = () => Number(screen.getByTestId('range-box').getAttribute('width'));
      expect(screen.getAllByTestId('range-box')).toHaveLength(1);
      const whole = boxWidth();
      fireEvent.keyDown(editor(), { key: 'ArrowLeft', shiftKey: true });
      expect(boxWidth()).toBeLessThan(whole);
      fireEvent.keyDown(editor(), { key: 'Escape' });
      expect(screen.queryByTestId('range-box')).toBeNull();
      // A press off the bars lets it go; one on a palette button keeps it for the tool (Jeremy, 2026-11-01).
      press({ clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 });
      fireEvent.pointerDown(tool(/^Dotted/));
      expect(screen.getAllByTestId('range-box')).toHaveLength(1);
      fireEvent.pointerDown(document.body);
      expect(screen.queryByTestId('range-box')).toBeNull();
      press({ clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 });
      // On the tab too: a press on an empty string lights the bar's notes, with no box round the column.
      fireEvent.keyDown(editor(), { key: 'Escape' });
      const three = screen.getAllByText('3').find(t => t.closest('[data-testid="tab-system"]'))!;
      const top = Number(/translate\(0 ([\d.-]+)\)/.exec(three.closest('[data-testid="tab-system"]')!.getAttribute('transform')!)![1]);
      press({ clientX: Number(three.getAttribute('x')), clientY: top + Number(three.getAttribute('y')) - 4 - 14 });
      expect(screen.queryByTestId('column-cursor')).toBeNull();
      expect(screen.queryByTestId('selected-note')).toBeNull();
      const lit = screen.getAllByText(/^[357]$/).filter(t => t.closest('[data-testid="tab-system"]') && t.getAttribute('fill') === 'var(--select)');
      expect(lit.map(t => t.textContent).sort()).toEqual(['3', '5', '7']);
    });

    it('a staff head held down lights nothing until it lets go, after a bar was selected and let go (issue #337)', async () => {
      localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
      renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.6.4 7.5.4 3.4.4 5.3.4 | 8.6.4 10.5.4 12.4.4 9.3.4 |')}`);
      await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(8), SLOW);
      act(() => editor().focus());
      // Bar 1 selected by a press beside its heads, then let go by a press off the bars, which takes the focus away.
      press({ clientX: headAt(0).clientX + 20, clientY: headAt(3).clientY - 20 });
      expect(screen.getAllByTestId('range-box')).toHaveLength(1);
      fireEvent.pointerDown(document.body);
      act(() => editor().blur());
      expect(screen.queryByTestId('range-box')).toBeNull();
      // Bar 2's 10 held down. A browser focuses the drawing on a mouse down it isn't told to keep (jsdom doesn't).
      const lit = () => [...screen.queryAllByTestId('selected-note'), ...screen.queryAllByTestId('column-cursor'), ...screen.queryAllByTestId('staff-selected')];
      fireEvent.pointerDown(svg(), { ...headAt(5), button: 0 });
      if (fireEvent.mouseDown(svg(), { ...headAt(5), button: 0 })) act(() => editor().focus());
      expect(editor()).not.toHaveFocus();
      expect(lit()).toEqual([]);
      // Letting go picks the 10 on the staff, and only it lights.
      fireEvent.pointerUp(svg(), { ...headAt(5), button: 0 });
      expect(editor()).toHaveFocus();
      expect(screen.getAllByTestId('staff-head')[5]).toHaveAttribute('data-selected');
      expect(lit()).toEqual([screen.getByTestId('staff-selected')]);
    });

    it('a staff head dragged takes the focus as it starts to move (issue #337)', async () => {
      await open();
      act(() => editor().blur());
      fireEvent.pointerDown(svg(), { ...headAt(2), button: 0 });
      expect(fireEvent.mouseDown(svg(), { ...headAt(2), button: 0 })).toBe(false);
      fireEvent.pointerMove(svg(), { ...headAt(2), clientY: headAt(2).clientY - 10, button: 0 });
      expect(editor()).toHaveFocus();
      fireEvent.pointerUp(svg(), { ...headAt(2), clientY: headAt(2).clientY - 10, button: 0 });
      expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
    });
  });

  it('moves the note a line or space at a time, a semitone with Shift, and the chord with Ctrl, each one undo step', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(3), SLOW);
    const drag = (k: number, dy: number, keys: { shiftKey?: boolean; ctrlKey?: boolean } = {}) => {
      const svg = screen.getByRole('img', { name: /drawn as/ });
      const from = headAt(k);
      fireEvent.pointerDown(svg, { ...from, button: 0, ...keys });
      fireEvent.pointerMove(svg, { clientX: from.clientX, clientY: from.clientY + dy, ...keys });
      fireEvent.pointerUp(svg, { clientX: from.clientX, clientY: from.clientY + dy, ...keys });
    };
    const shown = () => {
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      const line = frets();
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      return line;
    };
    // Up two lines and spaces: F to A, the D string's 3rd fret to its 7th.
    drag(2, -9);
    expect(shown()).toContain('7.4');
    undo();
    expect(shown()).toContain('3.4');
    drag(2, -9, { shiftKey: true });
    expect(shown()).toContain('5.4');
    undo();
    drag(0, -9, { ctrlKey: true });
    expect(shown()).toMatch(/\(8\.6 10\.5\)|\(10\.5 8\.6\)/);
  });
});

describe('note input mode’s staff cursor (issue #382)', () => {
  it('is a caret, never a notehead: N then 5 on a whole rest enters nothing and makes the length a quarter', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'staff' }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n:8 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | r.1 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(8), SLOW);
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor().focus());
    for (let i = 0; i < 8; i++) fireEvent.keyDown(editor(), { key: 'ArrowRight' });
    fireEvent.keyDown(editor(), { key: 'n' });
    fireEvent.keyDown(editor(), { key: '5', code: 'Digit5' });
    const cursor = screen.getByTestId('staff-cursor');
    expect(within(cursor).getByTestId('staff-caret')).toBeInTheDocument();
    // Its only head is the next note's faint ghost, at the Input length: a quarter now, not the rest's whole.
    expect(within(cursor).getByTestId('staff-ghost')).toHaveAttribute('data-value', '4');
    expect(within(cursor).getAllByTestId('staff-ghost')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Quarter note' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toMatch(/\| r\.1 \|/);
  });
});

describe('note input mode’s staff cursor on a note (Jeremy, 2026-11-06)', () => {
  it('draws the caret’s line and ghost over a note at its own pitch; Enter moves the caret on past the note it adds', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'staff' }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n:8 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | r.1 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(8), SLOW);
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor().focus());
    for (let i = 0; i < 8; i++) fireEvent.keyDown(editor(), { key: 'ArrowRight' });
    fireEvent.keyDown(editor(), { key: 'n' });
    fireEvent.keyDown(editor(), { key: '5', code: 'Digit5' });
    fireEvent.keyDown(editor(), { key: 'Enter' });
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(9));
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toMatch(/\| \S+\.4 r\.4 r\.2 \|/);
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    act(() => editor().focus());
    // Back on the note just entered, at its own pitch: the caret's line and its ghost, as the caret always shows (issue #396).
    fireEvent.keyDown(editor(), { key: 'ArrowLeft' });
    expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
    expect(screen.getByTestId('staff-ghost')).toBeInTheDocument();
    // ↑ does nothing on the staff (Jeremy, 2026-11-07, issue #396).
    const ghost = screen.getByTestId('staff-ghost').innerHTML;
    fireEvent.keyDown(editor(), { key: 'ArrowUp' });
    expect(screen.getByTestId('staff-ghost').innerHTML).toBe(ghost);
  });

  it('never moves the caret with the mouse: the caret and the mouse’s shadow note both show (issue #396)', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'staff' }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n:8 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | r.1 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(8), SLOW);
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    const svg = screen.getByRole('img', { name: /drawn as/ });
    act(() => editor().focus());
    for (let i = 0; i < 8; i++) fireEvent.keyDown(editor(), { key: 'ArrowRight' });
    fireEvent.keyDown(editor(), { key: 'n' });
    expect(screen.getByTestId('staff-ghost')).toBeInTheDocument();
    expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
    // Over the second bar's whole rest: the mouse's shadow note there, the caret's line and ghost where they were.
    const ghostY = () => screen.getByTestId('staff-ghost').innerHTML;
    const before = ghostY();
    const restPath = screen.getAllByTestId('staff-rest').at(-1)!.querySelector('path')!;
    const [, rx, ry] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(restPath.getAttribute('transform')!)!;
    fireEvent.pointerMove(svg, { clientX: Number(rx) + 4, clientY: Number(ry) });
    expect(screen.getByTestId('shadow-note')).toBeInTheDocument();
    expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
    expect(ghostY()).toBe(before);
    // The mouse's shadow is fainter than the caret's ghost.
    expect(Number(screen.getByTestId('shadow-note').getAttribute('opacity'))).toBeLessThan(Number(screen.getByTestId('staff-ghost').getAttribute('opacity')));
    // Alt+↑ moves the caret's ghost (no note at its pitch), not the mouse's.
    const shadowAt = screen.getByTestId('shadow-note').innerHTML;
    fireEvent.keyDown(editor(), { key: 'ArrowUp', altKey: true });
    expect(ghostY()).not.toBe(before);
    expect(screen.getByTestId('shadow-note').innerHTML).toBe(shadowAt);
    fireEvent.pointerLeave(svg);
    expect(screen.queryByTestId('shadow-note')).toBeNull();
    expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
  });
});
