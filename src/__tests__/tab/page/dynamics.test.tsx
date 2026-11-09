/**
 * Dynamics on the page (issue #437, `docs/specs/2026-11-09-tab-dynamics-design.md`): Shift+D and the
 * Dynamic tool open the field, what isn't a dynamic gets a ⚠, a drawn dynamic is picked, edited and deleted.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip } from '@/features/tab/layout';
import { markBoxes } from '@/features/tab/marks';
import { NOT_A_DYNAMIC } from '@/features/tab/WordField';
import { DYNAMICS } from '@/features/tab/clip';
import { setUpPage, openWith, keys, alphaTex, editor, isLit, renderAt } from './helpers';
import { tool } from '../tool';

setUpPage();

const DYNAMIC_TOOL = /^Dynamic from this column on/;
const field = () => screen.getByRole('combobox', { name: 'Dynamic' });
const queryField = () => screen.queryByRole('combobox', { name: 'Dynamic' });
const type = (value: string) => {
  fireEvent.change(field(), { target: { value } });
  fireEvent.keyDown(field(), { key: 'Enter' });
};

describe('entering a dynamic', { timeout: 20000 }, () => {
  it('Shift+D opens the field at the cursor; pp and Enter sets it and lights the tool', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    expect(field()).toHaveValue('');
    type('pp');
    expect(queryField()).toBeNull();
    expect(screen.getByTestId('dynamic')).toHaveAttribute('data-dynamic', 'pp');
    expect(tool(DYNAMIC_TOOL)).toHaveAttribute('aria-pressed', 'true');
    expect(alphaTex()).toBe('5.3.4{dy pp} 5.3.4 5.3.2 |');
  });

  it('Shift+D on a new arrangement\'s empty bar puts the dynamic on the first of its rests', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    keys({ key: 'D', shiftKey: true });
    type('p');
    expect(screen.getByTestId('dynamic')).toHaveAttribute('data-dynamic', 'p');
    expect(alphaTex()).toBe('r.1{dy p} |');
  });

  it('the Dynamic tool opens the same field, holding the column\'s dynamic; any case is kept lowercase', async () => {
    await openWith('5.3.4{dy mf} 5.3.4 5.3.2 |');
    fireEvent.click(tool(DYNAMIC_TOOL));
    expect(field()).toHaveValue('mf');
    type(' SFZ ');
    expect(alphaTex()).toBe('5.3.4{dy sfz} 5.3.4 5.3.2 |');
  });

  it('keeps the field open with a ⚠ for what isn\'t a dynamic, and changes nothing', async () => {
    await openWith('5.3.4{dy mf} 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    type('xx');
    expect(field()).toBeInTheDocument();
    expect(screen.getByRole('img', { name: NOT_A_DYNAMIC })).toHaveTextContent('⚠');
    // Typing again takes the ⚠ away until the next Enter.
    fireEvent.change(field(), { target: { value: 'x' } });
    expect(screen.queryByRole('img', { name: NOT_A_DYNAMIC })).toBeNull();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(queryField()).toBeNull();
    expect(alphaTex()).toBe('5.3.4{dy mf} 5.3.4 5.3.2 |');
  });

  it('leaving the field with what isn\'t a dynamic changes nothing; an empty field takes it away', async () => {
    await openWith('5.3.4{dy mf} 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    fireEvent.change(field(), { target: { value: 'loud' } });
    fireEvent.blur(field());
    expect(alphaTex()).toBe('5.3.4{dy mf} 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    type('');
    expect(screen.queryByTestId('dynamic')).toBeNull();
    expect(alphaTex()).toBe('5.3.4 5.3.4 5.3.2 |');
  });
});

describe('what the field changes stays lit', { timeout: 20000 }, () => {
  it('keeps the cursor\'s column lit while the field is open, and lets go of it when the field is left', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys('ArrowRight', { key: 'D', shiftKey: true });
    expect(field()).toHaveFocus();
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    // Leaving the field for somewhere off the tab leaves the tab, as a press away does.
    act(() => screen.getByRole('button', { name: 'Note input mode' }).focus());
    await waitFor(() => expect(screen.queryByTestId('tab-cursor')).toBeNull());
  });

  it('after Enter the cursor is back on the tab, on the same column', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys('ArrowRight', { key: 'D', shiftKey: true });
    type('p');
    expect(editor()).toHaveFocus();
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    expect(alphaTex()).toBe('5.3.4 5.3.4{dy p} 5.3.2 |');
  });
});

describe('the list of dynamics', { timeout: 20000 }, () => {
  const list = () => within(screen.getByRole('listbox', { name: 'Dynamics' }));
  const options = () => list().queryAllByRole('option').map(o => o.getAttribute('data-dynamic'));
  const down = (key = 'ArrowDown') => fireEvent.keyDown(field(), { key });

  it('the Down arrow key lists every dynamic when nothing is typed, alphabetically', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    expect(screen.queryByRole('listbox')).toBeNull();
    down();
    expect(options()).toEqual([...DYNAMICS].sort());
    expect(options().slice(0, 3)).toEqual(['f', 'ff', 'fff']);
    expect(field()).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists only those starting with what is typed, shorter first, and follows the typing', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    fireEvent.change(field(), { target: { value: 'p' } });
    down();
    expect(options()).toEqual(['p', 'pf', 'pp', 'ppp', 'pppp', 'ppppp', 'pppppp']);
    fireEvent.change(field(), { target: { value: 'sf' } });
    expect(options()).toEqual(['sf', 'sffz', 'sfp', 'sfpp', 'sfz', 'sfzp']);
    fireEvent.change(field(), { target: { value: 'SFZ' } });
    expect(options()).toEqual(['sfz', 'sfzp']);
    fireEvent.change(field(), { target: { value: 'x' } });
    expect(options()).toHaveLength(0);
    expect(screen.getByRole('listbox')).toHaveTextContent('No dynamic starts with “x”');
  });

  it('↓ and ↑ move through the list, and Enter sets the one picked', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    fireEvent.change(field(), { target: { value: 'm' } });
    down();
    const picked = () => list().getByRole('option', { selected: true }).getAttribute('data-dynamic');
    expect(picked()).toBe('mf');
    down();
    expect(picked()).toBe('mp');
    // Not past the end, nor before the start.
    down();
    expect(picked()).toBe('mp');
    down('ArrowUp');
    down('ArrowUp');
    expect(picked()).toBe('mf');
    down();
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(queryField()).toBeNull();
    expect(alphaTex()).toBe('5.3.4{dy mp} 5.3.4 5.3.2 |');
  });

  it('starts on the dynamic typed exactly, so pp and Enter sets pp, not pppppp', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    down();
    fireEvent.change(field(), { target: { value: 'pp' } });
    expect(list().getByRole('option', { selected: true })).toHaveAttribute('data-dynamic', 'pp');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(alphaTex()).toBe('5.3.4{dy pp} 5.3.4 5.3.2 |');
  });

  it('a press on a dynamic in the list sets it', async () => {
    await openWith('5.3.4 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    down();
    fireEvent.click(list().getByRole('option', { name: 'fff' }));
    expect(alphaTex()).toBe('5.3.4{dy fff} 5.3.4 5.3.2 |');
  });

  it('Esc closes the list first, then the field, changing nothing', async () => {
    await openWith('5.3.4{dy p} 5.3.4 5.3.2 |');
    keys({ key: 'D', shiftKey: true });
    down();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field()).toBeInTheDocument();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(queryField()).toBeNull();
    expect(alphaTex()).toBe('5.3.4{dy p} 5.3.4 5.3.2 |');
  });
});

describe('a drawn dynamic', { timeout: 20000 }, () => {
  const bar = '5.3.4 5.3.4{dy mf} 5.3.2 |';
  /** Opens `bar` and presses its dynamic (`button` 2 is a right-click, which opens its menu; `twice` a double-click). */
  async function pressDynamic(button = 0, twice = false) {
    await openWith(bar);
    const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${bar}`);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const box = markBoxes(layoutClip(partOf(read.clip), 800, 'tab')).find(m => m.hit.mark === 'dynamic')!.box;
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    const drawing = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerDown(drawing, { ...at, button });
    if (button === 2) fireEvent.contextMenu(editor(), at);
    if (twice) {
      fireEvent.pointerDown(drawing, { ...at, button });
      fireEvent.doubleClick(drawing, at);
    }
  }

  it('a press picks it: drawn blue, the Dynamic tool lit; Delete takes it away and keeps the note', async () => {
    await pressDynamic();
    expect(isLit(screen.getByTestId('dynamic'))).toBe(true);
    expect(tool(DYNAMIC_TOOL)).toHaveAttribute('aria-pressed', 'true');
    keys('Delete');
    expect(screen.queryByTestId('dynamic')).toBeNull();
    expect(alphaTex()).toBe('5.3.4 5.3.4 5.3.2 |');
  });

  it('Enter on a picked dynamic opens its field, as a double-click does, and it stays picked while the field is open', async () => {
    await pressDynamic();
    keys('Enter');
    expect(field()).toHaveValue('mf');
    expect(isLit(screen.getByTestId('dynamic'))).toBe(true);
    type('f');
    expect(alphaTex()).toBe('5.3.4 5.3.4{dy f} 5.3.2 |');
  });

  it('a double-click opens its field, and leaves note input mode off', async () => {
    await pressDynamic(0, true);
    expect(field()).toHaveValue('mf');
    expect(screen.getByRole('button', { name: 'Note input mode' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('its right-click menu has Edit and Delete', async () => {
    await pressDynamic(2);
    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    act(() => fireEvent.click(edit));
    expect(field()).toHaveValue('mf');
  });

  it('stays on the rest when its note is deleted', async () => {
    await openWith(bar);
    keys('ArrowRight', 'Delete');
    expect(screen.getByTestId('dynamic')).toHaveAttribute('data-dynamic', 'mf');
    expect(alphaTex()).toBe('5.3.4 r.4{dy mf} 5.3.2 |');
  });
});
