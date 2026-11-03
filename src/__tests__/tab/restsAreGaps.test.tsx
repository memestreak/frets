/**
 * Rests are Gaps on the page (`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`): an edit's rests are
 * written by the meter, and an empty bar is drawn, picked and typed on as one Whole-bar rest.
 */
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { LetGoAfterUse } from '@/components/LetGoAfterUse';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY, wholeRestX } from '@/features/tab/layout';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
const svg = () => screen.getByRole('img', { name: /drawn as/ });
const bars = () => {
  fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
  const lines = (screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value.split('\n').filter(l => l.includes('|'));
  fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
  act(() => editor().focus());
  return lines.join('\n');
};
const open = async (show: string, text: string, drawn: string) => {
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show }));
  window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(text)}`);
  render(<><LetGoAfterUse /><TabPage /></>);
  await waitFor(() => expect(screen.getAllByTestId(drawn).length).toBeGreaterThan(0), { timeout: 5000 });
  act(() => editor().focus());
};
/** The clip's layout as the page draws it with the tab alone (jsdom draws it 800 wide at 0, 0). */
const layoutOf = (text: string) => {
  const read = readAlphaTexWith(alphaTab, text);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return layoutClip(partOf(read.clip), 800, 'tab');
};
const press = (x: number, y: number) => {
  fireEvent.pointerDown(svg(), { clientX: x, clientY: y, button: 0 });
  fireEvent.pointerUp(svg(), { clientX: x, clientY: y, button: 0 });
};

describe('an empty bar is one Whole-bar rest', () => {
  it.each([
    ['4/4', '\\ts (4 4)\nr.1 | 3.6.4 5.6.4 7.6.4 8.6.4 |'],
    ['3/4', '\\ts (3 4)\nr.2{d} | 3.6.4 5.6.4 7.6.4 |'],
    ['5/8 (two rests stored)', '\\ts (5 8)\nr.4{d} r.4 | 3.6.8 5.6.8 7.6.8 8.6.4 |'],
  ])('in %s it is drawn as one rest on the staff and under the tab', async (_, text) => {
    await open('both', text, 'staff-rest');
    expect(screen.getAllByTestId('staff-rest')).toHaveLength(1);
    cleanup();
    await open('tab', text, 'rest');
    expect(screen.getAllByTestId('rest')).toHaveLength(1);
  });

  it('a run of empty bars is still one multi-bar rest', async () => {
    await open('both', '\\ts (4 4)\n\\multiBarRest\nr.1 | r.1 | 3.6.1 |', 'multi-rest');
    expect(screen.getAllByTestId('multi-rest').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('staff-rest')).toHaveLength(0);
  });

  it('a press on a 5/8 Whole-bar rest picks both its rests, lit as one', async () => {
    const text = '\\ts (5 8)\nr.4{d} r.4 | 3.6.8 5.6.8 7.6.8 8.6.4 |';
    await open('tab', text, 'rest');
    const { bars: placed, rows, top } = layoutOf(text).systems[0];
    const x = wholeRestX(placed[0]);
    press(x, top + rows.stemTop + 10);
    // Both rests are selected: the one rest drawn lights.
    expect(screen.getAllByTestId('rest')[0].getAttribute('fill')).toBe('var(--select)');
    // The cursor waits on beat 1, the first rest.
    expect(screen.getAllByTestId('rest')).toHaveLength(1);
  });

  it('in note input, a press on a string over a 5/8 Whole-bar rest enters the note at the grid line pressed (issue #293)', async () => {
    const text = '\\ts (5 8)\nr.4{d} r.4 | 3.6.8 5.6.8 7.6.8 8.6.4 |';
    await open('tab', text, 'rest');
    fireEvent.keyDown(editor(), { key: 'n' });
    const { bars: placed, rows, top } = layoutOf(text).systems[0];
    // Over the second rest's own place: the note goes there, after a dotted quarter's rest.
    press(placed[0].columns[1].x, top + stringY(rows, 5));
    expect(bars()).toBe('r.4{d} 0.6.4 | 3.6.8 5.6.8 7.6.8 8.6.4 |');
    // Near the bar's start it goes on beat 1, the Gap after it written by the meter.
    fireEvent.keyDown(editor(), { key: 'z', ctrlKey: true });
    press(placed[0].columns[0].x, top + stringY(rows, 5));
    expect(bars()).toBe('0.6.4 r.8 r.4 | 3.6.8 5.6.8 7.6.8 8.6.4 |');
  });
});

describe('an edit\'s rests are written by the meter', () => {
  it('Delete on the last three quarters of 4/4 leaves a quarter rest and a half rest', async () => {
    await open('tab', '\\ts (4 4)\n3.6.4 5.6.4 7.6.4 8.6.4 |', 'tab-system');
    fireEvent.keyDown(editor(), { key: 'ArrowRight' });
    fireEvent.keyDown(editor(), { key: 'End', shiftKey: true });
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(bars()).toBe('3.6.4 r.4 r.2 |');
  });
});
