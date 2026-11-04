/*
 * Ties forward and a Tie chain as one note, on the page (`docs/specs/2026-11-04-tab-ties-forward-design.md`):
 * pressing, Alt+press, the arrows, `=`, the tie arc and the Tie tool. The edits themselves are in `ties.test.ts`.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip, stringY, type Parts } from '@/features/tab/layout';
import { markBoxes } from '@/features/tab/marks';
import { partOf } from '@/features/tab/clip';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTex } from './helpers';
import { tool } from '../tool';

// Every note the page asks to hear, counted: `=` in note input plays nothing (spec Q22).
const heard = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/features/tab/PlaybackFooter', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/tab/PlaybackFooter')>();
  return {
    ...actual,
    usePlayback: (...args: Parameters<typeof actual.usePlayback>) => {
      const playback = actual.usePlayback(...args);
      return { ...playback, hear: (...at: Parameters<typeof playback.hear>) => { heard.count++; playback.hear(...at); } };
    },
  };
});

setUpPage();

/** Opens `tex` (with a title) in `parts`, the editor focused. */
async function open(tex: string, parts: Parts = 'tab') {
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
  renderAt(`#tab=${encodeURIComponent(`\\title "Ties"\n\\ts (4 4)\n${tex}`)}`);
  await screen.findByRole('heading', { name: 'Ties' }, SLOW);
  act(() => editor().focus());
}

