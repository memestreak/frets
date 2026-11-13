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
const pick = () => within(panel()).getByRole('combobox', { name: 'Capo' }) as HTMLSelectElement;
const neck = () => within(panel()).queryByRole('img', { name: /^Capo on fret/ });
const fretButton = (f: number) => within(panel()).getByRole('button', { name: `Capo on fret ${f}` });
/** The open Track's capo as the page keeps it. */
const capo = () => partOf(pageClip()).capo;

/** Picks a choice in the Capo dropdown: 0 is None. */
function choose(fret: number) {
  fireEvent.change(pick(), { target: { value: String(fret) } });
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
  it('is a dropdown, None first and chosen with no capo, then the 1st to the 12th fret; no picture at None', async () => {
    await open('', OPEN);
    expect([...pick().options].map(o => o.textContent)).toEqual([
      'None', '1st fret', '2nd fret', '3rd fret', '4th fret', '5th fret', '6th fret',
      '7th fret', '8th fret', '9th fret', '10th fret', '11th fret', '12th fret',
    ]);
    expect(pick().selectedOptions[0].textContent).toBe('None');
    expect(neck()).toBeNull();
  });

  it('sets \\capo N on a choice, shows the neck with the capo on it, and None takes both away', async () => {
    await open('', OPEN);
    choose(4);
    expect(capo()).toBe(4);
    expect(tuningGroup()).toHaveTextContent('Standard tuning · Capo 4th fret');
    expect(neck()).toHaveAccessibleName('Capo on fret 4');
    expect(fretButton(4)).toHaveAttribute('aria-pressed', 'true');
    choose(12);
    expect(capo()).toBe(12);
    choose(0);
    expect(capo()).toBeUndefined();
    expect(neck()).toBeNull();
    expect(tuningGroup()).toHaveTextContent(/^Standard tuning$/);
  });

  it('moves the capo to a fret pressed on the neck, the dropdown following; the neck has no None', async () => {
    await open('', OPEN);
    choose(2);
    fireEvent.click(fretButton(7));
    expect(capo()).toBe(7);
    expect(pick().value).toBe('7');
    expect(neck()).toHaveAccessibleName('Capo on fret 7');
    // Every fret from 1 to 12 is on the neck (look a); none takes the capo off.
    for (let f = 1; f <= 12; f++) {
      fireEvent.click(fretButton(f));
      expect(capo()).toBe(f);
    }
    expect(within(panel()).queryByRole('button', { name: /None|fret 0/ })).toBeNull();
    // Frets 13 to 15 are drawn but take no press.
    expect(within(panel()).queryByRole('button', { name: /fret (0|1[3-5])$/ })).toBeNull();
    fireEvent.click(neck()!);
    expect(capo()).toBe(12);
  });

  it('is one undo step a change, from the dropdown or the neck; Undo puts the old capo back', async () => {
    await open('\\capo 2\n', OPEN);
    expect(pick().value).toBe('2');
    choose(12);
    fireEvent.click(fretButton(5));
    expect(capo()).toBe(5);
    undo();
    expect(capo()).toBe(12);
    expect(pick().value).toBe('12');
    undo();
    expect(capo()).toBe(2);
    undo();
    expect(capo()).toBe(2);
  });

  it('DADGAD with the capo on 4: the tuning stays, the open strings sound F♯2 C♯3 F♯3 B3 C♯4 F♯4, the tab keeps its 0s', async () => {
    await open(DADGAD, OPEN);
    choose(4);
    const strings = within(panel()).getByRole('group', { name: 'String' });
    expect(within(strings).getAllByRole('button').map(b => b.textContent?.slice(1))).toEqual(['D', 'A', 'D', 'G', 'A', 'D']);
    expect(within(panel()).getByRole('combobox', { name: 'Tuning' })).toHaveValue('DADGAD');
    expect(tuningGroup()).toHaveTextContent(/^DADGAD tuning · Capo 4th fret/);
    const played = perform(alphaTab, partOf(pageClip()), DEFAULT_SOUND, { clicks: false });
    const keys = played.midi.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent).map(e => (e as alphaTab.midi.NoteOnEvent).noteKey);
    expect([...keys].sort((a, b) => a - b)).toEqual([42, 49, 54, 59, 61, 66]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(alphaTex()).toBe(OPEN);
  });

  it('keeps the capo when a preset is picked, and the tuning and every fret when the capo changes', async () => {
    await open(DADGAD, '0.6.4 2.5.4 3.4.4 5.1.4 |');
    choose(4);
    expect(partOf(pageClip()).tuning).toEqual(['D', 'A', 'D', 'G', 'A', 'D']);
    fireEvent.change(within(panel()).getByRole('combobox', { name: 'Tuning' }), { target: { value: 'Drop D' } });
    expect(capo()).toBe(4);
    expect(tuningGroup()).toHaveTextContent(/^Drop D tuning · Capo 4th fret/);
    choose(5);
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
