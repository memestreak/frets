/**
 * The chord popover on the page (issue #342, `docs/specs/2026-11-10-tab-chord-popover-design.md`):
 * Shift+Q opens it, Space / Shift+Space / Tab / Shift+Tab set the name and move it on, Alt+Space types a
 * space, Esc leaves the spot as it was, and an empty bar takes a name on its first rest.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { setUpPage, editor, keys, alphaTex, openWith, undo } from './helpers';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';

setUpPage();

const field = () => screen.getByRole('textbox', { name: 'Chord name' }) as HTMLInputElement;
const type = (text: string, key: { key: string; shiftKey?: boolean }) => {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.keyDown(field(), key);
};

describe('the chord popover', () => {
  it('types a run of chord names with Space, and closes on Enter', async () => {
    await openWith('5.1.2 7.1.2 |\n3.2.1 |');
    act(() => editor().focus());
    keys({ key: 'Q', shiftKey: true });
    type('Am', { key: ' ' });
    // Still open, on the next column, holding what that column has (nothing).
    expect(field()).toHaveValue('');
    type('C', { key: ' ' });
    type('G7', { key: 'Enter' });
    expect(screen.queryByRole('textbox', { name: 'Chord name' })).toBeNull();
    expect(alphaTex()).toBe('5.1.2{ch "Am"} 7.1.2{ch "C"} |\n3.2.1{ch "G7"} |');
    // Each name is its own undo step.
    undo();
    expect(alphaTex()).toBe('5.1.2{ch "Am"} 7.1.2{ch "C"} |\n3.2.1 |');
  }, 20000);

  it('goes back on Shift+Space, bar to bar on Tab and Shift+Tab, and stays put at the end', async () => {
    await openWith('5.1.2 7.1.2 |\n3.2.1 |');
    act(() => editor().focus());
    keys({ key: 'Q', shiftKey: true });
    type('Am', { key: 'Tab' });
    type('E', { key: 'Tab' });
    // Past the last bar it stays on the same column, still open.
    expect(field()).toHaveValue('E');
    type('E7', { key: 'Tab', shiftKey: true });
    expect(field()).toHaveValue('Am');
    fireEvent.keyDown(field(), { key: ' ' });
    type('Dm', { key: ' ', shiftKey: true });
    expect(field()).toHaveValue('Am');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(alphaTex()).toBe('5.1.2{ch "Am"} 7.1.2{ch "Dm"} |\n3.2.1{ch "E7"} |');
  }, 20000);

  it('types a space with Alt+Space, and Esc leaves the column as it was', async () => {
    await openWith('5.1.2{ch "C"} 7.1.2 |');
    act(() => editor().focus());
    keys({ key: 'Q', shiftKey: true });
    expect(field()).toHaveValue('C');
    fireEvent.change(field(), { target: { value: 'NC' } });
    field().setSelectionRange(1, 1);
    fireEvent.keyDown(field(), { key: ' ', altKey: true });
    expect(field()).toHaveValue('N C');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(alphaTex()).toBe('5.1.2{ch "C"} 7.1.2 |');
  }, 20000);

  it('names an empty bar on the first of the rests that fill it, and moves over it without filling it', async () => {
    await openWith('5.1.1 |\n|\n3.2.1 |');
    act(() => editor().focus());
    keys({ key: 'Q', shiftKey: true });
    fireEvent.keyDown(field(), { key: ' ' });
    // On the empty bar: passing over it leaves it empty.
    fireEvent.keyDown(field(), { key: ' ' });
    type('G', { key: ' ', shiftKey: true });
    type('D', { key: 'Enter' });
    expect(alphaTex()).toBe('5.1.1 |\nr.1{ch "D"} |\n3.2.1{ch "G"} |');
  }, 20000);
});

it('the ? overlay lists Shift+Q and the field’s keys, and C no longer opens the field', async () => {
  const all = TAB_SHORTCUTS.flatMap(g => g.shortcuts.map(s => `${g.title}: ${s.keys.join(' ')}`));
  expect(all.some(s => s.startsWith('Palette') && s.endsWith('Shift+Q'))).toBe(true);
  expect(all.some(s => s.startsWith('In the Chord name field') && s.endsWith('Shift+Tab'))).toBe(true);
  await openWith('5.1.1 |');
  keys('c');
  expect(screen.queryByRole('textbox', { name: 'Chord name' })).toBeNull();
}, 20000);
