/**
 * Picking marks, words and bar lines on the Tab page (issue #276; docs/specs/2026-11-01-tab-selection-look-design.md):
 * repeat signs, their ×N count, double bars and hairpins are picked as other marks are; whatever is picked
 * turns blue, with no outline and no trash can, and its Delete (and Edit) are in a right-click menu.
 */
import * as alphaTab from '@coderline/alphatab';
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip } from '@/features/tab/layout';
import { textBox, textAt } from '@/features/tab/layoutText';
import { barLineAt, barLineBoxes, type BarLineHit } from '@/features/tab/barLines';
import { removeBarLine, setRepeatTimes } from '@/features/tab/barEdits';
import { markAt, markBoxes } from '@/features/tab/marks';
import { removeMark } from '@/features/tab/noteEdits';
import { elementsOf } from '@/features/tab/elements';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

/** Four bars: a repeat round the first two, played three times, a hairpin, and a double bar after the third. */
const TEX = '\\title "Repeats"\n\\ts (4 4)\n\\ro 5.1.4{ch "A"} 7.3{cre}.4 7.3{cre}.4 r.4 | \\rc 3 3.4.1 | 5.1.1 | \\db 3.2.1 | 5.1.1 |';
const clipOf = (tex: string) => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
// The double bar is written before the bar it ends; check where it landed.
const CLIP = clipOf(TEX);
const DOUBLE_BAR = CLIP.bars.findIndex(b => b.doubleBar);
/** jsdom draws the tab 800 wide at 0, 0. */
const WIDTH = 800;
const LAYOUT = layoutClip(CLIP, WIDTH);
const middleOf = (box: { x: number; y: number; width: number; height: number }) => ({ clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
const barLine = (kind: BarLineHit['kind']) => barLineBoxes(LAYOUT).find(b => b.hit.kind === kind)!;

function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  return render(<TabPage />);
}
async function open() {
  renderAt(`#tab=${encodeURIComponent(TEX)}`);
  await screen.findByRole('heading', { name: 'Repeats' }, { timeout: 5000 });
}
const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
const drawing = () => screen.getByRole('img', { name: /drawn as tab/ });
const tool = (name: string) => screen.getByRole('button', { name });
const alphaTexText = () => {
  fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
  return (screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value;
};
/** A press on a point of the drawing; a right-click also opens the menu, as the browser's contextmenu does. */
function press(at: { clientX: number; clientY: number }, button = 0) {
  fireEvent.pointerDown(drawing(), { ...at, button });
  if (button === 2) fireEvent.contextMenu(editor(), at);
}
const menuItems = () => within(screen.getByRole('menu', { name: 'Selected' })).getAllByRole('menuitem').map(b => b.textContent);
const choose = (name: string) => fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name }));
const isLit = (el: Element) => el.getAttribute('data-selected') === 'true' || el.getAttribute('fill') === 'var(--select)' || el.getAttribute('stroke') === 'var(--select)';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('bar lines a press can pick', () => {
  it('finds a repeat’s start, end and count, and a double bar, on the tab', () => {
    expect(DOUBLE_BAR).toBeGreaterThan(0);
    for (const kind of ['repeatStart', 'repeatEnd', 'repeatCount', 'doubleBar'] as const) {
      const box = barLine(kind);
      const { clientX, clientY } = middleOf(box);
      expect(barLineAt(LAYOUT, clientX, clientY)).toEqual(box.hit);
      // The words' hit test finds it too, so a press picks it as it picks a chord name.
      expect(textAt(LAYOUT, clientX, clientY)).toEqual(box.hit);
      expect(textBox(LAYOUT, box.hit, null)).not.toBeNull();
    }
    expect(barLine('repeatStart').hit.bar).toBe(0);
    expect(barLine('repeatEnd').hit.bar).toBe(1);
    expect(barLine('doubleBar').hit.bar).toBe(DOUBLE_BAR);
  });

  it('finds them on the notation staff too, and a repeat played twice has no count', () => {
    const both = layoutClip(CLIP, WIDTH, 'both');
    expect(barLineBoxes(both).filter(b => b.hit.kind === 'repeatStart')).toHaveLength(2);
    const twice = clipOf(TEX.replace('\\rc 3', '\\rc 2'));
    expect(barLineBoxes(layoutClip(twice, WIDTH)).some(b => b.hit.kind === 'repeatCount')).toBe(false);
  });

  it('never takes a press on a note', () => {
    const first = LAYOUT.systems[0].bars[0].columns[0];
    expect(barLineAt(LAYOUT, first.x, LAYOUT.systems[0].top + LAYOUT.systems[0].rows.staffTop)).toBeNull();
  });

  it('takes away a repeat’s start or end, or a double bar, and sets a repeat’s count back to two', () => {
    expect(removeBarLine(CLIP, { kind: 'repeatStart', bar: 0 }).bars[0].repeatStart).toBeUndefined();
    expect(removeBarLine(CLIP, { kind: 'repeatEnd', bar: 1 }).bars[1].repeatEnd).toBeUndefined();
    expect(removeBarLine(CLIP, { kind: 'repeatCount', bar: 1 }).bars[1].repeatEnd).toBe(2);
    expect(removeBarLine(CLIP, { kind: 'doubleBar', bar: DOUBLE_BAR }).bars[DOUBLE_BAR].doubleBar).toBeUndefined();
  });

  it('keeps a repeat’s count from 2 to 9, and only on a bar that ends a repeat', () => {
    expect(setRepeatTimes(CLIP, 1, 5).bars[1].repeatEnd).toBe(5);
    expect(setRepeatTimes(CLIP, 1, 1).bars[1].repeatEnd).toBe(2);
    expect(setRepeatTimes(CLIP, 1, 12).bars[1].repeatEnd).toBe(9);
    expect(setRepeatTimes(CLIP, 0, 3)).toBe(CLIP);
  });

  it('are stepped to by Alt+← →: a repeat’s start before its bar’s columns, its end, count and a double bar after them', () => {
    const kinds = elementsOf(CLIP, LAYOUT).map(e => e.kind);
    expect(kinds.indexOf('repeatStart')).toBeLessThan(kinds.indexOf('chord'));
    expect(kinds.indexOf('repeatEnd')).toBeLessThan(kinds.indexOf('repeatCount'));
    expect(kinds.indexOf('repeatCount')).toBeLessThan(kinds.indexOf('doubleBar'));
  });
});

