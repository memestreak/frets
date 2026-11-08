/**
 * Note input's grid on the Tab page (issue #293; docs/specs/2026-11-01-tab-note-input-grid-design.md):
 * ← → stop at each grid line inside a rest and once on each note, a note typed there splits the rest,
 * presses snap to the grid, and the grid is set by the palette's Grid button, Alt+[ ] and Settings.
 */
import * as alphaTab from '@coderline/alphatab';
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { EDITING_KEY } from '@/features/tab/editingPrefs';
import { layoutClip } from '@/features/tab/layout';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

/** A quarter note, then a dotted half's rest. */
const TEX = '\\title "Grid"\n\\ts (4 4)\n5.1.4 r.2{d} |';

async function open() {
  window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(TEX)}`);
  render(<TabPage />);
  await screen.findByRole('heading', { name: 'Grid' }, { timeout: 5000 });
  act(() => editor().focus());
}
const TWO_BARS = '\\title "Grid"\n\\ts (4 4)\n5.1.4 r.2{d} | r.1 |';
/** Two bars, the second empty, with where they are drawn, a pointer spot in each and where the drawn grid starts. */
async function openTwoBars() {
  window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(TWO_BARS)}`);
  render(<TabPage />);
  await screen.findByRole('heading', { name: 'Grid' }, { timeout: 5000 });
  act(() => editor().focus());
  const read = readAlphaTexWith(alphaTab, TWO_BARS);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
  const svg = screen.getByRole('img', { name: /drawn as/ });
  const over = (bar: number) => {
    const rest = bars[bar].columns[bars[bar].columns.length - 1];
    return { clientX: rest.x + rest.width / 2, clientY: top + rows.staffTop };
  };
  /** The bars the Grid is drawn over. */
  const gridBars = () => screen.queryAllByTestId('grid-lines').map(g => Number(g.getAttribute('data-bar'))).sort();
  return { svg, bars, over, gridBars };
}
const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
const keys = (...list: (string | { key: string; code?: string; altKey?: boolean; shiftKey?: boolean })[]) => {
  for (const k of list) fireEvent.keyDown(editor(), typeof k === 'string' ? { key: k } : k);
};
/** The clip's one bar, as alphaTex. */
const bar = () => {
  fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
  const text = (screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value;
  fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
  act(() => editor().focus());
  return text.match(/[^\n]*\|/)![0].trim();
};
const savedGrid = () => JSON.parse(localStorage.getItem(EDITING_KEY) ?? '{}').grid;
const gridButton = () => screen.getByRole('button', { name: /^Note input grid/ });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
});
afterEach(() => cleanup());

const altKey = (code: string) => ({ key: 'Dead', code, altKey: true });
const savedFixed = () => JSON.parse(localStorage.getItem(EDITING_KEY) ?? '{}').fixedGrid;

