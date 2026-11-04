/*
 * Beat groups and Beam overrides on the page (step 7, `docs/specs/2026-11-04-tab-beat-groups-beams-design.md`):
 * the time signature panel's Beat groups field, the Rail's two beam tools and the right-click menu's items.
 * What they do to the clip is in `../beams.test.ts`.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip, stringY } from '@/features/tab/layout';
import { partOf } from '@/features/tab/clip';
import { setUpPage, renderAt, SLOW, editor, alphaTex, pressFirstTimeSignature, undo } from './helpers';
import { tool } from '../tool';

setUpPage();

async function open(tex: string) {
  renderAt(`#tab=${encodeURIComponent(`\\title "Step seven"\n${tex}`)}`);
  await screen.findByRole('heading', { name: 'Step seven' }, SLOW);
  act(() => editor().focus());
}

/** A press on Column `index`, string `string` (jsdom draws the tab 800 wide at 0, 0); `button` 2 is a right-click. */
function press(tex: string, index: number, string = 2, button = 0) {
  const read = readAlphaTexWith(alphaTab, tex);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  for (const system of layoutClip(partOf(read.clip), 800, 'tab').systems) {
    const placed = system.bars.flatMap(b => b.columns).find(c => c.index === index);
    if (!placed) continue;
    const at = { clientX: placed.x, clientY: system.top + stringY(system.rows, string), button };
    const svg = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerDown(svg, at);
    fireEvent.pointerUp(svg, at);
    if (button === 2) fireEvent.contextMenu(editor(), at);
    return;
  }
  throw new Error(`No Column ${index}`);
}

const field = () => screen.queryByRole('textbox', { name: 'Beat groups' }) as HTMLInputElement | null;
const type = (text: string) => {
  fireEvent.change(field()!, { target: { value: text } });
  fireEvent.keyDown(field()!, { key: 'Enter' });
};
const SEVEN = '0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 |';
const breakTool = () => tool('Break the beam before this note');
const joinTool = () => tool('Join the beam to the note before');

describe('the Beat groups field (spec Q2, Q3)', () => {
  it('shows for 5/8, 6/8, 7/8, 5/4 and 7/4, not for 4/4, 3/4 or 2/4', { timeout: 20000 }, async () => {
    for (const [time, shown] of [['5 8', true], ['6 8', true], ['7 8', true], ['5 4', true], ['7 4', true], ['4 4', false], ['3 4', false], ['2 4', false]] as const) {
      await open(`\\ts (${time}) r.1 |`);
      pressFirstTimeSignature();
      expect(!!field(), time).toBe(shown);
      cleanup();
      localStorage.clear();
    }
  });

  it('shows for a 3/4 bar read with groups of its own, `\\beaming (8 4 2)`', async () => {
    await open('\\ts (3 4) \\beaming (8 4 2) r.2. |');
    pressFirstTimeSignature();
    expect(field()?.value).toBe('2+1');
  });

  it('3+2+2 in 7/8 writes \\beaming; 2+2+2 gets a ⚠ and changes nothing; a double-click puts 2+2+3 back', async () => {
    await open(`\\ts (7 8) ${SEVEN} ${SEVEN}`);
    pressFirstTimeSignature();
    expect(field()!.value).toBe('2+2+3');
    type('3+2+2');
    expect(field()!.value).toBe('3+2+2');
    expect(alphaTex()).toContain('\\beaming (8 3 2 2)');
    // The panel stays open over the tab through the view switch `alphaTex()` makes.
    if (!field()) pressFirstTimeSignature();
    type('2+2+2');
    const problem = screen.getByTestId('beat-groups-problem');
    expect(problem).toHaveAttribute('data-tip', 'Adds up to 6; the bar has 7');
    expect(field()!.value).toBe('2+2+2');
    fireEvent.doubleClick(field()!);
    expect(field()!.value).toBe('2+2+3');
    expect(screen.queryByTestId('beat-groups-problem')).toBeNull();
    expect(alphaTex()).not.toContain('\\beaming');
    // Undo puts back 3+2+2, in one step.
    undo();
    expect(alphaTex()).toContain('\\beaming (8 3 2 2)');
  });

  it('on bar 3 of a run of 7/8 it adds a 7/8 change there that is drawn; "Remove the change" takes it away', async () => {
    const tex = `\\ts (7 8) ${SEVEN} ${SEVEN} ${SEVEN}`;
    await open(tex);
    press(`\\title "Step seven"\n${tex}`, 14);
    fireEvent.click(tool('Time signature from this bar'));
    expect(screen.getByRole('dialog', { name: 'Time signature from bar 3' })).toBeInTheDocument();
    type('3+2+2');
    const text = alphaTex();
    expect(text.split('\n')[2]).toContain('\\ts (7 8) \\beaming (8 3 2 2)');
    expect(screen.getAllByTestId('time-signature')).toHaveLength(2);
    press(`\\title "Step seven"\n${tex}`, 14);
    fireEvent.click(tool('Time signature from this bar'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove the change' }));
    expect(alphaTex()).not.toContain('\\beaming');
  });
});

describe('the beam tools and the menu (spec Q8, Q9)', () => {
  const HALF = '\\ts (4 4) 0.3.8 0.3.8 0.3.8 0.3.8 r.2 |';

  it('light for the picked note\'s override; the lit one again is Automatic; the other switches', async () => {
    await open(HALF);
    press(`\\title "Step seven"\n${HALF}`, 2);
    expect(breakTool()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(breakTool());
    expect(alphaTex()).toBe('0.3.8 0.3.8{beam split} 0.3.8 0.3.8 r.2 |');
    expect(breakTool()).toHaveAttribute('aria-pressed', 'true');
    expect(joinTool()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(joinTool());
    expect(alphaTex()).toBe('0.3.8 0.3.8{beam merge} 0.3.8 0.3.8 r.2 |');
    fireEvent.click(joinTool());
    expect(alphaTex()).toBe('0.3.8 0.3.8 0.3.8 0.3.8 r.2 |');
  });

  it('the right-click menu has both items, ticked as set, on an eighth, and neither on a quarter or a rest', async () => {
    const tex = '\\ts (4 4) 0.3.8 0.3.8 0.3.4 r.2 |';
    await open(tex);
    press(`\\title "Step seven"\n${tex}`, 1, 2, 2);
    let menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitemcheckbox', { name: /Break beam before/ })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Join beam to previous/ }));
    expect(alphaTex()).toBe('0.3.8{beam merge} 0.3.8 0.3.4 r.2 |');
    press(`\\title "Step seven"\n${tex}`, 1, 2, 2);
    menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitemcheckbox', { name: /Join beam to previous/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(menu, { key: 'Escape' });
    // A quarter, and a rest after a quarter.
    for (const [text, column] of [[tex, 2], ['\\ts (4 4) 0.3.4 r.4 r.2 |', 1]] as const) {
      cleanup();
      localStorage.clear();
      await open(text);
      press(`\\title "Step seven"\n${text}`, column, 2, 2);
      menu = screen.getByRole('menu');
      expect(within(menu).queryByRole('menuitemcheckbox')).toBeNull();
      expect(within(menu).getByRole('menuitem', { name: 'Insert bar after' })).toBeInTheDocument();
    }
  });
});
