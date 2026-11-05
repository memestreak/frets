/**
 * A Shift+press only ever grows the selection to take in what was pressed (issue #366): before the
 * selection it moves the start, after it the end, whichever end Shift+arrows started from, on the tab,
 * the staff, a rest, the gap above the drawing, across bars, lines, strings and in another Voice. Inside
 * it, the end last grown comes back to the press, as Shift+arrows would. The pure rule is in
 * `../growSelection.test.ts`.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY } from '@/features/tab/layout';
import { setUpPage, renderAt, SLOW, editor, keys, litFrets } from './helpers';

setUpPage();

/** Three bars of quarters on the high e, frets 1 to 12, so each column's fret names it. */
const TWELVE = ':4 1.1 2.1 3.1 4.1 | 5.1 6.1 7.1 8.1 | 9.1 10.1 11.1 12.1 |';

async function open(tex: string, show: 'tab' | 'both' = 'tab') {
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show }));
  renderAt(`#tab=${encodeURIComponent(`\\title "Grow"\n${tex}`)}`);
  await screen.findByRole('heading', { name: 'Grow' }, SLOW);
  act(() => editor().focus());
}

/** Where Column `index` (counted over the whole clip) is drawn on string `string` (jsdom draws the tab 800 wide at 0, 0). */
function spot(tex: string, index: number, string = 0, show: 'tab' | 'both' = 'tab') {
  const read = readAlphaTexWith(alphaTab, tex);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  for (const system of layoutClip(partOf(read.clip), 800, show).systems) {
    for (const bar of system.bars) {
      const placed = bar.columns.find(c => c.index === index);
      if (placed) return { clientX: placed.x, clientY: system.top + stringY(system.rows, string) };
    }
  }
  throw new Error(`No Column ${index}`);
}

const svg = () => screen.getByRole('img', { name: /drawn as/ });
function press(at: { clientX: number; clientY: number }, shiftKey = false) {
  fireEvent.pointerDown(svg(), { ...at, button: 0, shiftKey });
  fireEvent.pointerUp(svg(), { ...at, button: 0, shiftKey });
}
/** The selected frets, in order: each names its column in `TWELVE`. */
const selected = () => litFrets().map(t => Number(t.textContent));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const shiftLeft = { key: 'ArrowLeft', shiftKey: true };
const shiftRight = { key: 'ArrowRight', shiftKey: true };

