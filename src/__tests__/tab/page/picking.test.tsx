import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip } from '@/features/tab/layout';
import { markBoxes, type MarkHit } from '@/features/tab/marks';
import { partOf } from '@/features/tab/clip';
import { setUpPage, exampleById, renderAt, alphaTexText, SLOW, settle, undo, litFrets, isLit } from './helpers';
import { tool } from '../tool';

setUpPage();

describe('picking a technique mark (issue #128)', () => {
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });

  /**
   * Opens an example and presses the middle of its first drawn `mark` (jsdom draws the tab 800 wide at 0, 0);
   * `button` 2 is a right-click, which picks it and opens its menu.
   */
  async function pressMark(example: string, mark: MarkHit['mark'], button = 0) {
    const { title, text } = exampleById(example)!;
    renderAt(`#example=${example}`);
    await screen.findByRole('heading', { name: title }, SLOW);
    const read = readAlphaTexWith(alphaTab, text);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { box } = markBoxes(layoutClip(partOf(read.clip), 800)).find(m => m.hit.mark === mark)!;
    const svg = screen.getByRole('img', { name: /drawn as tab/ });
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    fireEvent.pointerDown(svg, { ...at, button });
    if (button === 2) fireEvent.contextMenu(editor(), at);
  }

  it('lights the mark in blue with no outline or buttons, lights only its tool, and its menu’s Delete keeps the note', async () => {
    await pressMark('bends', 'bend', 2);
    expect(screen.getAllByTestId('bend').filter(isLit)).toHaveLength(1);
    expect(isLit(screen.getAllByTestId('bend')[0])).toBe(true);
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    // No trash can or pencil beside it (Jeremy, 2026-11-01): its actions are in the menu.
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(tool('Bend')).toHaveAttribute('aria-pressed', 'true');
    expect(tool('Quarter note')).toHaveAttribute('aria-pressed', 'false');
    const menu = screen.getByRole('menu', { name: 'Selected' });
    expect(within(menu).getAllByRole('menuitem').map(b => b.textContent)).toEqual(['Delete']);
    expect(screen.getAllByTestId('bend')).toHaveLength(6);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getAllByTestId('bend')).toHaveLength(5);
    // Nothing is left selected: nothing lit, no cursor, and the tab lets the keys go.
    expect(screen.getAllByTestId('bend').filter(isLit)).toHaveLength(0);
    await settle();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(editor()).not.toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\n7.3.4 7.3{b (0 4 0)}.4');
  });

  it('takes the mark away with the Delete key, and lets it go with Esc or an arrow', async () => {
    await pressMark('accents', 'staccato');
    const dots = screen.getAllByTestId('staccato').length;
    expect(tool('Staccato')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('staccato').filter(isLit)).toHaveLength(1);
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.getAllByTestId('staccato').filter(isLit)).toHaveLength(0);
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    expect(screen.getAllByTestId('staccato')).toHaveLength(dots);
    cleanup();
    await pressMark('accents', 'staccato');
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(screen.getAllByTestId('staccato')).toHaveLength(dots - 1);
    await settle();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(litFrets()).toHaveLength(0);
    undo();
    expect(screen.getAllByTestId('staccato')).toHaveLength(dots);
  });

  it('keeps a bend picked while the palette changes it', async () => {
    await pressMark('bends', 'bend');
    fireEvent.click(tool('Bend'));
    fireEvent.click(screen.getByRole('button', { name: '½' }));
    expect(isLit(screen.getAllByTestId('bend')[0])).toBe(true);
    expect(screen.getAllByTestId('bend')[0]).toHaveTextContent('½');
  });
});

describe('beams light with their notes (issue #276)', () => {
  it.each([['both', 'staff-beam', 'fill'], ['tab', 'tab-beam', 'stroke']])('in %s, a beam lights only once every note it joins is selected', async (parts, testId, paint) => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
    // Four eighths beamed together, then a half rest.
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n3.6.8 5.6.8 7.6.8 5.6.8 r.2 |')}`);
    await waitFor(() => expect(screen.getAllByTestId(testId).length).toBeGreaterThan(0), SLOW);
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    const beam = () => screen.getAllByTestId(testId)[0].getAttribute(paint);
    expect(beam()).not.toBe('var(--select)');
    // From the first eighth, three of the four: the beam stays as it is.
    for (let k = 0; k < 2; k++) fireEvent.keyDown(editor, { key: 'ArrowRight', shiftKey: true });
    expect(beam()).not.toBe('var(--select)');
    // The fourth: all its notes are selected, so it is too.
    fireEvent.keyDown(editor, { key: 'ArrowRight', shiftKey: true });
    expect(beam()).toBe('var(--select)');
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(beam()).not.toBe('var(--select)');
  });
});
