/*
 * The Lyrics field on the page (issue #408, `docs/specs/2026-11-09-tab-lyrics-design.md`): Shift+L opens it on a
 * note, its keys set a syllable and move on, and a drawn syllable is picked, edited and deleted. What the
 * syllables do to the clip is in `../lyrics.test.tsx`.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { setUpPage, editor, keys, alphaTex, openWith, undo } from './helpers';
import { tool } from '../tool';

setUpPage();

const field = () => screen.queryByRole('textbox', { name: /^Lyric line/ }) as HTMLInputElement | null;
/** Types `text` into the field, then presses `key` in it. */
function type(text: string, key: string | { key: string; shiftKey?: boolean; altKey?: boolean } = 'Enter') {
  fireEvent.change(field()!, { target: { value: text } });
  fireEvent.keyDown(field()!, typeof key === 'string' ? { key } : key);
}
const shiftL = () => keys({ key: 'L', shiftKey: true });

/** A press on the drawn syllable `hit` of the 4/4 clip of `bar` (jsdom draws the tab 800 wide at 0, 0). */
function pressLyric(bar: string, hit: WordHit, twice = false) {
  const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${bar}`);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  const box = textBox(layoutClip(partOf(read.clip), 800, 'tab'), hit, null)!;
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  const svg = screen.getByRole('img', { name: /drawn as/ });
  fireEvent.pointerDown(svg, at);
  fireEvent.pointerUp(svg, at);
  if (twice) fireEvent.doubleClick(svg, at);
}

describe('typing Lyrics with Shift+L', () => {
  it('Hel, a hyphen, lo, Space, world, Enter: one syllable a note, the first joined, then the field closes', async () => {
    await openWith('0.6.4 2.5.4 3.5.4 r.4 |');
    shiftL();
    expect(field()).not.toBeNull();
    type('Hel', '-');
    type('lo', ' ');
    type('world');
    expect(field()).toBeNull();
    expect(alphaTex()).toBe('0.6.4{lyrics "Hel-"} 2.5.4{lyrics "lo"} 3.5.4{lyrics "world"} r.4 |');
  }, 20000);

  it('Shift+Space goes back a note; Down types on Lyric line 2; Esc leaves the syllable as it was', async () => {
    await openWith('0.6.4{lyrics "a"} 2.5.4 3.5.2 |');
    keys('ArrowRight');
    shiftL();
    type('b', { key: ' ', shiftKey: true });
    expect(field()!.value).toBe('a');
    type('a', 'ArrowDown');
    expect(screen.getByRole('textbox', { name: 'Lyric line 2' })).toBeTruthy();
    type('two');
    shiftL();
    type('zzz', 'Escape');
    expect(alphaTex()).toBe('0.6.4{lyrics 0 "a" lyrics 1 "two"} 2.5.4{lyrics "b"} 3.5.2 |');
  }, 20000);

  it('Alt+Space types a space in the syllable without moving on; Option+Space\'s no-break space is a space too', async () => {
    await openWith('0.6.4 2.5.4 3.5.2 |');
    shiftL();
    type('a', { key: ' ', altKey: true });
    expect(field()!.value).toBe('a ');
    type('a ver', ' ');
    type('y\u00a0oh');
    expect(alphaTex()).toBe('0.6.4{lyrics "a ver"} 2.5.4{lyrics "y oh"} 3.5.2 |');
  }, 20000);

  it('Alt+hyphen types a hyphen without moving on (Option+hyphen\'s dash too)', async () => {
    await openWith('0.6.4 2.5.4 3.5.2 |');
    shiftL();
    type('x', { key: '-', altKey: true });
    expect(field()!.value).toBe('x-');
    type('x', { key: '–', altKey: true });
    expect(field()!.value).toBe('x-');
    // At the caret, not the end, and the caret goes after it.
    fireEvent.change(field()!, { target: { value: 'xy' } });
    field()!.setSelectionRange(1, 1);
    fireEvent.keyDown(field()!, { key: '-', altKey: true });
    expect(field()!.value).toBe('x-y');
    expect(field()!.selectionStart).toBe(2);
    type('x-y');
    expect(alphaTex()).toBe('0.6.4{lyrics "x-y"} 2.5.4 3.5.2 |');
  }, 20000);

  it('opens small, its Lyric line\'s number in front; dragged by its grip it keeps that place note to note, and opens over the note again next time', async () => {
    await openWith('0.6.4 2.5.4 3.5.2 |');
    shiftL();
    const box = () => screen.getByRole('dialog', { name: 'Lyrics' });
    expect(box().textContent).toContain('1');
    const at = { left: box().style.left, top: box().style.top };
    const grip = box().querySelector('.tab-lyric-grip')!;
    fireEvent.pointerDown(grip, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 40, clientY: -20, pointerId: 1 });
    fireEvent.pointerUp(grip, { clientX: 40, clientY: -20, pointerId: 1 });
    expect(parseFloat(box().style.top)).toBe(parseFloat(at.top) - 30);
    type('a', ' ');
    expect(parseFloat(box().style.top)).toBe(parseFloat(at.top) - 30);
    type('b');
    shiftL();
    expect(parseFloat(box().style.top)).toBe(parseFloat(at.top));
  }, 20000);

  it('draws the field\'s note as selected and draws the syllable just typed in the typing colour while it is open; plain once it closes', async () => {
    await openWith('0.6.4 2.5.4 3.5.2 |');
    shiftL();
    type('Hel', '-');
    const hel = () => screen.getAllByTestId('lyric').find(t => t.textContent === 'Hel')!;
    expect(hel().getAttribute('fill')).toBe('var(--typing)');
    // The field's note, the second (fret 2), is drawn as selected, in the selection blue.
    const blue = () => [...document.querySelectorAll('svg text')].filter(t => t.getAttribute('fill') === 'var(--select)').map(t => t.textContent);
    expect(blue()).toEqual(['2']);
    type('lo');
    expect(hel().getAttribute('fill')).toBe('var(--ink)');
    expect(blue()).toEqual([]);
  }, 20000);

  it('on notes with syllables: nothing orange on opening, then only the one just set, not the next note\'s own', async () => {
    await openWith('0.6.4{lyrics "a"} 2.5.4{lyrics "b"} 3.5.2 |');
    shiftL();
    const orange = () => screen.getAllByTestId('lyric').filter(t => t.getAttribute('fill') === 'var(--typing)').map(t => t.textContent);
    expect(orange()).toEqual([]);
    type('a', ' ');
    expect(orange()).toEqual(['a']);
  }, 20000);

  it('on a rest it opens on the next note; each syllable is one undo step', async () => {
    await openWith('r.4 2.5.4 3.5.2 |');
    shiftL();
    type('one', ' ');
    type('two');
    undo();
    expect(alphaTex()).toBe('r.4 2.5.4{lyrics "one"} 3.5.2 |');
  }, 20000);

  it('Space past the last note keeps the field on it, so the next keys never reach the tab', async () => {
    await openWith('0.6.4 2.5.4 r.2 |');
    keys('ArrowRight');
    shiftL();
    type('a', ' ');
    expect(field()!.value).toBe('a');
    type('it', ' ');
    expect(field()!.value).toBe('it');
    type('it');
    expect(alphaTex()).toBe('0.6.4 2.5.4{lyrics "it"} r.2 |');
  }, 20000);

  it('the Lyrics button in Bars › Text opens it too', async () => {
    await openWith('0.6.4 2.5.4 3.5.2 |');
    fireEvent.click(tool(/^Lyrics under this note/));
    expect(field()).not.toBeNull();
  }, 20000);
});

describe('a drawn syllable', () => {
  const BAR = '0.6.4{lyrics "pick"} 2.5.4{lyrics "me"} 3.5.2 |';
  it('a press picks it and Delete takes it away; the note stays', async () => {
    await openWith(BAR);
    pressLyric(BAR, { kind: 'lyric', index: 0, line: 0 });
    act(() => editor().focus());
    keys('Delete');
    expect(alphaTex()).toBe('0.6.4 2.5.4{lyrics "me"} 3.5.2 |');
  }, 20000);

  it('a double-click opens the field on it, and Enter there sets it', async () => {
    await openWith(BAR);
    pressLyric(BAR, { kind: 'lyric', index: 1, line: 0 }, true);
    expect(field()!.value).toBe('me');
    type('you');
    expect(alphaTex()).toBe('0.6.4{lyrics "pick"} 2.5.4{lyrics "you"} 3.5.2 |');
  }, 20000);

  it('stays on its note when the bar is written again (− on it), goes with it on Delete, and goes when a longer note writes over it', async () => {
    await openWith('0.6.8 2.5.8{lyrics "la"} 3.5.4 r.2 |');
    keys('ArrowRight', '-');
    expect(alphaTex()).toBe('0.6.8 2.5.16{lyrics "la"} r.16 3.5.4 r.2 |');
    keys('Delete');
    expect(alphaTex()).not.toContain('lyrics');
    undo();
    undo();
    keys('ArrowLeft', '=');
    expect(alphaTex()).toBe('0.6.4 3.5.4 r.2 |');
  }, 20000);
});

it('the ? overlay lists Shift+L and the field\'s keys', () => {
  const all = TAB_SHORTCUTS.flatMap(g => g.shortcuts.map(s => `${g.title}: ${s.keys.join(' ')}`));
  expect(all.some(s => s.includes('Shift+L'))).toBe(true);
  expect(all.some(s => s.startsWith('In the Lyrics field') && s.endsWith('Space'))).toBe(true);
});
