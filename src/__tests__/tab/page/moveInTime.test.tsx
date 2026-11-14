/**
 * Alt+← → move the picked chord, note or selection by the grid (issue #473,
 * `docs/specs/2026-11-13-tab-move-in-time-design.md`), as Dorico's do.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY, type Layout } from '@/features/tab/layout';
import { setUpPage, renderAt, SLOW, undo, editor, keys, alphaTex } from './helpers';

setUpPage();

const open = async (text: string) => {
  renderAt(`#tab=${encodeURIComponent(`\\title "Moves"\n\\ts (4 4)\n${text}`)}`);
  await screen.findByRole('heading', { name: 'Moves' }, SLOW);
  act(() => editor().focus());
};
const alt = (key: string, more: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => keys({ key, altKey: true, ...more });

describe('TabPage: Alt+← → move by the grid (issue #473)', () => {
  it('moves a note picked by itself alone, leaving the rest of its chord (Jeremy, 2026-11-14)', async () => {
    await open('r.4 r.4 (5.1 3.2 4.3 5.4).16 r.16 r.8 r.4 |');
    keys('ArrowRight', 'ArrowRight');
    alt('ArrowLeft');
    expect(alphaTex()).toBe('r.4 r.8 r.16 5.1.16 (3.2 4.3 5.4).16 r.16 r.8 r.4 |');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
  });

  it('moves the selected sixteenth chord a sixteenth earlier, by its own length with no fixed grid, as one undo step', async () => {
    await open('r.4 r.4 (5.1 3.2 4.3 5.4).16 r.16 r.8 r.4 |');
    const before = alphaTex();
    keys('ArrowRight', 'ArrowRight', { key: 'ArrowRight', shiftKey: true }, { key: 'ArrowLeft', shiftKey: true });
    alt('ArrowLeft');
    expect(alphaTex()).toBe('r.4 r.8 r.16 (5.1 3.2 4.3 5.4).16 r.2 |');
    // Again: it keeps moving, the chord still picked.
    alt('ArrowLeft');
    expect(alphaTex()).toBe('r.4 r.8 (5.1 3.2 4.3 5.4).16 r.16 r.2 |');
    undo();
    undo();
    expect(alphaTex()).toBe(before);
  });

  it('with the fixed grid on, moves by the grid: an eighth', async () => {
    localStorage.setItem('frets.tab.editing', JSON.stringify({ fixedGrid: true, grid: 8 }));
    await open('5.1.4 r.4 r.2 |');
    alt('ArrowRight');
    expect(alphaTex()).toBe('r.8 5.1.4 r.8 r.2 |');
  });

  it('does nothing in note input mode, and Ctrl/⌘+Alt+← → still step through notes', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    const before = alphaTex();
    keys('n');
    alt('ArrowRight');
    keys('Escape');
    expect(alphaTex()).toBe(before);
    alt('ArrowRight', { ctrlKey: true });
    expect(alphaTex()).toBe(before);
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
  });
});

describe('TabPage: a note or what is picked dragged left or right (issue #473)', () => {
  const BODY = '\\ts (4 4)\n(5.1 7.2).4 r.4 r.2 |';
  /** Opens BODY on the tab alone, drawn as jsdom draws it (800 wide at 0, 0), and gives its layout. */
  const openTab = async (): Promise<Layout> => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
    const text = `\\title "Drags"\n${BODY}`;
    renderAt(`#tab=${encodeURIComponent(text)}`);
    await screen.findByRole('heading', { name: 'Drags' }, SLOW);
    const read = readAlphaTexWith(alphaTab, text);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    return layoutClip(partOf(read.clip), 800, 'tab');
  };
  const drawing = () => screen.getByRole('img', { name: /drawn as/ });
  /** Where column `index`'s note on `string` is drawn. */
  const at = (layout: Layout, index: number, string: number) => {
    const system = layout.systems[0];
    const column = system.bars.flatMap(b => b.columns).find(c => c.index === index)!;
    return { clientX: column.x + 1, clientY: system.top + stringY(system.rows, string) };
  };
  /** Presses the note on `string` in column 0 and moves to column 1, letting go unless `hold`. */
  const dragToSecond = (layout: Layout, string: number, hold = false) => {
    const from = at(layout, 0, string);
    const to = at(layout, 1, string);
    fireEvent.pointerDown(drawing(), { ...from, button: 0, pointerId: 1 });
    fireEvent.pointerMove(drawing(), { ...from, clientX: from.clientX + 10, pointerId: 1 });
    fireEvent.pointerMove(drawing(), { ...to, pointerId: 1 });
    if (!hold) fireEvent.pointerUp(drawing(), { ...to, pointerId: 1 });
  };

  it('a note dragged by itself moves alone, the rest of its chord staying (Jeremy, 2026-11-14)', async () => {
    const layout = await openTab();
    dragToSecond(layout, 1);
    expect(alphaTex()).toBe('5.1.4 7.2.4 r.2 |');
  });

  it('a note of a chord already picked whole drags the whole chord, as one undo step', async () => {
    const layout = await openTab();
    act(() => editor().focus());
    // The chord's Column selected by itself.
    keys({ key: 'ArrowRight', shiftKey: true }, { key: 'ArrowLeft', shiftKey: true });
    dragToSecond(layout, 1);
    expect(alphaTex()).toBe('r.4 (5.1 7.2).4 r.2 |');
    undo();
    expect(alphaTex()).toBe('(5.1 7.2).4 r.4 r.2 |');
  });

  it('a press without a move on a note inside what is picked picks that note', async () => {
    const layout = await openTab();
    act(() => editor().focus());
    keys({ key: 'ArrowRight', shiftKey: true }, { key: 'ArrowLeft', shiftKey: true });
    const on = at(layout, 0, 1);
    fireEvent.pointerDown(drawing(), { ...on, button: 0, pointerId: 1 });
    fireEvent.pointerUp(drawing(), { ...on, pointerId: 1 });
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    expect(alphaTex()).toBe('(5.1 7.2).4 r.4 r.2 |');
  });

  it('shows the Grid in the bar under the drag, and none once it lets go (Jeremy, 2026-11-14)', async () => {
    const layout = await openTab();
    expect(screen.queryAllByTestId('grid-lines')).toHaveLength(0);
    dragToSecond(layout, 1, true);
    expect(screen.getAllByTestId('grid-lines')).toHaveLength(1);
    fireEvent.pointerUp(drawing(), { ...at(layout, 1, 1), pointerId: 1 });
    expect(screen.queryAllByTestId('grid-lines')).toHaveLength(0);
  });
});
