/**
 * The capo set in the Tuning panel and drawn in the score head (issue #463,
 * docs/specs/2026-11-13-tab-capo-in-tuning-design.md).
 */
import * as alphaTab from '@coderline/alphatab';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { partOf } from '@/features/tab/clip';
import { DEFAULT_SOUND, perform } from '@/features/tab/playback';
import { setUpPage, renderAt, pageClip, undo, alphaTex, SLOW } from './helpers';

setUpPage();

const head = () => screen.getByTestId('score-head');
const tuningGroup = () => within(head()).getByRole('group', { name: 'Tuning' });
const tuningButton = () => within(tuningGroup()).getAllByRole('button')[0];
const panel = () => screen.getByRole('dialog', { name: 'Tuning' });
const field = () => within(panel()).getByRole('textbox', { name: 'Capo' });
const down = () => within(panel()).getByRole('button', { name: 'Capo down a fret' });
const up = () => within(panel()).getByRole('button', { name: 'Capo up a fret' });
/** The open Track's capo as the page keeps it. */
const capo = () => partOf(pageClip()).capo;

/** Types into the Capo field, then presses `end` if given. */
function type(value: string, end?: string) {
  fireEvent.change(field(), { target: { value } });
  if (end) fireEvent.keyDown(field(), { key: end });
}

async function open(tex: string, bars: string) {
  renderAt(`#tab=${encodeURIComponent(`\\ts (4 4)\n${tex}${bars}`)}`);
  await waitFor(() => expect(tuningGroup()).toBeInTheDocument(), SLOW);
  fireEvent.doubleClick(tuningButton());
  expect(panel()).toBeInTheDocument();
}
const OPEN = '(0.1 0.2 0.3 0.4 0.5 0.6).1 |';
const DADGAD = '\\tuning (D4 A3 G3 D3 A2 D2)\n';

describe('the Tuning panel’s Capo', () => {
  it('reads None with no capo, − greyed out; + from None sets 1', async () => {
    await open('', OPEN);
    expect(field()).toHaveValue('None');
    expect(down()).toBeDisabled();
    expect(up()).toBeEnabled();
    fireEvent.click(up());
    expect(capo()).toBe(1);
    expect(field()).toHaveValue('1');
    expect(tuningGroup()).toHaveTextContent('Standard tuning · Capo 1st fret');
  });

  it('takes a typed fret on Enter; − at 1, a typed 0 and an empty field each take the capo away', async () => {
    await open('', OPEN);
    type('4');
    // Nothing changes while it is being typed.
    expect(capo()).toBeUndefined();
    expect(field()).toHaveValue('4');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(capo()).toBe(4);
    expect(tuningGroup()).toHaveTextContent('Standard tuning · Capo 4th fret');
    type('1', 'Enter');
    fireEvent.click(down());
    expect(capo()).toBeUndefined();
    expect(field()).toHaveValue('None');
    type('3', 'Enter');
    type('0', 'Enter');
    expect(capo()).toBeUndefined();
    type('3', 'Enter');
    type('', 'Enter');
    expect(capo()).toBeUndefined();
    expect(field()).toHaveValue('None');
    expect(tuningGroup()).toHaveTextContent(/^Standard tuning$/);
  });

  it('applies a typed fret on leaving the field, and Esc leaves the capo as it was', async () => {
    await open('\\capo 2\n', OPEN);
    type('7');
    fireEvent.blur(field());
    expect(capo()).toBe(7);
    expect(field()).toHaveValue('7');
    type('9');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(capo()).toBe(7);
  });

  it('takes 15 as 12, with + greyed out there; ↑ and ↓ step it at once, from a typed number', async () => {
    await open('', OPEN);
    type('15', 'Enter');
    expect(capo()).toBe(12);
    expect(field()).toHaveValue('12');
    expect(up()).toBeDisabled();
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(capo()).toBe(11);
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(capo()).toBe(12);
    type('5');
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(capo()).toBe(6);
    expect(field()).toHaveValue('6');
  });

  it('is one undo step a change, typing 12 then Enter too; Undo puts the old capo back', async () => {
    await open('\\capo 2\n', OPEN);
    expect(field()).toHaveValue('2');
    fireEvent.click(up());
    expect(capo()).toBe(3);
    // Typed a digit at a time, it is still one step.
    type('1');
    type('12', 'Enter');
    expect(capo()).toBe(12);
    undo();
    expect(capo()).toBe(3);
    expect(field()).toHaveValue('3');
    undo();
    expect(capo()).toBe(2);
    expect(field()).toHaveValue('2');
    undo();
    expect(capo()).toBe(2);
  });

  it('DADGAD with the capo on 4: the tuning stays, the open strings sound F♯2 C♯3 F♯3 B3 C♯4 F♯4, the tab keeps its 0s', async () => {
    await open(DADGAD, OPEN);
    type('4', 'Enter');
    const strings = within(panel()).getByRole('group', { name: 'String' });
    expect(within(strings).getAllByRole('button').map(b => b.textContent?.slice(1))).toEqual(['D', 'A', 'D', 'G', 'A', 'D']);
    expect(within(panel()).getByText('Tuning: DADGAD')).toBeInTheDocument();
    expect(tuningGroup()).toHaveTextContent(/^DADGAD tuning · Capo 4th fret/);
    const played = perform(alphaTab, partOf(pageClip()), DEFAULT_SOUND, { clicks: false });
    const keys = played.midi.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent).map(e => (e as alphaTab.midi.NoteOnEvent).noteKey);
    expect([...keys].sort((a, b) => a - b)).toEqual([42, 49, 54, 59, 61, 66]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alphaTex()).toBe(OPEN);
  });

  it('keeps the capo when a preset is picked, and the tuning and every fret when the capo changes', async () => {
    await open(DADGAD, '0.6.4 2.5.4 3.4.4 5.1.4 |');
    type('4', 'Enter');
    expect(partOf(pageClip()).tuning).toEqual(['D', 'A', 'D', 'G', 'A', 'D']);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Drop D' }));
    expect(capo()).toBe(4);
    expect(tuningGroup()).toHaveTextContent(/^Drop D tuning · Capo 4th fret/);
    fireEvent.click(up());
    expect(partOf(pageClip()).tuning).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alphaTex()).toBe('0.6.4 2.5.4 3.4.4 5.1.4 |');
  });
});

describe('the capo in the head', () => {
  it('keeps the capo when the tuning is collapsed, and is picked with the tuning', async () => {
    renderAt(`#tab=${encodeURIComponent(`\\ts (4 4)\n${DADGAD}\\capo 4\n${OPEN}`)}`);
    await waitFor(() => expect(tuningGroup()).toHaveTextContent('DADGAD tuning · Capo 4th fret'), SLOW);
    fireEvent.click(tuningButton());
    fireEvent.click(screen.getByRole('button', { name: 'Collapse tuning' }));
    expect(tuningGroup()).toHaveTextContent(/^DADGAD tuning · Capo 4th fret$/);
    // Nothing over the first line: the capo is drawn only in the head.
    expect(screen.queryByTestId('capo')).toBeNull();
  });
});
