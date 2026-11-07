import { act, fireEvent, screen } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip } from '@/features/tab/layout';
import { partOf } from '@/features/tab/clip';
import { setUpPage, renderAt, SLOW, undo, litFrets, isLit, editor, keys, alphaTex, openWith } from './helpers';

setUpPage();

describe('TabPage: MuseScore’s jumps and keys (issue #238)', () => {
  const THREE_BARS = '\\title "Bars"\n:2 5.1 7.1 | 8.1 9.1 | 3.2 5.2 |';
  const copied = () => {
    const data = new Map<string, string>();
    const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
    act(() => { editor().dispatchEvent(copy); });
    // The bars after the header, one per line, however many the writer put on a line.
    const [, ...body] = data.get('text/plain')!.split('\n');
    return (body.join(' ').match(/[^|]*\|/g) ?? []).map(b => b.trim()).join('\n');
  };
  const open = async () => {
    renderAt(`#tab=${encodeURIComponent(THREE_BARS)}`);
    await screen.findByRole('heading', { name: 'Bars' }, SLOW);
    act(() => editor().focus());
  };

  it('Shift+drag from blank space draws a rectangle that selects the columns in it; a Shift+press there still extends', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
    await open();
    const read = readAlphaTexWith(alphaTab, THREE_BARS);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const layout = layoutClip(partOf(read.clip), 800, 'tab');
    const { top, rows } = layout.systems[0];
    const xs = layout.systems[0].bars.flatMap(b => b.columns.map(c => c.x));
    const svg = screen.getByRole('img', { name: /drawn as/ });
    // From above the lines, left of the second column, to the lines' middle, right of the fourth.
    const from = { clientX: xs[1] - 6, clientY: top + rows.staffTop - 12 };
    const to = { clientX: xs[3] + 6, clientY: top + rows.staffTop + 30 };
    fireEvent.pointerDown(svg, { ...from, button: 0, shiftKey: true });
    fireEvent.pointerMove(svg, { ...to, shiftKey: true });
    expect(screen.getByTestId('select-rectangle')).toBeInTheDocument();
    fireEvent.pointerUp(svg, { ...to, shiftKey: true });
    expect(screen.queryByTestId('select-rectangle')).toBeNull();
    expect(copied()).toBe('7.1.2 |\n8.1.2 9.1.2 |');
    // The notes inside are drawn selected, in the selection colour; the ones outside are not.
    const fill = (fret: string) => screen.getAllByText(fret).find(t => t.closest('[data-testid="tab-system"]'))!.getAttribute('fill');
    expect([fill('7'), fill('8'), fill('9')]).toEqual(['var(--select)', 'var(--select)', 'var(--select)']);
    expect(fill('5')).toBe('var(--ink)');
    // A Shift+press on a blank string, not moved, extends the selection to there as before.
    fireEvent.pointerDown(svg, { clientX: xs[4], clientY: top + rows.staffTop + 5 * 14, button: 0, shiftKey: true });
    fireEvent.pointerUp(svg, { clientX: xs[4], clientY: top + rows.staffTop + 5 * 14, shiftKey: true });
    expect(screen.queryByTestId('select-rectangle')).toBeNull();
    expect(copied()).toBe('7.1.2 |\n8.1.2 9.1.2 |\n3.2.2 |');
  });

  it('in normal mode a fret number dragged to another string keeps its pitch; off the drawing it goes back', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
    await open();
    const read = readAlphaTexWith(alphaTab, THREE_BARS);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const xs = bars.flatMap(b => b.columns.map(c => c.x));
    // The drawing is made again each time alphaTex() goes to the text view and back.
    const svg = () => screen.getByRole('img', { name: /drawn as/ });
    const onString = (string: number) => ({ clientX: xs[0], clientY: top + rows.staffTop + string * 14 });
    // The first 5 on the high e (A4), pressed: selected at once.
    fireEvent.pointerDown(svg(), { ...onString(0), button: 0 });
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    // Down to the B string while still dragging: a 10 there.
    fireEvent.pointerMove(svg(), onString(1));
    expect(screen.getAllByText('10').some(t => t.closest('[data-testid="tab-system"]'))).toBe(true);
    // On to the G string and let go: a 14, one undo step.
    fireEvent.pointerMove(svg(), onString(2));
    fireEvent.pointerUp(svg(), onString(2));
    expect(alphaTex()).toMatch(/^14.3.2 7.1.2 \|/);
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    undo();
    expect(alphaTex()).toMatch(/^5.1.2 7.1.2 \|/);
    // The low E can't reach A4 (its 29th fret): dragged there, the note stays on the A string's 24th.
    fireEvent.pointerDown(svg(), { ...onString(0), button: 0 });
    fireEvent.pointerMove(svg(), onString(5));
    fireEvent.pointerUp(svg(), onString(5));
    expect(alphaTex()).toMatch(/^24.5.2 7.1.2 \|/);
    undo();
    // Let go off the drawing (jsdom draws nothing, so the drawing is given its size here): the note goes back.
    const drawing = svg();
    drawing.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(drawing, { ...onString(0), button: 0 });
    fireEvent.pointerMove(drawing, onString(2));
    fireEvent.pointerUp(drawing, { clientX: -50, clientY: -50 });
    expect(alphaTex()).toMatch(/^5.1.2 7.1.2 \|/);
    // So does a pointer the browser takes away.
    fireEvent.pointerDown(svg(), { ...onString(0), button: 0 });
    fireEvent.pointerMove(svg(), onString(2));
    fireEvent.pointerCancel(svg(), onString(2));
    expect(alphaTex()).toMatch(/^5.1.2 7.1.2 \|/);
    // In note input a press on a note doesn't drag it.
    keys('n');
    fireEvent.pointerDown(svg(), { ...onString(0), button: 0 });
    fireEvent.pointerMove(svg(), onString(2));
    fireEvent.pointerUp(svg(), onString(2));
    expect(alphaTex()).toMatch(/^5.1.2 7.1.2 \|/);
  });

  it('a fret pressed in normal mode is picked, not retyped; in note input mode a press on a note puts the caret on it to retype (Jeremy, 2026-11-07)', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
    await open();
    const read = readAlphaTexWith(alphaTab, THREE_BARS);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const xs = bars.flatMap(b => b.columns.map(c => c.x));
    // The drawing is made again each time alphaTex() goes to the text view and back.
    const svg = () => screen.getByRole('img', { name: /drawn as/ });
    const press = (column: number, string: number) => {
      const at = { clientX: xs[column], clientY: top + rows.staffTop + string * 14, button: 0 };
      fireEvent.pointerDown(svg(), at);
      fireEvent.pointerUp(svg(), at);
    };
    // The fifth column's 3, on the B string: picked, and a digit doesn't retype it.
    press(4, 1);
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    keys('9');
    expect(alphaTex()).toContain('3.2.2');
    // N puts the caret on it, its string picked: a digit retypes it.
    keys('n');
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    keys('9');
    expect(alphaTex()).toContain('9.2');
    // A press on another note in note input mode moves the caret onto it, to retype too.
    press(0, 0);
    keys('8');
    expect(alphaTex().split('\n')[0]).toMatch(/^8\.1\.2 7\.1\.2/);
  });

  it('in note input a dim square follows the mouse on the tab, and a press there places a 0 to type over (Jeremy, 2026-10-31)', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
    await open();
    const read = readAlphaTexWith(alphaTab, THREE_BARS);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const xs = bars.flatMap(b => b.columns.map(c => c.x));
    const svg = screen.getByRole('img', { name: /drawn as/ });
    // The fifth column's A string is empty.
    const over = { clientX: xs[4], clientY: top + rows.staffTop + 4 * 14 };
    fireEvent.pointerMove(svg, over);
    expect(screen.queryByTestId('shadow-fret')).toBeNull();
    keys('n');
    fireEvent.pointerMove(svg, over);
    expect(screen.getByTestId('shadow-fret').tagName).toBe('rect');
    fireEvent.pointerDown(svg, { ...over, button: 0 });
    fireEvent.pointerUp(svg, { ...over, button: 0 });
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(alphaTex()).toContain('(3.2 0.5).2');
    keys('7');
    expect(alphaTex()).toContain('(3.2 7.5).2');
    const drawing = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerMove(drawing, over);
    expect(screen.getByTestId('shadow-fret')).toBeInTheDocument();
    fireEvent.pointerLeave(drawing);
    expect(screen.queryByTestId('shadow-fret')).toBeNull();
  });

  it('Alt+← → step through notes, rests, marks and words, picking each', async () => {
    renderAt(`#tab=${encodeURIComponent('\\title "Steps"\n\\ts (4 4)\n5.1.4{ch "A"} 7.3{v}.4 r.4 3.4.4 |')}`);
    await screen.findByRole('heading', { name: 'Steps' }, SLOW);
    act(() => editor().focus());
    const alt = (key: string) => keys({ key, altKey: true });
    const before = alphaTex();
    // From the first note: the next note, then its vibrato, picked as a press picks it.
    alt('ArrowRight');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    alt('ArrowRight');
    expect(isLit(screen.getByTestId('vibrato'))).toBe(true);
    // Holding Alt down on its own lets nothing go.
    keys({ key: 'Alt', altKey: true });
    expect(isLit(screen.getByTestId('vibrato'))).toBe(true);
    // Delete takes the picked vibrato away.
    keys('Delete');
    expect(alphaTex()).not.toBe(before);
    expect(alphaTex()).not.toContain('{v}');
    // Then the rest, lit as a selection is (no box round its column), and back past the first note to its chord name.
    alt('ArrowRight');
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    alt('ArrowLeft');
    alt('ArrowLeft');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    alt('ArrowLeft');
    expect(isLit(screen.getByTestId('chord-name'))).toBe(true);
    // Before it, bar 1's time signature (step 8); at the start nothing is before that, so it stays picked.
    alt('ArrowLeft');
    expect(isLit(screen.getAllByTestId('time-signature')[0])).toBe(true);
    expect(isLit(screen.getByTestId('chord-name'))).toBe(false);
    alt('ArrowLeft');
    expect(isLit(screen.getAllByTestId('time-signature')[0])).toBe(true);
  });

  it('Ctrl/⌘+← → move a bar at a time, Ctrl/⌘+Home / End to the clip’s ends', async () => {
    await open();
    // In note input mode, where digits type frets (Jeremy, 2026-11-07), on the first note's string.
    keys('n', { key: 'ArrowRight', ctrlKey: true }, '1');
    expect(alphaTex().split('\n')[1]).toBe('1.1.2 9.1.2 |');
    keys({ key: 'ArrowRight', metaKey: true }, { key: 'ArrowRight', ctrlKey: true }, '2');
    expect(alphaTex().split('\n')[2]).toBe('(2.1 3.2).2 5.2.2 |');
    // Back from the start of a bar goes to the start of the bar before.
    keys({ key: 'ArrowLeft', ctrlKey: true }, '3');
    expect(alphaTex().split('\n')[1]).toBe('3.1.2 9.1.2 |');
    keys({ key: 'End', ctrlKey: true }, '4');
    expect(alphaTex().split('\n')[2]).toBe('(2.1 3.2).2 (4.1 5.2).2 |');
    keys({ key: 'Home', ctrlKey: true }, '6');
    expect(alphaTex().split('\n')[0]).toBe('6.1.2 7.1.2 |');
  });

  it('Ctrl/⌘+Shift+← → grow a selection by bars, Ctrl/⌘+Shift+Home / End to the clip’s ends', async () => {
    await open();
    keys({ key: 'ArrowRight', ctrlKey: true, shiftKey: true });
    expect(litFrets().length).toBeGreaterThan(0);
    expect(copied()).toBe('5.1.2 7.1.2 |');
    keys({ key: 'ArrowRight', ctrlKey: true, shiftKey: true });
    expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 9.1.2 |');
    keys({ key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
    expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 |');
    keys({ key: 'End', ctrlKey: true, shiftKey: true });
    expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 9.1.2 |\n3.2.2 5.2.2 |');
    // Moving lets the selection go: only the column the cursor lands on is lit, with no box round it.
    keys({ key: 'ArrowLeft', ctrlKey: true });
    expect(litFrets()).toHaveLength(1);
    expect(screen.queryByTestId('column-cursor')).toBeNull();
  });

  it('Shift+Home / End grow a selection to the ends of the line of tab', async () => {
    await open();
    keys('ArrowRight', 'ArrowRight', { key: 'End', shiftKey: true });
    // The three short bars sit on one line, so the selection runs to the clip's last column.
    expect(copied()).toBe('8.1.2 9.1.2 |\n3.2.2 5.2.2 |');
    keys({ key: 'Home', shiftKey: true });
    expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 |');
  });

  it('W and Q make a note longer and shorter, as + and − do', async () => {
    await openWith('5.1.1 |');
    keys('q');
    // The time given up is a rest; longer again, the note writes over it (issue #290).
    expect(alphaTex()).toBe('5.1.2 r.2 |');
    keys('q', 'w', 'w');
    expect(alphaTex()).toBe('5.1.1 |');
  });

  it('Ctrl+Y redoes, as Ctrl+Shift+Z does', async () => {
    await openWith('5.1.1 |');
    keys('5');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    undo();
    expect(alphaTex()).toBe('5.1.1 |');
    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
  });
});
