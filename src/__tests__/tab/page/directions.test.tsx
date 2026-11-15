/**
 * Directions on the Tab page (issue #496, `docs/specs/2026-11-15-tab-song-directions-design.md`): the Bars
 * palette's Direction button and the bar menu's Directions… open the bar's Direction panel; its toggles add
 * and take away; a drawn Direction is picked in blue, with Edit and Delete, a double-click and the Delete key.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY } from '@/features/tab/layout';
import { textBox } from '@/features/tab/layoutText';
import type { DirectionName } from '@/features/tab/directions';
import { setUpPage, openWith, editor, alphaTex, undo, isLit, settle, keys } from './helpers';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { NOT_A_DIRECTION } from '@/features/tab/WordField';
import { tool } from '../tool';

setUpPage();

const TWO = '0.6.1 |\n2.6.1 |';
const FORM = '\\jump segno 0.6.1 |\n\\jump dalsegnoalcoda 2.6.1 |';
const panel = () => screen.getByRole('dialog', { name: /^Directions in bar/ });
const drawn = () => screen.queryAllByTestId('direction').map(d => d.getAttribute('data-direction'));
const svg = () => screen.getByRole('img', { name: /drawn as/ });

/** Where a drawn Direction's middle is (jsdom draws the tab 800 wide at 0, 0). */
function spotOf(bars: string, bar: number, name: DirectionName) {
  const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${bars}`);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  const box = textBox(layoutClip(partOf(read.clip), 800, 'tab'), { kind: 'direction', bar, name })!;
  return { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
}
/** A press on a drawn Direction; `button` 2 is a right-click, which picks it and opens its menu. */
function press(bars: string, bar: number, name: DirectionName, button = 0) {
  const at = spotOf(bars, bar, name);
  fireEvent.pointerDown(svg(), { ...at, button });
  if (button === 2) fireEvent.contextMenu(editor(), at);
}

describe('Directions on the Tab page (issue #496)', { timeout: 20000 }, () => {
  it('opens the cursor\'s bar\'s panel from the Bars palette, whose toggles add and take away at once', async () => {
    await openWith(TWO);
    fireEvent.click(tool(/^Directions in this bar/));
    expect(panel()).toHaveAccessibleName('Directions in bar 1');
    const start = within(panel()).getByRole('group', { name: 'At the start of the bar' });
    const end = within(panel()).getByRole('group', { name: 'At the end of the bar' });
    expect(within(start).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Segno', 'Coda']);
    expect(within(end).getAllByRole('button').map(b => b.getAttribute('aria-label')))
      .toEqual(['Fine', 'To Coda', 'D.S.', 'D.S. al Coda', 'D.S. al Fine', 'D.C.', 'D.C. al Coda', 'D.C. al Fine']);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Segno' }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Fine' }));
    expect(within(panel()).getByRole('button', { name: 'Segno' })).toHaveAttribute('aria-pressed', 'true');
    expect(drawn()).toEqual(['segno', 'fine']);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Fine' }));
    expect(drawn()).toEqual(['segno']);
    // Esc closes it, and the keys go back to the tab.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /^Directions in bar/ })).toBeNull();
    expect(editor()).toHaveFocus();
    expect(alphaTex()).toBe('\\jump segno 0.6.1 |\n2.6.1 |');
    // Each toggle is an undo step.
    undo();
    expect(drawn()).toEqual(['segno', 'fine']);
  });

  it('lights the Direction button while the cursor\'s bar has one', async () => {
    await openWith(FORM);
    expect(tool(/^Directions in this bar/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the panel from the bar menu\'s Directions…', async () => {
    await openWith(TWO);
    const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${TWO}`);
    if (!read.ok) throw new Error();
    const { systems } = layoutClip(partOf(read.clip), 800, 'tab');
    const bar = systems[0].bars[1];
    const at = { clientX: bar.columns[0].x, clientY: systems[0].top + stringY(systems[0].rows, 0) };
    fireEvent.pointerDown(svg(), { ...at, button: 2 });
    fireEvent.contextMenu(editor(), at);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Bar' })).getByRole('menuitem', { name: 'Directions…' }));
    expect(panel()).toHaveAccessibleName('Directions in bar 2');
  });

  it('picks a drawn one in blue, alone; its menu has Edit and Delete', async () => {
    await openWith(FORM);
    press(FORM, 1, 'dalsegnoalcoda', 2);
    const [segno, ds] = screen.getAllByTestId('direction');
    expect(isLit(ds)).toBe(true);
    expect(isLit(segno)).toBe(false);
    expect(tool(/^Directions in this bar/)).toHaveAttribute('aria-pressed', 'true');
    const menu = screen.getByRole('menu', { name: 'Selected' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Edit', 'Delete']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    expect(panel()).toHaveAccessibleName('Directions in bar 2');
    expect(within(panel()).getByRole('button', { name: 'D.S. al Coda' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('takes a picked one away with the menu\'s Delete or the Delete key, leaving nothing picked', async () => {
    await openWith(FORM);
    press(FORM, 1, 'dalsegnoalcoda', 2);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selected' })).getByRole('menuitem', { name: 'Delete' }));
    expect(drawn()).toEqual(['segno']);
    expect(screen.getAllByTestId('direction').filter(isLit)).toHaveLength(0);
    undo();
    await settle();
    act(() => editor().focus());
    press(FORM, 0, 'segno');
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(drawn()).toEqual(['dalsegnoalcoda']);
  });

  it('opens its bar\'s panel on a double-click', async () => {
    await openWith(FORM);
    press(FORM, 0, 'segno');
    fireEvent.doubleClick(svg(), spotOf(FORM, 0, 'segno'));
    expect(panel()).toHaveAccessibleName('Directions in bar 1');
  });

  describe('the direction popover (Shift+R)', () => {
    const field = () => screen.getByRole('combobox', { name: 'Direction' }) as HTMLInputElement;
    const closed = () => screen.queryByRole('combobox', { name: 'Direction' }) === null;
    const typeIn = (text: string) => fireEvent.change(field(), { target: { value: text } });
    const options = () => {
      const list = screen.queryByRole('listbox', { name: 'Directions' });
      return list ? within(list).queryAllByRole('option').map(o => o.textContent) : [];
    };
    const open = () => {
      act(() => editor().focus());
      keys({ key: 'R', shiftKey: true });
    };

    it('adds what is typed to the cursor\'s bar on Enter, as one undo step, and closes', async () => {
      await openWith(TWO);
      keys({ key: 'ArrowRight' });
      open();
      expect(field()).toHaveAttribute('placeholder', 'segno, ds al coda, fine…');
      typeIn('D.S. al Coda');
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(closed()).toBe(true);
      expect(editor()).toHaveFocus();
      expect(alphaTex()).toBe('0.6.1 |\n\\jump dalsegnoalcoda 2.6.1 |');
      undo();
      expect(alphaTex()).toBe(TWO);
    });

    it('lists the matches as you type, the one named exactly first, with where in the bar each goes', async () => {
      await openWith(TWO);
      open();
      typeIn('ds');
      expect(options().slice(0, 4)).toEqual(['D.S.Bar end', 'D.S. al CodaBar end', 'D.S. al FineBar end', 'D.S. al Double CodaBar end']);
      typeIn('to coda');
      expect(options()[0]).toBe('To CodaBar end');
      typeIn('sign');
      expect(options()[0]).toBe('SegnoBar start');
      // A press in the list adds that one.
      fireEvent.click(within(screen.getByRole('listbox', { name: 'Directions' })).getAllByRole('option')[0]);
      expect(alphaTex()).toBe('\\jump segno 0.6.1 |\n2.6.1 |');
    });

    it('only adds: one the bar has stays, and a word naming none shows the ⚠ and keeps it open', async () => {
      await openWith(FORM);
      open();
      typeIn('segno');
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(alphaTex()).toBe(FORM);
      open();
      typeIn('bridge');
      expect(options()).toEqual([]);
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(screen.getByRole('img', { name: NOT_A_DIRECTION })).toBeInTheDocument();
      // Esc closes the list, then the popover.
      fireEvent.keyDown(field(), { key: 'Escape' });
      fireEvent.keyDown(field(), { key: 'Escape' });
      expect(closed()).toBe(true);
      expect(alphaTex()).toBe(FORM);
    });

    it('opens on an empty bar too, and is in the ? list', async () => {
      await openWith('r.1 |');
      open();
      typeIn('fine');
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(alphaTex()).toBe('\\jump fine r.1 |');
      const listed = TAB_SHORTCUTS.flatMap(g => g.shortcuts.flatMap(s => s.keys));
      expect(listed).toContain('Shift+R');
    });
  });
});
