/**
 * A selected rest's length (issue #290): the length keys and the Duration buttons change it, and its bar
 * stays full, as MuseScore's does; and a rest the tab alone draws is picked anywhere along it.
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
import { cycleDots, setValue, stepDuration } from '@/features/tab/noteEdits';
import { layoutClip } from '@/features/tab/layout';
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

describe('a selected rest keeps its bar full (issue #290)', () => {
  const clip = clipOf('\\ts (4 4)\n3.6.4 r.4 5.6.4 7.6.4 |');

  it('longer, it writes over what follows; a column covered in part leaves the rest of its time as rests', () => {
    expect(bars(setValue(clip, picked(clip, 0, 1), 2))).toBe('3.6.4 r.2 7.6.4 |');
    expect(bars(cycleDots(clip, picked(clip, 0, 1)))).toBe('3.6.4 r.4{d} r.8 7.6.4 |');
  });

  it('shorter, the time it gives up becomes rests after it', () => {
    expect(bars(stepDuration(clip, picked(clip, 0, 1), -1))).toBe('3.6.4 r.8 r.8 5.6.4 7.6.4 |');
    expect(bars(setValue(clip, picked(clip, 0, 1), 16))).toBe('3.6.4 r.16 r.8{d} 5.6.4 7.6.4 |');
  });

  it('past the bar line it runs on into the next bar', () => {
    const two = clipOf('\\ts (4 4)\n3.6.4 5.6.4 7.6.4 r.4 | 8.6.4 r.4 r.2 |');
    expect(bars(setValue(two, picked(two, 0, 3), 2))).toBe('3.6.4 5.6.4 7.6.4 r.4 |\nr.4 r.4 r.2 |');
    // A rest at the end of the clip gets a bar of rests to run into.
    const last = clipOf('\\ts (4 4)\n3.6.2 r.2 |');
    expect(bars(setValue(last, picked(last, 0, 1), 1))).toBe('3.6.2 r.2 |\nr.2 r.2 |');
  });

  it('with the cursor on it and nothing selected, the same', () => {
    expect(bars(setValue(clip, { cursor: at(0, 1), selection: null }, 2))).toBe('3.6.4 r.2 7.6.4 |');
  });

  it('a run of several columns, or a note, just changes length, as before', () => {
    expect(bars(setValue(clip, { cursor: at(0, 1), selection: { anchor: 1, focus: 2 } }, 8))).toBe('3.6.4 r.8 5.6.8 7.6.4 |');
    expect(bars(setValue(clip, picked(clip, 0, 0), 2))).toBe('3.6.2 r.4 5.6.4 7.6.4 |');
  });
});

describe('picking a rest the tab alone draws (issue #290)', () => {
  it('picks a whole or half rest anywhere along its line, a quarter only near it', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 r.4 r.2 | r.1 |');
    const layout = layoutClip(clip, 800, 'tab');
    const { bars: placed, rows, top } = layout.systems[0];
    const y = top + rows.stemTop + 10;
    const half = placed[0].columns[2].x;
    const whole = placed[1].columns[0].x;
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
      // The tab's quarter rest: a path starting 12 above its middle.
      const [, mx, my] = /M([\d.-]+) ([\d.-]+)/.exec(rest.getAttribute('d')!)!;
      const system = rest.closest('[data-testid="tab-system"]')!;
      const top = Number(/translate\(0 ([\d.-]+)\)/.exec(system.getAttribute('transform')!)![1]);
      x = Number(mx) + 2;
      y = top + Number(my) + 12;
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
    ['tab', { key: '^', code: 'Digit6', shiftKey: true }, '3.6.4 r.2 7.6.4 |'],
    ['tab', { key: 'w' }, '3.6.4 r.2 7.6.4 |'],
    ['tab', { key: 'q' }, '3.6.4 r.8 r.8 5.6.4 7.6.4 |'],
    ['tab', { key: '.' }, '3.6.4 r.4{d} r.8 7.6.4 |'],
    ['both', { key: '6' }, '3.6.4 r.2 7.6.4 |'],
    ['staff', { key: '3' }, '3.6.4 r.16 r.8{d} 5.6.4 7.6.4 |'],
    ['both', { key: '-' }, '3.6.4 r.8 r.8 5.6.4 7.6.4 |'],
  ])('in %s view, %j on a picked rest', async (show, key, after) => {
    await open(show, RIFF);
    pressRest(show);
    fireEvent.keyDown(editor(), key);
    expect(frets()).toBe(after);
  });

  it('a Duration button sets a picked rest’s length, and the rest stays picked and lit at its new length', async () => {
    await open('tab', RIFF);
    pressRest('tab');
    fireEvent.click(screen.getByRole('button', { name: /^Half note/ }));
    expect(frets()).toBe('3.6.4 r.2 7.6.4 |');
    expect(screen.getByRole('button', { name: /^Half note/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(editor(), { key: 'q' });
    expect(frets()).toBe('3.6.4 r.4 r.4 7.6.4 |');
  });

  it('a digit on a picked rest with the tab alone sets its length', async () => {
    await open('tab', RIFF);
    pressRest('tab');
    fireEvent.keyDown(editor(), { key: '6' });
    expect(frets()).toBe('3.6.4 r.2 7.6.4 |');
    fireEvent.keyDown(editor(), { key: '3' });
    expect(frets()).toBe('3.6.4 r.16 r.4{dd} 7.6.4 |');
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
    expect(frets()).toBe('3.6.2 r.4 5.6.4 7.6.4 |');
    fireEvent.keyDown(editor(), { key: '#', code: 'Digit3', shiftKey: true });
    expect(frets()).toBe('3.6.16 r.4 5.6.4 7.6.4 |');
  });
});
