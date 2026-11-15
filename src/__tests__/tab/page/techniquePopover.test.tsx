/**
 * The technique popover on the page (issue #501, `docs/specs/2026-11-15-tab-technique-popover-design.md`):
 * Shift+P opens it, a name or short form typed lists the matching techniques, Enter adds the lit one as its
 * palette button would, and it only ever adds.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { setUpPage, editor, keys, alphaTex, openWith, undo } from './helpers';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { NOT_A_TECHNIQUE } from '@/features/tab/WordField';
import { TECHNIQUES } from '@/features/tab/techniques';

setUpPage();

const field = () => screen.getByRole('combobox', { name: 'Technique' }) as HTMLInputElement;
const closed = () => screen.queryByRole('combobox', { name: 'Technique' }) === null;
const typeIn = (text: string) => fireEvent.change(field(), { target: { value: text } });
const press = (key: string) => fireEvent.keyDown(field(), { key });
const options = () => {
  const list = screen.queryByRole('listbox', { name: 'Techniques' });
  return list ? within(list).queryAllByRole('option').map(o => o.textContent) : [];
};

/** Opens the popover on the clip's first column, its top note picked, and adds what `typed` names with Enter. */
async function add(tex: string, typed: string) {
  await openWith(tex);
  act(() => editor().focus());
  keys({ key: 'P', shiftKey: true });
  typeIn(typed);
  press('Enter');
}

describe('the technique popover', () => {
  it('adds let ring by its short form, as one undo step, and closes', async () => {
    await add('5.1.2 7.1.2 |', 'lr');
    expect(closed()).toBe(true);
    expect(alphaTex()).toBe('5.1{lr}.2 7.1.2 |');
    undo();
    expect(alphaTex()).toBe('5.1.2 7.1.2 |');
  }, 20000);

  it('takes the full name in any case, and dots and hyphens or not', async () => {
    await add('5.1.2 7.1.2 |', 'P.M.');
    expect(alphaTex()).toBe('5.1{pm}.2 7.1.2 |');
  }, 20000);

  it('lists the matches as you type, with their palette group, and Enter adds the first', async () => {
    await openWith('5.1.2 7.1.2 |');
    act(() => editor().focus());
    keys({ key: 'ArrowRight' });
    keys({ key: 'P', shiftKey: true });
    expect(field()).toHaveAttribute('placeholder', 'let ring, pm, vib…');
    expect(options()).toEqual([]);
    typeIn('ring');
    expect(options()).toEqual(['Let ringTechniques']);
    typeIn('slide');
    // The one named exactly first, then those with a word starting with it.
    expect(options()[0]).toBe('SlideJoins');
    expect(options().length).toBeGreaterThan(1);
    press('Enter');
    // A slide from the 5 to the 7, as the Slide button draws it.
    expect(alphaTex()).toBe('5.1{sl}.2 7.1.2 |');
  }, 20000);

  it('shows every technique on Down with nothing typed; Down and Up light, Enter adds the lit one', async () => {
    await openWith('5.1.2 7.1.2 |');
    act(() => editor().focus());
    keys({ key: 'P', shiftKey: true });
    press('ArrowDown');
    expect(options()).toHaveLength(TECHNIQUES.length);
    typeIn('harm');
    expect(options()).toEqual(['Natural harmonicTechniques', 'Pinch harmonicTechniques']);
    press('ArrowDown');
    press('ArrowDown');
    press('ArrowUp');
    press('ArrowDown');
    press('Enter');
    expect(alphaTex()).toBe('5.1{ph}.2 7.1.2 |');
  }, 20000);

  it('only adds: a mark the note has is left', async () => {
    await add('5.1{lr}.2 7.1.2 |', 'let ring');
    expect(alphaTex()).toBe('5.1{lr}.2 7.1.2 |');
  }, 20000);

  it('only adds: vibrato is left on vibrato', async () => {
    await add('5.1{v}.2 7.1.2 |', 'vib');
    expect(alphaTex()).toBe('5.1{v}.2 7.1.2 |');
  }, 20000);

  it('only adds: a kind replaces the other kind', async () => {
    await add('5.1{v}.2 7.1.2 |', 'wide vib');
    expect(alphaTex()).toBe('5.1{vw}.2 7.1.2 |');
  }, 20000);

  it('adds a full bend', async () => {
    await add('5.1.2 7.1.2 |', 'bend');
    expect(alphaTex()).toBe('5.1{b (0 4)}.2 7.1.2 |');
  }, 20000);

  it('puts a let ring line over the whole selection', async () => {
    await openWith('5.1.2 7.1.2 8.1.2 |');
    act(() => editor().focus());
    keys({ key: 'ArrowRight', shiftKey: true });
    keys({ key: 'P', shiftKey: true });
    typeIn('lr');
    press('Enter');
    expect(alphaTex()).toBe('5.1{lr}.2 7.1{lr}.2 8.1.2 |');
  }, 20000);

  it('keeps itself open with the small red ⚠ for a word it doesn’t know; Esc closes the list, then the popover', async () => {
    await openWith('5.1.2 7.1.2 |');
    act(() => editor().focus());
    keys({ key: 'P', shiftKey: true });
    typeIn('fog machine');
    press('Escape');
    expect(closed()).toBe(false);
    press('Enter');
    expect(screen.getByRole('img', { name: NOT_A_TECHNIQUE })).toBeInTheDocument();
    expect(closed()).toBe(false);
    press('Escape');
    expect(closed()).toBe(true);
    expect(alphaTex()).toBe('5.1.2 7.1.2 |');
  }, 20000);

  it('adds nothing when left by a press elsewhere, or on Enter with nothing typed', async () => {
    await openWith('5.1.2 7.1.2 |');
    act(() => editor().focus());
    keys({ key: 'P', shiftKey: true });
    typeIn('lr');
    fireEvent.blur(field());
    expect(closed()).toBe(true);
    act(() => editor().focus());
    keys({ key: 'P', shiftKey: true });
    press('Enter');
    expect(closed()).toBe(true);
    expect(alphaTex()).toBe('5.1.2 7.1.2 |');
  }, 20000);

  it('doesn’t open on an empty bar: a technique goes on notes', async () => {
    await openWith('|');
    act(() => editor().focus());
    keys({ key: 'P', shiftKey: true });
    expect(closed()).toBe(true);
  }, 20000);
});

it('the ? overlay lists Shift+P and the Technique popover’s keys', () => {
  const all = TAB_SHORTCUTS.flatMap(g => g.shortcuts.map(s => `${g.title}: ${s.keys.join(' ')}`));
  expect(all.some(s => s.startsWith('Selected notes and rests') && s.endsWith('Shift+P'))).toBe(true);
  expect(all.some(s => s.startsWith('In the Technique popover (Shift+P)') && s.endsWith('Enter'))).toBe(true);
});