describe('note input’s grid (issue #293)', () => {
  it('by default follows note input’s length: → steps a quarter at a time through a rest after a quarter', async () => {
    await open();
    // Note input on the 5, its high e picked (Jeremy, 2026-11-07); → onto the rest, then two quarters into it.
    keys('n', 'ArrowRight', 'ArrowRight', 'ArrowRight');
    keys('7');
    expect(bar()).toBe('5.1.4 r.4 r.4 7.1.4 |');
  });

  it('with the fixed grid on (Alt+G), → stops on each 16th inside a rest, and a note typed there goes in at that point', async () => {
    await open();
    keys('n', altKey('KeyG'), 'ArrowRight', 'ArrowRight', 'ArrowRight');
    keys('7');
    // The meter writes the quarter across the bar's middle as two tied 8ths, and the rests after it on the beat.
    expect(bar()).toBe('5.1.4 r.8 7.1.8 -.1.8 r.8 r.4 |');
  });

  it('← comes back into a rest at its last grid line, and steps back through it', async () => {
    await open();
    keys('n', altKey('KeyG'), 'ArrowRight', 'ArrowRight', 'ArrowRight', '7');
    // From the 7 back into the eighth rest before it: its second 16th. Two 16ths shorter, then 9.
    keys('ArrowLeft', '-', '-', '9');
    expect(bar()).toBe('5.1.4 r.16 9.1.16 7.1.8 -.1.8 r.8 r.4 |');
    // Over a note, ← is one stop: back past the 9's rest onto the first note.
    keys('ArrowLeft', 'ArrowLeft', 'ArrowLeft');
    // Typed over at the input length, a 16th, as note input writes (step 4): the rest of the quarter is a Gap.
    keys('3');
    expect(bar()).toBe('3.1.16 r.16 r.8 r.16 9.1.16 7.1.8 -.1.8 r.8 r.4 |');
  });

  it('Shift+Space moves on by the next note’s length, over notes and into rests', async () => {
    await open();
    keys('n', { key: ' ', shiftKey: true });
    // A quarter on from the first note is the rest's start; an eighth on from there is inside it.
    keys('-', { key: ' ', shiftKey: true }, '7');
    expect(bar()).toBe('5.1.4 r.8 7.1.8 r.2 |');
  });

  it('draws the grid in note input only: a ruler by default, lines when Settings says so', async () => {
    await open();
    expect(screen.queryByTestId('grid-lines')).toBeNull();
    keys('n');
    expect(screen.getByTestId('grid-lines')).toHaveAttribute('data-look', 'ruler');
    keys('Escape');
    expect(screen.queryByTestId('grid-lines')).toBeNull();
    cleanup();
    localStorage.setItem(EDITING_KEY, JSON.stringify({ gridLook: 'lines' }));
    await open();
    keys('n');
    expect(screen.getByTestId('grid-lines')).toHaveAttribute('data-look', 'lines');
  });

  it('keeps the grid when Staff, Tab or Both is pressed: the press leaves the focus on the editor (issue #396)', async () => {
    await open();
    keys('n');
    const show = screen.getByRole('group', { name: 'Show' });
    for (const name of ['Staff', 'Both', 'Tab']) {
      const button = within(show).getByRole('button', { name });
      // A press that doesn't take the focus: the editor isn't blurred, so note input's cursor and grid stay.
      expect(fireEvent.mouseDown(button)).toBe(false);
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('grid-lines')).toBeInTheDocument();
    }
  });

  it('never moves the caret with the mouse: the Grid shows over the caret’s bar and the bar under the mouse (issue #396)', async () => {
    const { svg, over, gridBars } = await openTwoBars();
    keys('n');
    expect(gridBars()).toEqual([0]);
    fireEvent.pointerMove(svg, over(1));
    // As Dorico draws it: the Grid over the hovered bar too, the caret's box on the 5 where it was, the mouse's faint box.
    expect(gridBars()).toEqual([0, 1]);
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(screen.getByTestId('shadow-fret')).toBeInTheDocument();
    fireEvent.pointerLeave(svg);
    expect(gridBars()).toEqual([0]);
    expect(screen.queryByTestId('shadow-fret')).toBeNull();
  });

  it('moves the caret by the keys, not the mouse’s box, while the mouse rests on the clip (issue #396)', async () => {
    const { svg, bars, over } = await openTwoBars();
    keys('n');
    fireEvent.pointerMove(svg, over(1));
    const box = () => [screen.getByTestId('shadow-fret').getAttribute('x'), screen.getByTestId('shadow-fret').getAttribute('y')];
    const before = box();
    keys('ArrowDown');
    // A string picked: the caret's box, in the first bar, and the mouse's box where it was.
    expect(Number(screen.getByTestId('input-cursor').getAttribute('x'))).toBeLessThan(bars[0].x1);
    expect(box()).toEqual(before);
  });

  it('starts note input at the caret, never where the mouse was before (issue #396)', async () => {
    const { svg, over, gridBars } = await openTwoBars();
    // A press on the first bar, then the mouse over the second and off the clip.
    fireEvent.pointerDown(svg, { ...over(0), button: 0 });
    fireEvent.pointerUp(svg, { ...over(0), button: 0 });
    fireEvent.pointerMove(svg, over(1));
    fireEvent.pointerLeave(svg);
    keys('n');
    expect(gridBars()).toEqual([0]);
    // Nor while it rests over the second bar: nothing of the mouse is kept outside note input.
    keys('n');
    fireEvent.pointerMove(svg, over(1));
    keys('n');
    expect(gridBars()).toEqual([0]);
    expect(screen.queryByTestId('shadow-fret')).toBeNull();
  });

  it('draws the caret’s line on the tab on a column with no string picked, wherever the mouse is (issue #396)', async () => {
    const { svg, over } = await openTwoBars();
    // → onto the first bar's rest picks its column, no string.
    keys('ArrowRight', 'n');
    expect(screen.getByTestId('tab-caret')).toBeInTheDocument();
    fireEvent.pointerMove(svg, over(1));
    expect(screen.getByTestId('tab-caret')).toBeInTheDocument();
    expect(screen.getByTestId('shadow-fret')).toBeInTheDocument();
  });

  it('keeps the caret, and its Grid, where it was when the view changes (issue #396)', async () => {
    const { svg, over, gridBars } = await openTwoBars();
    keys('n');
    fireEvent.pointerMove(svg, over(1));
    fireEvent.click(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Both' }));
    // The bars moved under the still mouse: its Grid and box wait for it to move again.
    expect(gridBars()).toEqual([0]);
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
  });

  it('shows a faint 0 in the caret’s box on a string with no note, as MuseScore’s tab does (issue #396)', async () => {
    await open();
    keys('n');
    // On the 5: nothing ghosted over a note.
    expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-ghost')).toBeNull();
    keys('ArrowDown');
    expect(screen.getByTestId('tab-ghost')).toHaveTextContent('0');
    // A typed fret takes its place.
    keys('7');
    expect(screen.queryByTestId('tab-ghost')).toBeNull();
    // Back on an empty string it shows again, and out of note input there is none.
    keys('ArrowDown');
    expect(screen.getByTestId('tab-ghost')).toBeInTheDocument();
    keys('Escape');
    expect(screen.queryByTestId('tab-ghost')).toBeNull();
  });

  it('out of note input, → moves a column at a time, as before', async () => {
    await open();
    keys('ArrowRight', 'ArrowRight');
    // Normal mode stopped on the rest's start, not inside it.
    keys('n', 'ArrowDown', '7');
    expect(bar()).toBe('5.1.4 7.1.4 r.2 |');
  });

  it('a press in note input snaps to the grid line nearest it inside a rest', async () => {
    await open();
    const read = readAlphaTexWith(alphaTab, TEX);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const rest = bars[0].columns[1];
    keys('n');
    // Note input's quarter: a little past a third of the way along the dotted half's room is its second quarter.
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const over = { clientX: rest.x + rest.width / 3 + 4, clientY: top + rows.staffTop };
    fireEvent.pointerDown(svg, { ...over, button: 0 });
    fireEvent.pointerUp(svg, { ...over, button: 0 });
    expect(bar()).toBe('5.1.4 r.4 0.1.4 r.4 |');
  });

  it('a press in an empty bar goes in at the grid line pressed, not only on beat 1', async () => {
    const empty = '\\title "Grid"\n\\ts (4 4)\nr.1 |';
    window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(empty)}`);
    render(<TabPage />);
    await screen.findByRole('heading', { name: 'Grid' }, { timeout: 5000 });
    act(() => editor().focus());
    const read = readAlphaTexWith(alphaTab, empty);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const rest = bars[0].columns[0];
    // A quarter, the fixed grid a 16th: a press just past the bar's middle goes on beat 3.
    keys('n', altKey('BracketRight'));
    const over = { clientX: rest.x + rest.width / 2 + 2, clientY: top + rows.staffTop };
    const svg = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerDown(svg, { ...over, button: 0 });
    fireEvent.pointerUp(svg, { ...over, button: 0 });
    expect(bar()).toBe('r.2 0.1.4 r.4 |');
  });

  it('a press a 16th into an empty bar puts a quarter a 16th after the bar line', async () => {
    const empty = '\\title "Grid"\n\\ts (4 4)\nr.1 |';
    window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(empty)}`);
    render(<TabPage />);
    await screen.findByRole('heading', { name: 'Grid' }, { timeout: 5000 });
    act(() => editor().focus());
    const read = readAlphaTexWith(alphaTab, empty);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { top, rows, bars } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const rest = bars[0].columns[0];
    keys('n', altKey('BracketRight'));
    const over = { clientX: rest.x + rest.width / 16 + 1, clientY: top + rows.staffTop };
    const svg = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerDown(svg, { ...over, button: 0 });
    fireEvent.pointerUp(svg, { ...over, button: 0 });
    // The meter writes it across beat 2 as tied notes.
    expect(bar()).toBe('r.16 0.1.16 -.1.8 -.1.16 r.16 r.8 r.2 |');
  });

  it('Alt+G, Alt+[ ] and the palette’s Grid button set the grid, kept in Settings › Tab › Editing', async () => {
    await open();
    expect(gridButton()).not.toHaveAttribute('aria-pressed');
    // The first Alt+] turns the fixed grid on at a 16th; the next makes it coarser.
    keys(altKey('BracketRight'));
    await waitFor(() => expect([savedFixed(), savedGrid()]).toEqual([true, 16]));
    keys(altKey('BracketRight'));
    await waitFor(() => expect(savedGrid()).toBe(8));
    keys(altKey('BracketLeft'), altKey('BracketLeft'), altKey('BracketLeft'));
    // Finer than a 32nd there is none.
    await waitFor(() => expect(savedGrid()).toBe(32));
    // Alt+G back to note input's length, and again to the 32nd.
    keys(altKey('KeyG'));
    await waitFor(() => expect(savedFixed()).toBe(false));
    fireEvent.click(gridButton());
    expect(screen.getByRole('button', { name: 'Note length' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Quarter' }));
    await waitFor(() => expect([savedFixed(), savedGrid()]).toEqual([true, 4]));
    fireEvent.click(gridButton());
    fireEvent.click(screen.getByRole('button', { name: 'Note length' }));
    await waitFor(() => expect(savedFixed()).toBe(false));
  });
});
