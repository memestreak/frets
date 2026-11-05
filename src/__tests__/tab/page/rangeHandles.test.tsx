/**
 * Range handles (`docs/specs/2026-11-05-tab-range-handles-design.md`): a selected run's two ends dragged
 * on the page, the other end staying put.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { layoutClip, stringY, type Layout } from '@/features/tab/layout';
import { markBoxes } from '@/features/tab/marks';
import { knobY, rangeHandles, type RangeEnd } from '@/features/tab/rangeBox';
import { setUpPage, renderAt, SLOW, undo, litFrets, editor, keys } from './helpers';

setUpPage();

function clipOf(text: string): Part {
  const read = readAlphaTexWith(alphaTab, text);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return partOf(read.clip);
}

// Two bars on the first line (places 0–7), one on the second (8–11); every fret different, to tell what is lit.
const BARS = '\\systemsLayout 2\n\\ts (4 4)\n0.3.4 2.3.4 3.3.4 5.3.4 |\n7.3.4 8.3.4 10.3.4 12.3.4 |\n1.3.4 4.3.4 6.3.4 9.3.4 |';

/** Opens `body` on the tab alone, drawn as jsdom draws it (800 wide at 0, 0), and gives its layout. */
async function open(body = BARS, search = ''): Promise<Layout> {
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab', lineBreaks: true }));
  const text = `\\title "Handles"\n${body}`;
  window.history.replaceState(null, '', `/tab${search}`);
  renderAt(`${search}#tab=${encodeURIComponent(text)}`);
  await screen.findByRole('heading', { name: 'Handles' }, SLOW);
  return layoutClip(clipOf(text), 800, 'tab');
}

const drawing = () => screen.getByRole('img', { name: /drawn as/ });
const lit = () => litFrets().map(t => t.textContent);
const placed = (layout: Layout, index: number) => {
  for (const [si, system] of layout.systems.entries()) {
    const column = system.bars.flatMap(b => b.columns).find(c => c.index === index);
    if (column) return { x: column.x, y: system.top + stringY(system.rows, 2), si };
  }
  throw new Error(`no column ${index}`);
};
/** Selects the second and third notes (places 1 and 2) with the keys. */
function selectSecondAndThird() {
  act(() => editor().focus());
  keys('ArrowRight', { key: 'ArrowRight', shiftKey: true });
  expect(lit()).toEqual(['2', '3']);
}
/** Presses `end`'s handle of the run `range`, moves to `to`, and (unless `hold`) lets go there. */
function drag(layout: Layout, range: [number, number], end: RangeEnd, to: { x: number; y: number } | null, hold = false) {
  const handle = rangeHandles(layout, range).find(h => h.end === end)!;
  const at = { clientX: handle.x, clientY: knobY(handle, 'knob') };
  fireEvent.pointerDown(drawing(), { ...at, button: 0, pointerId: 1 });
  const target = to ? { clientX: to.x, clientY: to.y } : at;
  if (to) fireEvent.pointerMove(drawing(), { ...target, pointerId: 1 });
  if (!hold) fireEvent.pointerUp(drawing(), { ...target, pointerId: 1 });
}

describe('Range handles', () => {
  it('a selected run has a handle at each end; nothing selected, none', async () => {
    await open();
    expect(screen.queryAllByTestId('range-handle')).toHaveLength(0);
    selectSecondAndThird();
    expect(screen.getAllByTestId('range-handle').map(h => h.getAttribute('data-end'))).toEqual(['start', 'end']);
  });

  it('dragging the end handle right grows the run to the column under the pointer; the start stays', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'end', placed(layout, 5));
    expect(lit()).toEqual(['2', '3', '5', '7', '8']);
  });

  it('dragging the start handle left grows the run from the start; the end stays', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'start', { x: layout.systems[0].bars[0].x0, y: placed(layout, 0).y });
    expect(lit()).toEqual(['0', '2', '3']);
  });

  it('dragging an end inward trims the run from that end', async () => {
    const layout = await open();
    act(() => editor().focus());
    keys({ key: 'ArrowRight', shiftKey: true }, { key: 'ArrowRight', shiftKey: true }, { key: 'ArrowRight', shiftKey: true });
    expect(lit()).toEqual(['0', '2', '3', '5']);
    drag(layout, [0, 3], 'end', placed(layout, 1));
    expect(lit()).toEqual(['0', '2']);
  });

  it('dragged past the other end, it stops there: one column stays selected', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'start', placed(layout, 6));
    expect(lit()).toEqual(['3']);
    drag(layout, [2, 2], 'end', { x: layout.systems[0].bars[0].x0, y: placed(layout, 0).y });
    expect(lit()).toEqual(['3']);
  });

  it('the end handle goes onto the next line', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'end', placed(layout, 9));
    expect(lit()).toEqual(['2', '3', '5', '7', '8', '10', '12', '1', '4']);
    // Over a line break, the start handle is on the first line and the end handle on the last.
    const [start, end] = rangeHandles(layout, [1, 9]);
    expect([start.system, end.system]).toEqual([0, 1]);
  });

  it('the dragged end is the focus: Shift+arrows go on from it', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'start', placed(layout, 0));
    keys({ key: 'ArrowLeft', shiftKey: true });
    // The start was dragged onto the first column: Shift+← can't go further, Shift+→ trims from it.
    keys({ key: 'ArrowRight', shiftKey: true });
    expect(lit()).toEqual(['2', '3']);
    drag(layout, [1, 2], 'end', placed(layout, 4));
    keys({ key: 'ArrowRight', shiftKey: true });
    expect(lit()).toEqual(['2', '3', '5', '7', '8']);
  });

  it('Esc while dragging puts the run back', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'end', placed(layout, 6), true);
    expect(lit()).toEqual(['2', '3', '5', '7', '8', '10']);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(drawing(), { clientX: placed(layout, 6).x, clientY: placed(layout, 6).y, pointerId: 1 });
    expect(lit()).toEqual(['2', '3']);
  });

  it('a press on a handle that does not move leaves the run as it was', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'end', null);
    expect(lit()).toEqual(['2', '3']);
  });

  it('a drag is not an edit: the music is the same and there is nothing to undo', async () => {
    const layout = await open();
    selectSecondAndThird();
    drag(layout, [1, 2], 'end', placed(layout, 5));
    undo();
    expect(lit()).toEqual(['2', '3', '5', '7', '8']);
  });

  it('a picked Span’s run has no Range handles, only its own Handles', async () => {
    const layout = await open('\\ts (4 4)\n0.3.4 2.3{lr}.4 3.3{lr}.4 5.3.4 |');
    const ring = markBoxes(layout).find(m => m.hit.mark === 'letRing')!.box;
    fireEvent.pointerDown(drawing(), { clientX: ring.x + ring.width / 2, clientY: ring.y + ring.height / 2, button: 0 });
    expect(screen.getAllByTestId('span-handle')).toHaveLength(2);
    expect(screen.queryAllByTestId('range-handle')).toHaveLength(0);
  });
});