/** Where Column `index` on `string` is drawn on the tab (jsdom draws it 800 wide at 0, 0). */
function spot(tex: string, index: number, string: number, parts: Parts = 'tab') {
  const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${tex}`);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  const { systems } = layoutClip(partOf(read.clip), 800, parts);
  for (const system of systems) {
    const placed = system.bars.flatMap(b => b.columns).find(c => c.index === index);
    if (placed) return { clientX: placed.x, clientY: system.top + stringY(system.rows, string) };
  }
  throw new Error(`No Column ${index}`);
}

/** A press (Alt+press with `alt`) on Column `index`, string `string`. */
function press(tex: string, index: number, string: number, { alt = false, parts = 'tab' as Parts } = {}) {
  const at = { ...spot(tex, index, string, parts), button: 0, altKey: alt };
  const svg = screen.getByRole('img', { name: /drawn as/ });
  fireEvent.pointerDown(svg, at);
  fireEvent.pointerUp(svg, at);
}

/** What the clipboard takes from the selection: its bars after the header, one per line. */
function copied() {
  const data = new Map<string, string>();
  const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
  act(() => { editor().dispatchEvent(copy); });
  const [, ...body] = data.get('text/plain')!.split('\n');
  return (body.join(' ').match(/[^|]*\|/g) ?? []).map(b => b.trim()).join('\n');
}

/** The middle x of the cursor's box: round a note, a Column, or note input's. */
const cursorX = () => {
  const box = ['selected-note', 'column-cursor', 'input-cursor'].map(id => screen.queryByTestId(id)).find(Boolean)!;
  return Number(box.getAttribute('x')) + Number(box.getAttribute('width')) / 2;
};

describe('a Tie chain is one note', () => {
  // A quarter on beat 4 tied over the bar line to a quarter.
  const OVER = '5.1.4 5.1.4 5.1.4 7.1.4 | -.1.4 r.4 r.2 |';

  it('a press on its second Tied note puts the cursor on the first and draws both picked', async () => {
    await open(OVER);
    press(OVER, 4, 0);
    // The cursor is on the 7 of bar 1.
    expect(Math.abs(cursorX() - spot(OVER, 3, 0).clientX)).toBeLessThan(13);
    // The tied (7) past the bar line is drawn picked too.
    expect(screen.getAllByTestId('tied-note')).toHaveLength(1);
    // A fret typed there changes both, and keeps the tie.
    keys('9');
    expect(alphaTex()).toBe('5.1.4 5.1.4 5.1.4 9.1.4 |\n-.1.4 r.4 r.2 |');
  });

  it('a press where Both view hides a tied number inside a bar picks the chain', async () => {
    // `q~q` on beats 1 and 2 would be written `h`; a dotted rhythm keeps two Tied notes in one bar.
    const INSIDE = '5.1.4 -.1.8 r.8 r.2 |';
    await open(INSIDE, 'both');
    press(INSIDE, 1, 0, { parts: 'both' });
    keys('7');
    expect(alphaTex()).toBe('7.1.4 -.1.8 r.8 r.2 |');
  });

  it('normal mode → stops where a moving melody’s notes start and skips a Column holding only the tied-on note', async () => {
    // A dotted half on the low string held under a melody on beats 1 and 2, then alone on beat 3.
    const HELD = '(3.6 0.1).4 (-.6 2.1).4 -.6.4 r.4 |';
    await open(HELD);
    press(HELD, 0, 5);
    keys('ArrowRight');
    // The melody's 2 starts there; the bass held from beat 1 is not the selection's.
    expect(copied()).toBe('2.1.4 |');
    keys('ArrowRight');
    // Beat 3 holds only the tied-on bass: → goes on to the rest.
    expect(copied()).toBe('r.4 |');
  });

  it('Alt+→ stops on a chain once: its first note, then the tie arc (a mark of the Tied note), then what follows', async () => {
    const CHAIN = '5.1.4 -.1.8 r.8 3.1.2 |';
    await open(CHAIN);
    press(CHAIN, 0, 0);
    keys({ key: 'ArrowRight', altKey: true });
    expect(tool('Tie to the next note')).toHaveAttribute('aria-pressed', 'true');
    keys({ key: 'ArrowRight', altKey: true }, { key: 'ArrowRight', altKey: true });
    keys('Delete');
    // The bar is written again by the meter: the chain on beat 1 becomes a dotted quarter.
    expect(alphaTex()).toBe('5.1.4{d} r.8 r.2 |');
  });
});

describe('one Tied note alone (Alt+press)', () => {
  it('takes a bend on that note only; a length key still changes the whole chain', async () => {
    const DOTTED = '7.3.4 -.3.8 r.8 r.2 |';
    await open(DOTTED);
    press(DOTTED, 1, 2, { alt: true });
    // Only the Tied note is drawn picked: no other note of the chain lights.
    expect(screen.queryAllByTestId('tied-note')).toHaveLength(0);
    fireEvent.click(tool('Bend'));
    fireEvent.click(screen.getByRole('button', { name: 'full' }));
    act(() => editor().focus());
    expect(alphaTex()).toMatch(/^7\.3\.4 -\.3\{b \(0 4\)\}\.8 /);
    // A half from the chain's start, keeping the chain's dot as the length keys keep a note's.
    keys({ key: '^', shiftKey: true, code: 'Digit6' });
    expect(alphaTex()).toBe('7.3.2{d} r.4 |');
  });

  it('is listed in the ? overlay, with = and − for longer and shorter', () => {
    const listed = TAB_SHORTCUTS.flatMap(g => g.shortcuts);
    expect(listed.some(s => s.keys.includes('Alt+press'))).toBe(true);
    expect(listed.filter(s => s.keys.includes('=') && s.keys.includes('−')).map(s => s.does)).toEqual(['Longer or shorter next note', 'Longer or shorter (the bar stays full)']);
  });
});

describe('T, the Tie tool, and the keys round it', () => {
  it('the Tie tool’s tip is "Tie to the next note", and it lights only on a picked tie arc', async () => {
    const CHAIN = '7.3.4 -.3.4 r.2 |';
    await open(CHAIN);
    press(CHAIN, 0, 2);
    expect(tool('Tie to the next note')).toHaveAttribute('data-tip', 'Tie to the next note (T)');
    expect(tool('Tie to the next note')).toHaveAttribute('aria-pressed', 'false');
    // The arc picked: the tool lights; Delete splits the chain, the note after played again at the same fret.
    const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${CHAIN}`);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { box } = markBoxes(layoutClip(partOf(read.clip), 800, 'tab')).find(m => m.hit.mark === 'tie')!;
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, button: 0 };
    fireEvent.pointerDown(svg, at);
    fireEvent.pointerUp(svg, at);
    expect(tool('Tie to the next note')).toHaveAttribute('aria-pressed', 'true');
    keys('Delete');
    expect(alphaTex()).toBe('7.3.4 7.3.4 r.2 |');
  });

  it('T on a picked tie arc unties too; T on a picked note never does', async () => {
    const CHAIN = '7.3.4 -.3.4 r.2 |';
    await open(CHAIN);
    press(CHAIN, 0, 2);
    // On the chain, T ties on into the rest after it: a half rest becomes a tied half, written as a whole note.
    keys('t');
    expect(alphaTex()).toBe('7.3.1 |');
    keys({ key: 'z', ctrlKey: true });
    const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${CHAIN}`);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { box } = markBoxes(layoutClip(partOf(read.clip), 800, 'tab')).find(m => m.hit.mark === 'tie')!;
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, button: 0 };
    fireEvent.pointerDown(svg, at);
    fireEvent.pointerUp(svg, at);
    keys('t');
    expect(alphaTex()).toBe('7.3.4 7.3.4 r.2 |');
  });

  it('T in note input ties on a note of the input length, keeps the cursor on the chain, and plays nothing', async () => {
    const TUNE = '5.1.2 7.1.4 8.1.4 |';
    localStorage.setItem('frets.tab.playback', JSON.stringify({ hearNotes: true }));
    await open(TUNE);
    keys('n');
    press(TUNE, 0, 0);
    keys({ key: '%', shiftKey: true, code: 'Digit5' });
    const before = heard.count;
    keys('t');
    // A quarter tied on after the half, written over the 7: a dotted half.
    expect(alphaTex()).toBe('5.1.2{d} 8.1.4 |');
    // The cursor stays on the chain, so T again makes it longer.
    expect(Math.abs(cursorX() - spot(TUNE, 0, 0).clientX)).toBeLessThan(13);
    keys('t');
    expect(alphaTex()).toBe('5.1.1 |');
    expect(heard.count).toBe(before);
    // A fret typed is heard, so the count would have seen one (it enters a note of the input length, as on a lone note).
    keys('7');
    expect(heard.count).toBe(before + 1);
  });

  it('= and − make a picked note longer and shorter, as Dorico’s; Alt+T taps it (T was Tap)', async () => {
    const TUNE = '5.1.4 r.4 r.2 |';
    await open(TUNE);
    press(TUNE, 0, 0);
    keys('=');
    expect(alphaTex()).toBe('5.1.2 r.2 |');
    keys('-');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    expect(tool('Tap')).toHaveAttribute('data-tip', 'Tap (Alt+T)');
    keys({ key: '†', altKey: true, code: 'KeyT' });
    expect(alphaTex()).toBe('5.1.4{tt} r.4 r.2 |');
  });

  it('= in note input makes the next note longer', async () => {
    await open('5.1.4 r.4 r.2 |');
    keys('n', { key: '%', shiftKey: true, code: 'Digit5' }, '=');
    expect(tool('Half note')).toHaveAttribute('aria-pressed', 'true');
  });
});
