/**
 * Note input's grid on the Tab page (issue #293; docs/specs/2026-11-01-tab-note-input-grid-design.md):
 * ← → stop at each grid line inside a rest and once on each note, a note typed there splits the rest,
 * presses snap to the grid, and the grid is set by the palette's Grid button, Alt+[ ] and Settings.
 */
import * as alphaTab from '@coderline/alphatab';
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // Note input, the high e picked; → onto the rest, then two quarters into it.
    keys('n', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight');
    keys('7');
    expect(bar()).toBe('5.1.4 r.4 r.4 7.1.4 |');
  });

  it('with the fixed grid on (Alt+G), → stops on each 16th inside a rest, and a note typed there goes in at that point', async () => {
    await open();
    keys('n', altKey('KeyG'), 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight');
    keys('7');
    expect(bar()).toBe('5.1.4 r.8 7.1.4 r.4{d} |');
  });

  it('← comes back into a rest at its last grid line, and steps back through it', async () => {
    await open();
    keys('n', altKey('KeyG'), 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', '7');
    // From the 7 back into the eighth rest before it: its second 16th. Two 16ths shorter, then 9.
    keys('ArrowLeft', '-', '-', '9');
    expect(bar()).toBe('5.1.4 r.16 9.1.16 7.1.4 r.4{d} |');
    // Over a note, ← is one stop: back past the 9's rest onto the first note.
    keys('ArrowLeft', 'ArrowLeft', 'ArrowLeft');
    keys('3');
    expect(bar()).toBe('3.1.4 r.16 9.1.16 7.1.4 r.4{d} |');
  });

  it('Shift+Space moves on by the next note’s length, over notes and into rests', async () => {
    await open();
    keys('n', 'ArrowDown', { key: ' ', shiftKey: true });
    // A quarter on from the first note is the rest's start; an eighth on from there is inside it.
    keys('-', { key: ' ', shiftKey: true }, '7');
    expect(bar()).toBe('5.1.4 r.8 7.1.8 r.2 |');
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
