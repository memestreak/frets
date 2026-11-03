/**
 * Lengths and rests (issue #290, then rests are Gaps, step 3): a picked note's length keys keep its bar
 * full; a picked rest is a Gap, whose length the keys and Duration buttons can't set
 * (`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`); a rest the tab alone draws is picked anywhere along it.
 */
import { vi } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { LetGoAfterUse } from '@/components/LetGoAfterUse';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { partOf, type Part } from '@/features/tab/clip';
import { type Cursor, type Target } from '@/features/tab/editing';
import { clearToRests, cycleDots, setValue, stepDuration } from '@/features/tab/noteEdits';
import { layoutClip, wholeRestX } from '@/features/tab/layout';
import { rhythmAt } from '@/features/tab/hitTest';

// The built-in arrangements, served as the route serves them; nothing else is fetched.
const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');
const at = (bar: number, column: number): Cursor => ({ bar, column, string: 0 });
/** The rest picked by itself, as a press on it picks it: its column, no string. */
const picked = (clip: Part, bar: number, column: number): Target => {
  const index = clip.bars.slice(0, bar).reduce((n, b) => n + b.columns.length, 0) + column;
  return { cursor: at(bar, column), selection: { anchor: index, focus: index } };
};

describe('a picked rest is a Gap: its length can\'t be set (rests are Gaps, step 3)', () => {
  const clip = clipOf('\\ts (4 4)\n3.6.4 r.4 5.6.4 7.6.4 |');

  it('the length keys and Duration buttons leave a picked rest, or the cursor on one, as it was', () => {
    for (const target of [picked(clip, 0, 1), { cursor: at(0, 1), selection: null }]) {
      expect(setValue(clip, target, 2)).toBe(clip);
      expect(cycleDots(clip, target)).toBe(clip);
      expect(stepDuration(clip, target, 1)).toBe(clip);
      expect(stepDuration(clip, target, -1)).toBe(clip);
    }
    // A run of rests alone, the same.
    const rests = clipOf('\\ts (4 4)\n3.6.4 r.4 r.4 7.6.4 |');
    expect(setValue(rests, { cursor: at(0, 1), selection: { anchor: 1, focus: 2 } }, 8)).toBe(rests);
  });
});

describe('a picked note keeps its bar full (issue #290)', () => {
  const clip = clipOf('\\ts (4 4)\n3.6.4 r.4 5.6.4 7.6.4 |');

  it('a note or a chord does the same; past the bar line a note is tied on (Jeremy, 2026-11-01)', () => {
    expect(bars(setValue(clip, picked(clip, 0, 0), 2))).toBe('3.6.2 5.6.4 7.6.4 |');
    expect(bars(setValue(clip, { cursor: at(0, 2), selection: null }, 8))).toBe('3.6.4 r.4 5.6.8 r.8 7.6.4 |');
    const chord = clipOf('\\ts (4 4)\n3.6.4 5.6.4 (7.6 5.5).4 r.4 | 8.6.2 r.2 |');
    expect(bars(setValue(chord, picked(chord, 0, 2), 1))).toBe('3.6.4 5.6.4 (5.5 7.6).2 |\n(-.5 -.6).2 r.2 |');
  });

  it('a run of several columns with a note, a grace note or a tuplet just changes length, as before', () => {
    expect(bars(setValue(clip, { cursor: at(0, 1), selection: { anchor: 1, focus: 2 } }, 8))).toBe('3.6.4 r.8 5.6.8 7.6.4 |');
  });
});