describe('a Shift+press grows the selection to what was pressed (issue #366)', () => {
  it('after a selection made leftwards, grows its end and keeps its start (it used to drop the start)', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 3));
    keys(shiftLeft, shiftLeft);
    expect(selected()).toEqual([2, 3, 4]);
    press(spot(TWELVE, 5), true);
    expect(selected()).toEqual(range(2, 6));
    // Shift+arrows go on from the end that moved.
    keys(shiftRight);
    expect(selected()).toEqual(range(2, 7));
  });

  it('before a selection made rightwards, grows its start and keeps its end (it used to drop the end)', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 9));
    keys(shiftRight, shiftRight);
    expect(selected()).toEqual([10, 11, 12]);
    press(spot(TWELVE, 1), true);
    expect(selected()).toEqual(range(2, 12));
    keys(shiftLeft);
    expect(selected()).toEqual(range(1, 12));
  });

  it('grows a bar picked by a press beside its notes either way, across bar lines', async () => {
    await open(TWELVE);
    // A blank string in bar 2 picks the bar.
    press(spot(TWELVE, 5, 3));
    expect(selected()).toEqual([5, 6, 7, 8]);
    press(spot(TWELVE, 0), true);
    expect(selected()).toEqual(range(1, 8));
    press(spot(TWELVE, 10), true);
    expect(selected()).toEqual(range(1, 11));
  });

  it('grows one way then the other, never losing what was selected', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 4));
    press(spot(TWELVE, 6), true);
    expect(selected()).toEqual([5, 6, 7]);
    press(spot(TWELVE, 1), true);
    expect(selected()).toEqual(range(2, 7));
    press(spot(TWELVE, 9), true);
    expect(selected()).toEqual(range(2, 10));
  });

  it('grows the same whichever string is pressed, a note or a blank one', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 4));
    keys(shiftLeft);
    press(spot(TWELVE, 7, 5), true);
    expect(selected()).toEqual(range(4, 8));
    press(spot(TWELVE, 1, 2), true);
    expect(selected()).toEqual(range(2, 8));
  });

  it('grows across lines of the clip', async () => {
    const LONG = Array.from({ length: 10 }, (_, b) => `${b + 1}.1.4 ${b + 1}.1.4 ${b + 1}.1.4 ${b + 1}.1.4 |`).join(' ');
    const read = readAlphaTexWith(alphaTab, LONG);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const systems = layoutClip(partOf(read.clip), 800, 'tab').systems;
    expect(systems.length).toBeGreaterThan(1);
    const lastOfFirstLine = systems[0].bars.at(-1)!.columns.at(-1)!.index;
    await open(LONG);
    // Leftwards from the first line's last column, then a press on the next line's second column.
    press(spot(LONG, lastOfFirstLine));
    keys(shiftLeft);
    press(spot(LONG, lastOfFirstLine + 2), true);
    expect(litFrets()).toHaveLength(4);
    // And back to the first column: everything from it to there.
    press(spot(LONG, 0), true);
    expect(litFrets()).toHaveLength(lastOfFirstLine + 3);
  });

  it('inside the selection, trims it from the end nearer the press (Jeremy, 2026-11-05)', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 1));
    press(spot(TWELVE, 7), true);
    expect(selected()).toEqual(range(2, 8));
    // Nearer the end: the end comes back to the press.
    press(spot(TWELVE, 5), true);
    expect(selected()).toEqual(range(2, 6));
    // Nearer the start: the start comes up to it.
    press(spot(TWELVE, 2), true);
    expect(selected()).toEqual(range(3, 6));
    // Then Shift+arrows go on from the start.
    keys(shiftRight);
    expect(selected()).toEqual(range(4, 6));
  });

  it('inside the selection, halfway, trims the end last grown', async () => {
    await open(TWELVE);
    // Grown rightwards, 2 to 6: a press on the 4 trims the end.
    press(spot(TWELVE, 1));
    press(spot(TWELVE, 5), true);
    press(spot(TWELVE, 3), true);
    expect(selected()).toEqual([2, 3, 4]);
    // Grown leftwards, 2 to 6: it trims the start.
    press(spot(TWELVE, 5));
    press(spot(TWELVE, 1), true);
    press(spot(TWELVE, 3), true);
    expect(selected()).toEqual([4, 5, 6]);
  });

  it('with only the cursor, selects from its column to the press, as before', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 6));
    press(spot(TWELVE, 2), true);
    expect(selected()).toEqual(range(3, 7));
  });

  it('on the staff, grows the same', async () => {
    await open(TWELVE, 'both');
    const heads = () => screen.getAllByTestId('staff-head');
    const headAt = (k: number) => {
      const path = heads()[k].querySelector('path')!;
      const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(path.getAttribute('transform')!)!;
      return { clientX: Number(x) + 4, clientY: Number(y) };
    };
    const lit = () => heads().flatMap((h, k) => (h.hasAttribute('data-selected') ? [k + 1] : []));
    press(headAt(3));
    keys(shiftLeft, shiftLeft);
    expect(lit()).toEqual([2, 3, 4]);
    press(headAt(5), true);
    expect(lit()).toEqual(range(2, 6));
    press(headAt(0), true);
    expect(lit()).toEqual(range(1, 6));
  });

  it('on a rest, grows to it; on a Whole-bar rest, to its whole bar', async () => {
    const RESTS = ':4 1.1 2.1 r 4.1 | r.1 | 9.1 10.1 11.1 12.1 |';
    await open(RESTS, 'both');
    const rests = () => screen.getAllByTestId('staff-rest').map(r => r.querySelector('path')!);
    const restAt = (k: number) => {
      const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(rests()[k].getAttribute('transform')!)!;
      return { clientX: Number(x) + 4, clientY: Number(y) };
    };
    const litRests = () => rests().map(r => r.getAttribute('fill') === 'var(--select)');
    // The last bar's 9 and 10, selected leftwards from the 10.
    press(spot(RESTS, 6, 0, 'both'));
    keys(shiftLeft);
    expect(selected()).toEqual([9, 10]);
    expect(litRests()).toEqual([false, false]);
    // The Whole-bar rest in bar 2: the selection takes it in.
    press(restAt(1), true);
    expect(selected()).toEqual([9, 10]);
    expect(litRests()).toEqual([false, true]);
    // Then the rest in bar 1: it, the 4 and everything after.
    press(restAt(0), true);
    expect(selected()).toEqual([4, 9, 10]);
    expect(litRests()).toEqual([true, true]);
  });

  it('above the drawing, from a selection made leftwards, grows to the gap pressed', async () => {
    await open(TWELVE);
    press(spot(TWELVE, 3));
    keys(shiftLeft, shiftLeft);
    // Above the drawing, halfway between the 7 and the 8: the gap after the 7.
    const x = (spot(TWELVE, 6).clientX + spot(TWELVE, 7).clientX) / 2;
    press({ clientX: x, clientY: -4 }, true);
    expect(selected()).toEqual(range(2, 7));
  });

  it('in another Voice, grows in the Active voice', async () => {
    const TWO = '\\voiceMode barWise\n\\voice 1.1.4 2.1.4 3.1.4 4.1.4 \\voice 5.4.4 6.4.4 7.4.4 8.4.4 |';
    await open(TWO);
    keys({ key: '2', altKey: true, code: 'Digit2' });
    // Voice 2's notes, pressed on the D string.
    const read = readAlphaTexWith(alphaTab, TWO);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { bars, top, rows } = layoutClip(partOf(read.clip), 800, 'tab').systems[0];
    const voiceTwo = (k: number) => ({ clientX: bars[0].voices!.find(v => v.voice === 1)!.columns[k].x, clientY: top + stringY(rows, 3) });
    press(voiceTwo(2));
    keys(shiftLeft);
    press(voiceTwo(3), true);
    expect(selected()).toEqual(expect.arrayContaining([6, 7, 8]));
    expect(selected()).not.toContain(5);
  });
});
