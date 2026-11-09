/**
 * The bar menu and the note menu (`docs/specs/2026-11-09-tab-delete-bars-menu-design.md`): a right-click beside
 * the notes opens the bar's (Insert ›, Delete bar), one on a note the note's.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY } from '@/features/tab/layout';
import { setUpPage, openWith, editor, keys, alphaTex, undo } from './helpers';

setUpPage();

const THREE = '0.6.1 |\n2.6.1 |\n3.6.1 |';
const read = (bars: string) => {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${bars}`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
/** Where bar `bar`'s first column is drawn on string `string` (0 the top), jsdom drawing the tab 800 wide at 0, 0. */
function spot(bars: string, bar: number, string: number) {
  const { systems } = layoutClip(read(bars), 800, 'tab');
  const system = systems.find(s => s.bars.some(b => b.index === bar))!;
  const drawn = system.bars.find(b => b.index === bar)!;
  return { clientX: drawn.columns[0].x, clientY: system.top + stringY(system.rows, string) };
}
/** A right-click there: the press, then the browser's contextmenu. */
function rightClick(at: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(screen.getByRole('img', { name: /drawn as/ }), { ...at, button: 2 });
  fireEvent.contextMenu(editor(), at);
}
const items = (name: string) => within(screen.getByRole('menu', { name })).getAllByRole('menuitem').map(i => i.textContent);
const choose = (name: string | RegExp) => fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name }));
/** Insert › and one of its items. */
const insert = (name: string) => {
  const item = within(screen.getByRole('menu', { name: 'Bar' })).getByRole('menuitem', { name: 'Insert' });
  fireEvent.mouseEnter(item.parentElement!);
  fireEvent.click(within(screen.getByRole('menu', { name: 'Insert' })).getByRole('menuitem', { name }));
};
/** A right-click beside bar `bar`'s note, on the top string. */
const besideNote = (bar: number) => rightClick(spot(THREE, bar, 0));

describe('the bar menu and the note menu', { timeout: 20000 }, () => {
  it('beside the notes: the bar menu, Insert › first, then Delete bar, then Insert paste', async () => {
    await openWith(THREE);
    besideNote(1);
    expect(items('Bar')).toEqual(['Insert›', 'Delete bar', 'Insert paste']);
    expect(screen.queryByRole('menuitem', { name: /Move to voice/ })).toBeNull();
  });

  it('on a note: the note menu, with no bar items', async () => {
    await openWith(THREE);
    rightClick(spot(THREE, 1, 5));
    const labels = items('Note');
    expect(labels).toContain('Move to voice›');
    expect(labels).toContain('Insert paste');
    expect(labels).not.toContain('Insert›');
    expect(labels.some(l => l?.startsWith('Delete'))).toBe(false);
  });

  it('Insert › Bar before and Bar after add a bar of rests round the pressed bar', async () => {
    await openWith(THREE);
    besideNote(1);
    insert('Bar before');
    expect(alphaTex()).toBe('0.6.1 |\nr.1 |\n2.6.1 |\n3.6.1 |');
    undo();
    besideNote(1);
    insert('Bar after');
    expect(alphaTex()).toBe('0.6.1 |\n2.6.1 |\nr.1 |\n3.6.1 |');
  });

  it('Delete bar takes away the pressed bar, and undo brings it back', async () => {
    await openWith(THREE);
    besideNote(1);
    choose('Delete bar');
    expect(alphaTex()).toBe('0.6.1 |\n3.6.1 |');
    undo();
    expect(alphaTex()).toBe(THREE);
  });

  it('beside the notes inside a selection: deletes every bar it touches, counted, and nothing stays selected', async () => {
    await openWith(THREE);
    // From bar 1's note into bar 2.
    keys({ key: 'ArrowRight', ctrlKey: true }, { key: 'ArrowRight', shiftKey: true });
    besideNote(2);
    choose('Delete 2 bars');
    expect(alphaTex()).toBe('0.6.1 |');
    fireEvent.contextMenu(editor());
    expect(items('Bar')).toContain('Delete bar');
  });

  it('in note input mode, a right-click beside the notes enters no note, and its bar menu acts on the bar pressed', async () => {
    await openWith(THREE);
    keys('n');
    expect(screen.getByRole('button', { name: 'Note input mode' })).toHaveAttribute('aria-pressed', 'true');
    besideNote(1);
    expect(items('Bar')).toContain('Delete bar');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(alphaTex()).toBe(THREE);
    besideNote(1);
    choose('Delete bar');
    expect(alphaTex()).toBe('0.6.1 |\n3.6.1 |');
  });

  it('Shift+F10: the note menu on a picked note, the bar menu on whole bars; deleting every bar leaves one bar of rests', async () => {
    await openWith(THREE);
    const note = spot(THREE, 1, 5);
    fireEvent.pointerDown(screen.getByRole('img', { name: /drawn as/ }), { ...note, button: 0 });
    fireEvent.pointerUp(screen.getByRole('img', { name: /drawn as/ }), { ...note, button: 0 });
    fireEvent.contextMenu(editor());
    expect(screen.getByRole('menu', { name: 'Note' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    keys({ key: 'a', ctrlKey: true });
    fireEvent.contextMenu(editor());
    choose('Delete 3 bars');
    expect(alphaTex()).toBe('r.1 |');
  });
});