describe('Delete on a selection (issue #290)', () => {
  it('starts a bar it covers whole again as the fewest rests that fill it, however short it was', () => {
    const short = clipOf('\\ts (4 4)\nr.8 r.8 r.8 r.8 r.8 r.8 |');
    const cleared = clearToRests(short, { anchor: 0, focus: 5 });
    expect(bars(cleared.clip)).toBe('r.1 |');
    expect(cleared.selection).toEqual({ anchor: 0, focus: 0 });
  });

  it('in 3/4 a dotted half; notes too; a bar covered in part keeps its lengths', () => {
    const clip = clipOf('\\ts (3 4)\n3.6.4 5.6.8 r.8 7.6.4 | 3.6.4 5.6.4 7.6.4 | 1.6.2 3.6.4 |');
    // From the second column of bar 1 to the first of bar 3, backwards.
    const cleared = clearToRests(clip, { anchor: 7, focus: 1 });
    expect(bars(cleared.clip)).toBe('3.6.4 r.8 r.8 r.4 |\nr.2{d} |\nr.2 3.6.4 |');
    expect(cleared.selection).toEqual({ anchor: 5, focus: 1 });
  });
});

describe('picking a rest the tab alone draws (issue #290)', () => {
  it('picks a whole or half rest anywhere along its line, a quarter only near it', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 r.4 r.2 | r.1 |');
    const layout = layoutClip(clip, 800, 'tab');
    const { bars: placed, rows, top } = layout.systems[0];
    const y = top + rows.stemTop + 10;
    const half = placed[0].columns[2].x;
    // A Whole-bar rest is drawn centred in its bar (step 3).
    const whole = wholeRestX(placed[1]);
    const quarter = placed[0].columns[1].x;
    expect(rhythmAt(layout, half + 11, y)).toEqual({ bar: 0, column: 2 });
    expect(rhythmAt(layout, whole - 11, y)).toEqual({ bar: 1, column: 0 });
    expect(rhythmAt(layout, quarter + 11, y)).toBeNull();
  });
});

