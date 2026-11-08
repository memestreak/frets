/*
 * Tuplets, grace notes and rests on the page (step 6, `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`):
 * `;` and the Tuplet panel, Tuplet entry and Grace entry, `/`, `,`, the tools' lights and tips, and the keys
 * that went. The edits themselves are in `../tupletsGrace.test.ts`.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip, stringY } from '@/features/tab/layout';
import { markBoxes } from '@/features/tab/marks';
import { partOf } from '@/features/tab/clip';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTex, notice } from './helpers';
import { tool } from '../tool';

setUpPage();

/** Opens `tex` in 4/4, the editor focused. */
async function open(tex: string) {
  renderAt(`#tab=${encodeURIComponent(`\\title "Step six"\n\\ts (4 4)\n${tex}`)}`);
  await screen.findByRole('heading', { name: 'Step six' }, SLOW);
  act(() => editor().focus());
}

const laidOut = (tex: string) => {
  const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${tex}`);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return layoutClip(partOf(read.clip), 800, 'tab');
};

/** A press on Column `index`, string `string` (jsdom draws the tab 800 wide at 0, 0). */
function press(tex: string, index: number, string = 0) {
  for (const system of laidOut(tex).systems) {
    const placed = system.bars.flatMap(b => b.columns).find(c => c.index === index);
    if (!placed) continue;
    const at = { clientX: placed.x, clientY: system.top + stringY(system.rows, string), button: 0 };
    const svg = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerDown(svg, at);
    fireEvent.pointerUp(svg, at);
    return;
  }
  throw new Error(`No Column ${index}`);
}

const panel = () => screen.queryByRole('dialog', { name: 'Tuplet' });
const tuplet = () => tool('Tuplet');
const grace = () => tool('Grace note, just before the beat');
const eighthLength = { key: '$', shiftKey: true, code: 'Digit4' };
const quarterLength = { key: '%', shiftKey: true, code: 'Digit5' };
const sixteenthLength = { key: '#', shiftKey: true, code: 'Digit3' };

describe('`;` and the Tuplet panel in normal mode', () => {
  const QUARTER = '5.1.4 7.1.4 r.2 |';

  it('`;` then 3 on a picked quarter on beat 1: a triplet eighth then a triplet quarter rest, the bar full', async () => {
    await open(QUARTER);
    press(QUARTER, 0);
    keys(';');
    expect(panel()).toBeInTheDocument();
    fireEvent.keyDown(panel()!, { key: '3' });
    expect(panel()).toBeNull();
    expect(editor()).toHaveFocus();
    expect(alphaTex()).toBe('5.1.8{tu 3} r.4{tu 3} 7.1.4 r.2 |');
    expect(screen.queryByTestId('bar-warning')).toBeNull();
  });

  it('5 in the panel picks a quintuplet; ↓ and Enter pick too; Esc closes it and changes nothing', async () => {
    await open(QUARTER);
    press(QUARTER, 0);
    keys(';');
    fireEvent.keyDown(panel()!, { key: '5' });
    expect(alphaTex()).toBe('5.1.16{tu 5} r.4{tu 5} 7.1.4 r.2 |');
    press(QUARTER, 1);
    keys(';');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel()).toBeNull();
    expect(alphaTex()).toBe('5.1.16{tu 5} r.4{tu 5} 7.1.4 r.2 |');
    // From the 3 (none lit on the 7), ↓ goes to 5: Enter picks it.
    keys(';');
    fireEvent.keyDown(panel()!, { key: 'ArrowDown' });
    fireEvent.keyDown(panel()!, { key: 'Enter' });
    expect(alphaTex()).toBe('5.1.16{tu 5} r.4{tu 5} 7.1.16{tu 5} r.4{tu 5} r.2 |');
  });

  it('on a dotted quarter nothing changes and the line under the clip says why', async () => {
    const DOTTED = '5.1.4{d} r.8 r.2 |';
    await open(DOTTED);
    press(DOTTED, 0);
    keys(';');
    fireEvent.keyDown(panel()!, { key: '3' });
    expect(alphaTex()).toBe(DOTTED);
    expect(notice()).toHaveTextContent('A tuplet goes on a note without a dot.');
  });

  it('None in the Tuplet button’s panel takes the tuplet away', async () => {
    const MADE = '5.1.8{tu 3} r.4{tu 3} 7.1.4 r.2 |';
    await open(MADE);
    press(MADE, 0);
    fireEvent.click(tuplet());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tuplet' })).getByRole('button', { name: 'None' }));
    expect(alphaTex()).toBe('5.1.8 r.8 7.1.4 r.2 |');
  });

  it('Delete on the picked tuplet number of three triplet eighths makes them plain, over the next eighth', async () => {
    const THREE = '5.1.8{tu 3} 7.1.8{tu 3} 8.1.8{tu 3} 9.1.8 3.1.8 r.2 |';
    await open(THREE);
    const { box } = markBoxes(laidOut(THREE)).find(m => m.hit.mark === 'tuplet')!;
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, button: 0 };
    fireEvent.pointerDown(svg, at);
    fireEvent.pointerUp(svg, at);
    keys('Delete');
    expect(alphaTex()).toBe('5.1.8 7.1.8 8.1.8 3.1.8 r.2 |');
  });
});

describe('Tuplet entry in note input (Q6, Q7)', () => {
  it('a triplet picked lights the Tuplet button; three frets with → between make one triplet, a fourth starts the next', async () => {
    await open('r.1 |');
    keys('n', 'ArrowUp', eighthLength, ';');
    fireEvent.keyDown(panel()!, { key: '3' });
    expect(tuplet()).toHaveAttribute('aria-pressed', 'true');
    keys('5', 'ArrowRight', '7', 'ArrowRight', '8', 'ArrowRight', '9');
    expect(alphaTex()).toBe('5.1.8{tu 3} 7.1.8{tu 3} 8.1.8{tu 3} 9.1.8{tu 3} r.4{tu 3} r.2 |');
    // The same tuplet again turns it off; so does leaving note input.
    keys(';');
    fireEvent.keyDown(panel()!, { key: '3' });
    expect(tuplet()).toHaveAttribute('aria-pressed', 'false');
    keys(';');
    fireEvent.keyDown(panel()!, { key: '3' });
    expect(tuplet()).toHaveAttribute('aria-pressed', 'true');
    keys('Escape', 'n');
    expect(tuplet()).toHaveAttribute('aria-pressed', 'false');
  });

  it('None turns it off; a sixteenth Input length inside an eighth triplet types a triplet sixteenth', async () => {
    await open('5.1.8{tu 3} r.4{tu 3} r.4 r.2 |');
    keys('n', 'ArrowUp', ';');
    fireEvent.keyDown(panel()!, { key: '3' });
    keys(';');
    fireEvent.click(within(panel()!).getByRole('button', { name: 'None' }));
    expect(tuplet()).toHaveAttribute('aria-pressed', 'false');
    keys('ArrowRight', sixteenthLength, '7');
    expect(alphaTex()).toMatch(/^5\.1\.8\{tu 3\} 7\.1\.16\{tu 3\} /);
  });

  it('in a triplet’s Gap → stops at each triplet eighth with Tuplet entry off', async () => {
    await open('5.1.8{tu 3} r.4{tu 3} r.4 r.2 |');
    keys('n', 'ArrowUp', 'ArrowRight', 'ArrowRight', '9');
    expect(alphaTex()).toBe('5.1.8{tu 3} r.8{tu 3} 9.1.8{tu 3} r.4 r.2 |');
  });
});

describe('grace notes (Q8–Q11)', () => {
  const QUARTERS = '5.1.4 7.1.4 r.2 |';

  it('`/` on a picked note adds one before it at its fret, the cursor on it, so a fret typed in note input changes it', async () => {
    await open(QUARTERS);
    press(QUARTERS, 1);
    keys('/');
    expect(alphaTex()).toBe('5.1.4 7.1.8{gr} 7.1.4 r.2 |');
    // Frets are typed in note input mode, which starts on the grace note (Jeremy, 2026-11-07).
    keys('n', '9', 'Escape');
    expect(alphaTex()).toBe('5.1.4 9.1.8{gr} 7.1.4 r.2 |');
    // `/` on the grace note adds a second; both are sixteenths.
    keys('/');
    expect(alphaTex()).toBe('5.1.4 9.1.16{gr} 9.1.16{gr} 7.1.4 r.2 |');
    // The length keys do nothing on it, and Duration lights nothing.
    keys('=');
    expect(alphaTex()).toBe('5.1.4 9.1.16{gr} 9.1.16{gr} 7.1.4 r.2 |');
    expect(tool(/^Sixteenth note/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('Delete and `,` on a picked grace note remove it and leave no Gap', async () => {
    const TWO = '5.1.4 9.1.16{gr} 9.1.16{gr} 7.1.4 r.2 |';
    await open(TWO);
    press(TWO, 1);
    keys('Delete');
    expect(alphaTex()).toBe('5.1.4 9.1.8{gr} 7.1.4 r.2 |');
    press('5.1.4 9.1.8{gr} 7.1.4 r.2 |', 1);
    keys(',');
    expect(alphaTex()).toBe(QUARTERS);
  });

  it('Grace entry: `/` in note input lights Grace; 5 then 7 go before the quarter there; `/` again, 9 is the main note', async () => {
    await open('5.1.4 r.4 r.2 |');
    keys('n', 'ArrowUp', 'ArrowRight', '/');
    expect(grace()).toHaveAttribute('aria-pressed', 'true');
    // Moving off and back keeps 5 and 7 two frets, not 57.
    keys('5', 'ArrowDown', 'ArrowUp');
    keys('7');
    expect(alphaTex()).toBe('5.1.4 5.1.16{gr} 7.1.16{gr} r.4 r.2 |');
    keys('/');
    expect(grace()).toHaveAttribute('aria-pressed', 'false');
    keys(quarterLength, '9');
    expect(alphaTex()).toBe('5.1.4 5.1.16{gr} 7.1.16{gr} 9.1.4 r.2 |');
  });
});

describe('`,` and the Rest tool (Q12, Q13)', () => {
  it('in note input, Input length a quarter, on a half on beat 1: a quarter Gap, the cursor on beat 2', async () => {
    await open('5.1.2 r.2 |');
    keys('n', 'ArrowUp', quarterLength, ',', '7');
    expect(alphaTex()).toBe('r.4 7.1.4 r.2 |');
  });

  it('with Tuplet entry on, `,` then a fret makes a triplet starting with a rest; with Grace entry on, `,` does nothing', async () => {
    await open('r.1 |');
    keys('n', 'ArrowUp', eighthLength, ';');
    fireEvent.keyDown(panel()!, { key: '3' });
    keys(',', '5');
    expect(alphaTex()).toBe('r.8{tu 3} 5.1.8{tu 3} r.8{tu 3} r.4 r.2 |');
    keys('/', ',');
    expect(alphaTex()).toBe('r.8{tu 3} 5.1.8{tu 3} r.8{tu 3} r.4 r.2 |');
  });

  it('in normal mode `,` on a picked note is Delete; on a picked rest nothing changes; the Rest tool never lights', async () => {
    const TWO = '5.1.4 7.1.4 r.2 |';
    await open(TWO);
    press(TWO, 1);
    keys(',');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    keys(',');
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
    expect(tool('Rest')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tool('Rest'));
    expect(alphaTex()).toBe('5.1.4 r.4 r.2 |');
  });
});

describe('the keys (Q14, Q16–Q18)', () => {
  // Alt+3 is step 9's: it moves the picked note into Voice 3.
  it('Shift+G and R do nothing; Alt+/ steps the slide as `/` did', async () => {
    const TWO = '5.1.4 7.1.4 r.2 |';
    await open(TWO);
    press(TWO, 0);
    keys({ key: 'G', shiftKey: true }, 'r');
    expect(alphaTex()).toBe(TWO);
    press(TWO, 1);
    keys({ key: '÷', altKey: true, code: 'Slash' });
    // alphaTex writes the slide on the note it starts from.
    expect(alphaTex()).toBe('5.1{sl}.4 7.1.4 r.2 |');
  });

  it('the tips and the ? overlay name `;`, `/`, Alt+/ and `,`', async () => {
    await open('5.1.4 r.4 r.2 |');
    expect(tuplet()).toHaveAttribute('data-tip', 'Tuplet (;)');
    expect(grace()).toHaveAttribute('data-tip', 'Grace note, just before the beat (/)');
    expect(tool('Rest')).toHaveAttribute('data-tip', 'Rest (,)');
    expect(tool('Slide from the note before')).toHaveAttribute('data-tip', 'Slide from the note before (Alt+/)');
    const listed = TAB_SHORTCUTS.flatMap(g => g.shortcuts).flatMap(s => s.keys);
    for (const key of [';', '/', 'Alt+/', ',']) expect(listed).toContain(key);
    for (const key of ['R', 'Shift+G', 'Alt+3, 5, 6 or 7']) expect(listed).not.toContain(key);
  });
});
