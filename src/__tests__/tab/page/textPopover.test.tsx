/**
 * The Text popover on the page (issue #342, `docs/specs/2026-11-14-tab-text-popover-design.md`):
 * Shift+X opens it, Tab / Shift+Tab set the Text and move it a column on or back, Space types a space,
 * Esc leaves the column as it was, and an empty bar takes a Text on its first rest.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { setUpPage, editor, keys, alphaTex, openWith, undo } from './helpers';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';

setUpPage();

const field = () => screen.getByRole('textbox', { name: 'Text over the column' }) as HTMLTextAreaElement;
const type = (text: string, key: { key: string; shiftKey?: boolean }) => {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.keyDown(field(), key);
};

describe('the Text popover', () => {
  it('types a run of Texts with Tab, across a bar line, and closes on Enter', async () => {
    await openWith('5.1.2 7.1.2 |\n3.2.1 |');
    act(() => editor().focus());
    keys({ key: 'X', shiftKey: true });
    // Space is a space in a Text: it doesn't move on.
    type('let ring', { key: ' ' });
    expect(field()).toHaveValue('let ring');
    type('let ring', { key: 'Tab' });
    // Still open, on the next column, holding what that column has (nothing).
    expect(field()).toHaveValue('');
    type('P.M.', { key: 'Tab' });
    type('fade', { key: 'Enter' });
    expect(screen.queryByRole('textbox', { name: 'Text over the column' })).toBeNull();
    expect(alphaTex()).toBe('5.1.2{txt "let ring"} 7.1.2{txt "P.M."} |\n3.2.1{txt "fade"} |');
    // Each Text is its own undo step.
    undo();
    expect(alphaTex()).toBe('5.1.2{txt "let ring"} 7.1.2{txt "P.M."} |\n3.2.1 |');
  }, 20000);

  it('goes back on Shift+Tab, stays put past the end, and Esc leaves the column as it was', async () => {
    await openWith('5.1.2 7.1.2{txt "old"} |');
    act(() => editor().focus());
    keys({ key: 'X', shiftKey: true });
    type('one', { key: 'Tab' });
    expect(field()).toHaveValue('old');
    type('two', { key: 'Tab' });
    // Past the last column it stays on the same one, still open, with what was just set.
    expect(field()).toHaveValue('two');
    type('three', { key: 'Tab', shiftKey: true });
    expect(field()).toHaveValue('one');
    type('changed', { key: 'Escape' });
    expect(alphaTex()).toBe('5.1.2{txt "one"} 7.1.2{txt "three"} |');
  }, 20000);

  it('keeps Shift+Enter a new line and Tab still moves on from a two-line Text', async () => {
    await openWith('5.1.2 7.1.2 |');
    act(() => editor().focus());
    keys({ key: 'X', shiftKey: true });
    fireEvent.change(field(), { target: { value: 'one' } });
    fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
    type('one\ntwo', { key: 'Tab' });
    expect(field()).toHaveValue('');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(alphaTex()).toBe('5.1.2{txt "one\\ntwo"} 7.1.2 |');
  }, 20000);

  it('sets a Text on an empty bar on the first of the rests that fill it, and moves over it without filling it', async () => {
    await openWith('5.1.1 |\n|\n3.2.1 |');
    act(() => editor().focus());
    keys({ key: 'X', shiftKey: true });
    fireEvent.keyDown(field(), { key: 'Tab' });
    // On the empty bar: passing over it leaves it empty.
    fireEvent.keyDown(field(), { key: 'Tab' });
    type('end', { key: 'Tab', shiftKey: true });
    type('Chorus riff', { key: 'Enter' });
    expect(alphaTex()).toBe('5.1.1 |\nr.1{txt "Chorus riff"} |\n3.2.1{txt "end"} |');
  }, 20000);

  it('opens on a new arrangement’s empty bar', async () => {
    await openWith('|');
    act(() => editor().focus());
    keys({ key: 'X', shiftKey: true });
    type('Intro', { key: 'Enter' });
    expect(alphaTex()).toBe('r.1{txt "Intro"} |');
  }, 20000);
});

it('the ? overlay lists Shift+X and the Text field’s Tab keys', () => {
  const all = TAB_SHORTCUTS.flatMap(g => g.shortcuts.map(s => `${g.title}: ${s.keys.join(' ')}`));
  expect(all.some(s => s.startsWith('Palette') && s.endsWith('Shift+X'))).toBe(true);
  expect(all.some(s => s.startsWith('In the Text field (Shift+X)') && s.endsWith('Shift+Tab'))).toBe(true);
});