describe('on the page (issue #290)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
  const svg = () => screen.getByRole('img', { name: /drawn as/ });
  const restId = (show: string) => (show === 'tab' ? 'rest' : 'staff-rest');
  const frets = () => {
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    const line = (screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value.split('\n').find(l => l.includes('|'));
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    act(() => editor().focus());
    return line;
  };
  const open = async (show: string, text: string) => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show }));
    window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(text)}`);
    render(<><LetGoAfterUse /><TabPage /></>);
    await waitFor(() => expect(screen.getAllByTestId(restId(show)).length).toBeGreaterThan(0), { timeout: 5000 });
    act(() => editor().focus());
  };
  /** A press on the first rest drawn (jsdom places the drawing at 0, 0). */
  const pressRest = (show: string) => {
    const rest = screen.getAllByTestId(restId(show))[0];
    let x: number;
    let y: number;
    if (show === 'tab') {
      const system = rest.closest('[data-testid="tab-system"]')!;
      const top = Number(/translate\(0 ([\d.-]+)\)/.exec(system.getAttribute('transform')!)![1]);
      const path = rest.getAttribute('d');
      if (path) {
        // A quarter rest: a path starting 12 above its middle, 2 left of it.
        const [, mx, my] = /M([\d.-]+) ([\d.-]+)/.exec(path)!;
        x = Number(mx) + 2;
        y = top + Number(my) + 12;
      } else {
        // An eighth rest or shorter: its stem starts 3 right of its middle and 8 above.
        const stem = rest.querySelector('line')!;
        x = Number(stem.getAttribute('x1')) - 3;
        y = top + Number(stem.getAttribute('y1')) + 8;
      }
    } else {
      const [, tx, ty] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(rest.querySelector('path')!.getAttribute('transform')!)!;
      x = Number(tx) + 4;
      y = Number(ty);
    }
    fireEvent.pointerDown(svg(), { clientX: x, clientY: y, button: 0 });
    fireEvent.pointerUp(svg(), { clientX: x, clientY: y, button: 0 });
  };
  const RIFF = '\\ts (4 4)\n3.6.4 r.4 5.6.4 7.6.4 |';

  it.each([
    ['tab', { key: '^', code: 'Digit6', shiftKey: true }],
    ['tab', { key: 'w' }],
    ['tab', { key: 'q' }],
    ['tab', { key: '.' }],
    ['both', { key: '6' }],
    ['staff', { key: '3' }],
    ['both', { key: '-' }],
  ])('in %s view, %j on a picked rest does nothing (rests are Gaps)', async (show, key) => {
    await open(show, RIFF);
    pressRest(show);
    fireEvent.keyDown(editor(), key);
    expect(frets()).toBe('3.6.4 r.4 5.6.4 7.6.4 |');
  });

  it('a Duration button does nothing on a picked rest, and no Duration button is lit for it', async () => {
    await open('tab', RIFF);
    pressRest('tab');
    for (const name of [/^Whole note/, /^Half note/, /^Quarter note/, /^Eighth note/, /^Dotted/]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
    fireEvent.click(screen.getByRole('button', { name: /^Half note/ }));
    expect(frets()).toBe('3.6.4 r.4 5.6.4 7.6.4 |');
    expect(screen.getByRole('button', { name: /^Half note/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a digit on a picked rest with the tab alone does nothing', async () => {
    await open('tab', RIFF);
    pressRest('tab');
    fireEvent.keyDown(editor(), { key: '6' });
    fireEvent.keyDown(editor(), { key: '3' });
    expect(frets()).toBe('3.6.4 r.4 5.6.4 7.6.4 |');
  });

  it('with the tab alone a press on a note’s stem picks its column, and the length keys change it', async () => {
    await open('tab', RIFF);
    const rest = screen.getAllByTestId('rest')[0];
    const [, , my] = /M([\d.-]+) ([\d.-]+)/.exec(rest.getAttribute('d')!)!;
    const system = rest.closest('[data-testid="tab-system"]')!;
    const top = Number(/translate\(0 ([\d.-]+)\)/.exec(system.getAttribute('transform')!)![1]);
    // The first note's number: its stem is straight under it.
    const three = [...system.querySelectorAll('text')].find(t => t.textContent === '3')!;
    const at = { clientX: Number(three.getAttribute('x')), clientY: top + Number(my) + 12, button: 0 };
    fireEvent.pointerDown(svg(), at);
    fireEvent.pointerUp(svg(), at);
    // No string is picked: nothing is boxed on the strings, and the playback line isn't put down.
    expect(screen.queryByTestId('selected-note')).toBeNull();
    fireEvent.keyDown(editor(), { key: '6' });
    expect(frets()).toBe('3.6.2 5.6.4 7.6.4 |');
    fireEvent.keyDown(editor(), { key: '#', code: 'Digit3', shiftKey: true });
    // The Gap it leaves is written by the meter: a sixteenth rest, an eighth, a quarter (step 3).
    expect(frets()).toBe('3.6.16 r.16 r.8 r.4 5.6.4 7.6.4 |');
  });

  it('a bar selected and deleted becomes one whole rest (Jeremy, 2026-11-01)', async () => {
    await open('tab', '\\ts (4 4)\nr.8 r.8 r.8 r.8 r.8 r.8 |');
    pressRest('tab');
    fireEvent.keyDown(editor(), { key: 'End', shiftKey: true });
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(frets()).toBe('r.1 |');
    // One undo brings the eighths back.
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(frets()).toBe('r.8 r.8 r.8 r.8 r.8 r.8 |');
  });

  it('a note deleted leaves its rest lit with no box round it; a length key then does nothing to it (Jeremy, 2026-11-01; step 3)', async () => {
    await open('both', '\\ts (4 4)\n3.6.4 5.6.4 7.6.4 8.6.4 | 3.6.2 r.2 |');
    // The fourth head of bar 1, pressed a little inside its left edge.
    const path = screen.getAllByTestId('staff-head')[3].querySelector('path')!;
    const [, hx, hy] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(path.getAttribute('transform')!)!;
    const at = { clientX: Number(hx) + 4, clientY: Number(hy), button: 0 };
    fireEvent.pointerDown(svg(), at);
    fireEvent.pointerUp(svg(), at);
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(screen.queryByTestId('range-box')).toBeNull();
    expect(screen.getAllByTestId('staff-rest')[0].querySelector('path')!.getAttribute('fill')).toBe('var(--select)');
    fireEvent.keyDown(editor(), { key: '4' });
    expect(frets()).toBe('3.6.4 5.6.4 7.6.4 r.4 | 3.6.2 r.2 |');
  });
});
