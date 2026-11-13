/**
 * A press on the Tab page never scrolls the page (issue #470): every focus the page moves after a press
 * keeps the page where it is (`preventScroll`), in the staff view, the tab and both, and the palettes'
 * column is never the browser's scroll anchor, so collapsing or opening a palette doesn't scroll it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, type Layout, type Parts } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { markBoxes, type Box } from '@/features/tab/marks';
import { setUpPage, renderAt, SLOW, editor } from './helpers';

setUpPage();

const BODY = '\\ts (4 4)\n5.6.4{ch "G"} (7.5{lr}).4 (3.4{lr}).4 r.4 |';

/** Opens BODY in `parts`, with the editor not focused (as on a press from elsewhere), and gives its layout. */
async function open(parts: Parts): Promise<Layout> {
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
  const text = `\\title "No scroll"\n${BODY}`;
  renderAt(`#tab=${encodeURIComponent(text)}`);
  await screen.findByRole('heading', { name: 'No scroll' }, SLOW);
  if (parts !== 'tab') await waitFor(() => expect(screen.getAllByTestId('staff-head').length).toBeGreaterThan(0), SLOW);
  const read = readAlphaTexWith(alphaTab, text);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return layoutClip(partOf(read.clip), 800, parts);
}

const drawing = () => screen.getByRole('img', { name: /drawn as/ });
const middleOf = (box: Box) => ({ clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });

/** Where a staff head is drawn (jsdom places the drawing at 0, 0): a little inside its left edge. */
const headAt = (k: number) => {
  const path = screen.getAllByTestId('staff-head')[k].querySelector('path')!;
  const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(path.getAttribute('transform')!)!;
  return { clientX: Number(x) + 4, clientY: Number(y) };
};

/** Runs `press` and expects the page to have moved the focus at least once, and only ever with preventScroll. */
function expectNoScroll(press: () => void) {
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  try {
    act(press);
    expect(focus).toHaveBeenCalled();
    for (const [options] of focus.mock.calls) expect(options).toEqual({ preventScroll: true });
  } finally {
    focus.mockRestore();
  }
}

describe('a press never scrolls the page (issue #470)', () => {
  it.each<Parts>(['staff', 'both'])('a press on a note head on the staff (%s)', async parts => {
    await open(parts);
    expectNoScroll(() => {
      fireEvent.pointerDown(drawing(), { ...headAt(0), button: 0 });
      fireEvent.pointerUp(drawing(), { ...headAt(0), button: 0 });
    });
  });

  it.each<Parts>(['staff', 'both'])('a press beside the heads, which selects the bar (%s)', async parts => {
    await open(parts);
    // Above the first head on the staff, in its column: a line or space with no note.
    const at = { clientX: headAt(0).clientX, clientY: headAt(0).clientY - 20 };
    expectNoScroll(() => {
      fireEvent.pointerDown(drawing(), { ...at, button: 0 });
      fireEvent.pointerUp(drawing(), { ...at, button: 0 });
    });
    expect(editor()).toHaveFocus();
  });

  it.each<Parts>(['tab', 'staff', 'both'])('a press on a chord name (%s)', async parts => {
    const layout = await open(parts);
    const hit: WordHit = { kind: 'chord', index: 0 };
    expectNoScroll(() => fireEvent.pointerDown(drawing(), { ...middleOf(textBox(layout, hit)!), button: 0 }));
  });

  it.each<Parts>(['tab', 'both'])('a press on a technique mark (%s)', async parts => {
    const layout = await open(parts);
    const letRing = markBoxes(layout).find(m => m.hit.mark === 'letRing')!;
    expectNoScroll(() => fireEvent.pointerDown(drawing(), { ...middleOf(letRing.box), button: 0 }));
  });

  it('the palettes’ column is never the scroll anchor, so collapsing or opening a palette keeps the page still', () => {
    // jsdom has no scroll anchoring, so the rule itself is checked.
    const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
    expect(css).toMatch(/\.tab-rail-column\s*\{\s*overflow-anchor:\s*none;\s*\}/);
  });
});