describe('a hairpin is a mark', () => {
  it('is picked whole, over the run it spans, and taken away from every column of it', () => {
    const found = markBoxes(LAYOUT).find(m => m.hit.mark === 'hairpin')!;
    expect(found.hit).toMatchObject({ index: 1, to: 2, string: null });
    const { clientX, clientY } = middleOf(found.box);
    expect(markAt(LAYOUT, clientX, clientY)).toMatchObject({ mark: 'hairpin', index: 1 });
    const cleared = removeMark(CLIP, found.hit);
    expect(cleared.bars[0].columns.some(c => c.hairpin)).toBe(false);
  });
});

describe('picking on the page (issue #276)', () => {
  it('lights a picked repeat sign blue with its palette tool, with no outline or buttons, and its menu takes it away', async () => {
    await open();
    press(middleOf(barLine('repeatStart')), 2);
    expect(isLit(screen.getByTestId('repeat-start'))).toBe(true);
    expect(tool('Repeat starts at this bar')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(menuItems()).toEqual(['Delete']);
    choose('Delete');
    expect(screen.queryByTestId('repeat-start')).toBeNull();
    expect(alphaTexText()).not.toContain('\\ro');
  });

  it('edits a repeat’s count from its menu, and its Delete sets it back to twice', async () => {
    await open();
    press(middleOf(barLine('repeatCount')), 2);
    expect(isLit(screen.getByTestId('repeat-count'))).toBe(true);
    // The repeat's end isn't lit: only the count was picked.
    expect(screen.getByTestId('repeat-end').querySelector('circle')!.getAttribute('fill')).not.toBe('var(--select)');
    expect(menuItems()).toEqual(['Edit', 'Delete']);
    choose('Edit');
    const field = screen.getByRole('textbox', { name: 'Times played, 2 to 9' });
    expect(field).toHaveValue('3');
    fireEvent.change(field, { target: { value: '4' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('repeat-count')).toHaveTextContent('×4');
    press(middleOf(barLine('repeatCount')), 2);
    choose('Delete');
    expect(screen.queryByTestId('repeat-count')).toBeNull();
    expect(screen.getByTestId('repeat-end')).toBeInTheDocument();
  });

  it('picks a repeat’s end and a double bar with a press, Enter edits the count, and Delete takes them away', async () => {
    await open();
    press(middleOf(barLine('repeatEnd')));
    expect(isLit(screen.getByTestId('repeat-end').parentElement!)).toBe(true);
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Times played, 2 to 9' })).toHaveValue('3');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Times played, 2 to 9' }), { key: 'Escape' });
    press(middleOf(barLine('doubleBar')));
    expect(isLit(screen.getByTestId('double-bar'))).toBe(true);
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(screen.queryByTestId('double-bar')).toBeNull();
  });

  it('gives a word’s menu Edit and Delete, and lights the word, not a box round it', async () => {
    await open();
    const box = textBox(LAYOUT, { kind: 'chord', index: 0 }, null)!;
    press(middleOf(box), 2);
    expect(isLit(screen.getByTestId('chord-name'))).toBe(true);
    expect(menuItems()).toEqual(['Edit', 'Delete']);
    choose('Delete');
    expect(screen.queryByTestId('chord-name')).toBeNull();
  });

  it('lights a picked hairpin and its menu takes it away', async () => {
    await open();
    const { box } = markBoxes(LAYOUT).find(m => m.hit.mark === 'hairpin')!;
    press(middleOf(box), 2);
    expect(isLit(screen.getByTestId('hairpin'))).toBe(true);
    // It lights alone: its columns aren't selected, nor boxed.
    expect(screen.queryByTestId('range-box')).toBeNull();
    expect(menuItems()).toEqual(['Delete']);
    choose('Delete');
    expect(screen.queryByTestId('hairpin')).toBeNull();
  });

  it('picks with a long press on a touch screen and opens its menu', async () => {
    await open();
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(drawing(), { ...middleOf(barLine('repeatStart')), pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(600));
      expect(isLit(screen.getByTestId('repeat-start'))).toBe(true);
      expect(menuItems()).toEqual(['Delete']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the bar menu, not a picked thing’s, on a right-click off any word or mark', async () => {
    await open();
    const first = LAYOUT.systems[0].bars[0].columns[0];
    const y = LAYOUT.systems[0].top + LAYOUT.systems[0].rows.staffTop;
    press({ clientX: first.x, clientY: y }, 2);
    expect(screen.getByRole('menu', { name: 'Tab' })).toBeInTheDocument();
  });
});
