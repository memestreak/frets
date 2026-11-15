/**
 * Insert mode (`docs/specs/2026-11-14-tab-insert-mode-design.md`, issue #482 phase 2): I turns it on, and entries,
 * lengths, dots, paste, Delete and cut push or pull the music after them in every Voice of the Track.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip } from '@/features/tab/layout';
import { partOf } from '@/features/tab/clip';
import { setUpPage, renderAt, SLOW, undo, editor, keys, alphaTex, alphaTexText, paste } from './helpers';

setUpPage();

const open = async (text: string) => {
  renderAt(`#tab=${encodeURIComponent(`\\title "Insert"\n\\ts (4 4)\n${text}`)}`);
  await screen.findByRole('heading', { name: 'Insert' }, SLOW);
  act(() => editor().focus());
};
/** Shift and a digit's key: on the tab, the next note's length in note input mode, the picked note's in normal mode. */
const shiftDigit = (digit: number) => keys({ key: '!@#$%^&'[digit - 1], shiftKey: true, code: `Digit${digit}` });
const insertButton = () => screen.getAllByRole('button', { name: 'Insert mode' })[0];
const clipboard = (type: 'cut' | 'copy') => {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  e.clipboardData = { setData: () => {}, getData: () => '' };
  act(() => { editor().dispatchEvent(e); });
};

/** The issue's example, its bars 9 to 13 as bars 1 to 5: one string, a quarter rest at the end of bar 4. */
const EXAMPLE = [
  '5.1.4 7.1.4 5.1.4 7.1.4 |',
  '3.1.2 5.1.4 7.1.4 |',
  '8.1.4 7.1.4 5.1.4 3.1.4 |',
  '5.1.2{d} r.4 |',
  '0.1.4 r.4 r.2 |',
].join('\n');

describe('TabPage: Insert mode on and off (issue #482, phase 2)', () => {
  it('I turns it on and off: the Insert button lights and the cursor has its notches', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    expect(insertButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('insert-notches')).toBeNull();
    keys('i');
    expect(insertButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('insert-notches')).toBeInTheDocument();
    expect(editor().getAttribute('aria-label')).toMatch(/Insert mode/);
    // In note input mode too, and it stays on going in and out.
    keys('n');
    expect(screen.getByTestId('insert-notches')).toBeInTheDocument();
    keys('Escape');
    act(() => editor().focus());
    expect(insertButton()).toHaveAttribute('aria-pressed', 'true');
    keys('i');
    expect(insertButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('insert-notches')).toBeNull();
  });

  it('on the staff, the notches go over the notes that reach past its top line and under those past its foot', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'staff' }));
    const notchYs = () => [...screen.getByTestId('insert-notches').querySelectorAll('path')]
      .map(path => Number(/^M[\d.-]+ ([\d.-]+)/.exec(path.getAttribute('d')!)![1]));
    await open('12.1.4 r.4 r.2 |');
    keys('i');
    const [inTop, inBottom] = notchYs();
    cleanup();
    await open('24.1.4 r.4 r.2 |\n0.6.4 r.4 r.2 |');
    keys('i');
    const [highTop] = notchYs();
    keys('ArrowRight', 'ArrowRight', 'ArrowRight');
    const [, lowBottom] = notchYs();
    // A high E two octaves up and a low E far under the staff: the notches go round them, not over the staff alone.
    expect(lowBottom - highTop).toBeGreaterThan(inBottom - inTop + 20);
  });

  it('the Insert button is in Notes › Input, after the pencil and the Grid', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    const buttons = within(screen.getByRole('group', { name: 'Input' })).getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Note input mode');
    expect(buttons[1]).toHaveAccessibleName(/^Note input grid/);
    expect(buttons[2]).toHaveAccessibleName('Insert mode');
    expect(buttons[2]).toHaveAttribute('data-tip', expect.stringMatching(/\(I\)$/));
  });

  it('the Insert button does what I does, and nothing is saved: a new visit starts in Overwrite', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    act(() => editor().blur());
    fireEvent.click(insertButton());
    expect(insertButton()).toHaveAttribute('aria-pressed', 'true');
    // It doesn't take the keys to the tab, so no note lights up (Jeremy, 2026-11-15).
    expect(document.activeElement).not.toBe(editor());
    expect(screen.queryByTestId('insert-notches')).toBeNull();
    cleanup();
    await open('5.1.4 7.1.4 r.2 |');
    expect(insertButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('Let ring is on Alt+I now, and I puts no let ring on', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    keys('i');
    expect(alphaTex()).toBe('5.1.4 7.1.4 r.2 |');
    keys('i', { key: 'ˆ', altKey: true, code: 'KeyI' });
    expect(alphaTex()).toBe('5.1{lr}.4 7.1.4 r.2 |');
  });

  it('the ? overlay lists I, and Let ring as Alt+I', () => {
    const listed = TAB_SHORTCUTS.flatMap(g => g.shortcuts);
    expect(listed.find(s => s.keys.includes('I'))?.does).toMatch(/^Insert mode on or off/);
    expect(listed.find(s => s.does === 'Let ring')?.keys).toEqual(['Alt+I']);
  });
});

describe('TabPage: entering a note in Insert mode pushes the music after it', () => {
  it('the issue example: a 16th typed on bar 9 beat 2 moves everything after it a 16th later, ties over the bar lines', async () => {
    await open(EXAMPLE);
    keys('ArrowRight', 'n');
    shiftDigit(3);
    keys('i', '9');
    expect(alphaTex()).toBe([
      '5.1.4 9.1.16 7.1.16 -.1.8 -.1.16 5.1.16 -.1.8 -.1.16 7.1.16 -.1.8 |',
      '-.1.16 3.1.16 -.1.8 -.1.4 -.1.16 5.1.16 -.1.8 -.1.16 7.1.16 -.1.8 |',
      '-.1.16 8.1.16 -.1.8 -.1.16 7.1.16 -.1.8 -.1.16 5.1.16 -.1.8 -.1.16 3.1.16 -.1.8 |',
      // Bar 12's dotted half and quarter rest a 16th later, and bar 13's 0 a 16th late: no Anchor stops the push yet.
      '-.1.16 5.1.16 -.1.8 -.1.4 -.1.4 -.1.16 r.16 r.8 |',
      'r.16 0.1.16 -.1.8 -.1.16 r.16 r.8 r.2 |',
    ].join('\n'));
    // The push and the note are one undo step.
    undo();
    expect(alphaTex()).toBe(EXAMPLE);
  });

  it('Overwrite, with the same keys, writes the 9 over the 7 and moves nothing', async () => {
    await open(EXAMPLE);
    keys('ArrowRight', 'n');
    shiftDigit(3);
    keys('9');
    expect(alphaTex().split('\n')).toEqual(['5.1.4 9.1.16 r.16 r.8 5.1.4 7.1.4 |', ...EXAMPLE.split('\n').slice(1)]);
  });

  it('a fret typed straight away on the note just entered retypes it, and one on an empty string joins its chord', async () => {
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |');
    keys('ArrowRight', 'n');
    shiftDigit(3);
    keys('i', '9', '8');
    expect(alphaTex()).toBe('5.1.4 8.1.16 7.1.16 -.1.8 -.1.16 5.1.16 -.1.8 -.1.16 7.1.16 -.1.8 |\n-.1.16 r.16 r.8 r.4 r.2 |');
    keys('ArrowDown', '7');
    expect(alphaTex()).toBe('5.1.4 (8.1 7.2).16 7.1.16 -.1.8 -.1.16 5.1.16 -.1.8 -.1.16 7.1.16 -.1.8 |\n-.1.16 r.16 r.8 r.4 r.2 |');
  });

  it('a new empty arrangement: typing at the end adds no bars of rests', async () => {
    renderAt('');
    await screen.findByRole('heading', { level: 1 }, SLOW);
    act(() => editor().focus());
    keys('n', 'i', '5', 'ArrowRight', '7', 'ArrowRight', '8');
    expect(alphaTex()).toBe('5.1.4 7.1.4 8.1.4 r.4 |');
  });

  it('`,` leaves a Gap of the Input length and pushes the music after it on', async () => {
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |');
    keys('ArrowRight', 'n');
    shiftDigit(4);
    keys('i', ',');
    expect(alphaTex()).toBe('5.1.4 r.8 7.1.8 -.1.8 5.1.4 7.1.8 |\n-.1.8 r.8 r.4 r.2 |');
  });

  it('Voice 2 moves with Voice 1; Column Marks move with their notes', async () => {
    await open('\\voice 5.1.4{ch "C"} 7.1.4{txt "hi"} 5.1.4 7.1.4 |\n\\voice 0.6.2 3.6.2 |');
    keys('ArrowRight', 'n');
    shiftDigit(4);
    keys('i', '9');
    expect(alphaTex()).toBe([
      '\\voiceMode barWise \\voice 5.1.4{ch "C"} 9.1.8 7.1.8{txt "hi"} -.1.8 5.1.4 7.1.8 \\voice 0.6.4 r.8 0.6.8 -.6.8 3.6.8 -.6.4 |',
      '\\voice -.1.8 r.8 r.4 r.2 \\voice -.6.8 r.8 r.4 r.2 |',
    ].join('\n'));
  });

  it('on the staff, each letter goes in before the note at the caret, and the caret goes on with the music', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |');
    keys('ArrowRight', 'n');
    shiftDigit(4);
    keys({ key: 'ArrowUp', ctrlKey: true }, 'i', 'c');
    expect(alphaTex()).toBe('5.1.4 8.1.8 7.1.8 -.1.8 5.1.4 7.1.8 |\n-.1.8 r.8 r.4 r.2 |');
    keys('d');
    expect(alphaTex()).toBe('5.1.4 8.1.8 10.1.8 7.1.4 5.1.4 |\n7.1.4 r.4 r.2 |');
  });

  it('T in note input mode makes room for the tied note', async () => {
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |');
    keys('n');
    shiftDigit(4);
    keys('i', 't');
    expect(alphaTex()).toBe('5.1.4{d} 7.1.8 -.1.8 5.1.4 7.1.8 |\n-.1.8 r.8 r.4 r.2 |');
  });

  it('with Tuplet entry, the first note makes room for the whole tuplet and the next goes in its Gap', async () => {
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |');
    keys('ArrowRight', 'n');
    shiftDigit(4);
    keys('i', ';');
    const three = [...document.querySelectorAll('.tab-tuplet-panel button')].find(b => b.textContent === '3') as HTMLElement;
    act(() => three.click());
    act(() => editor().focus());
    keys('9');
    expect(alphaTex()).toBe('5.1.4 9.1.8{tu 3} r.4{tu 3} 7.1.4 5.1.4 |\n7.1.4 r.4 r.2 |');
    keys('ArrowRight', '8');
    expect(alphaTex()).toBe('5.1.4 9.1.8{tu 3} 8.1.8{tu 3} r.8{tu 3} 7.1.4 5.1.4 |\n7.1.4 r.4 r.2 |');
  });

  it('other Tracks stay as they were, and a section and tempo stay on their bar', async () => {
    renderAt(`#tab=${encodeURIComponent([
      '\\title "Insert"', '\\track "Lead"', '\\ts (4 4)', '5.1.4 7.1.4 5.1.4 7.1.4 |', '\\section "Chorus" \\tempo 90 3.1.1 |',
      '\\track "Bass"', '0.6.1 |', '3.6.1 |',
    ].join('\n'))}`);
    await screen.findByRole('heading', { name: 'Insert' }, SLOW);
    act(() => editor().focus());
    keys('ArrowRight', 'n');
    shiftDigit(5);
    keys('i', '9');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    const text = alphaTexText().replace(/\s+/g, ' ');
    expect(text).toContain('5.1.4 9.1.4 7.1.4 5.1.4 | \\section "Chorus" \\tempo 90 7.1.4 3.1.4 -.1.2 | -.1.4 r.4 r.2 |');
    expect(text).toMatch(/0\.6\.1 \| 3\.6\.1 \| r\.1 \|/);
  });

  it('a push that would carry a tuplet across a bar line is refused, and says so', async () => {
    const tuplet = '5.1.4 7.1.4 5.1.4 7.1.8{tu 3} 7.1.8{tu 3} 7.1.8{tu 3} |';
    await open(tuplet);
    keys('ArrowRight', 'n');
    shiftDigit(3);
    keys('i', '9');
    expect(screen.getByTestId('tab-notice')).toHaveTextContent('That would put a tuplet across a bar line.');
    expect(alphaTex()).toBe(tuplet);
  });
});

describe('TabPage: lengths, paste, Delete and cut in Insert mode', () => {
  it('a longer note pushes the music after it on, a shorter one pulls it back, a dot pushes', async () => {
    await open('5.1.4 7.1.4 r.2 |\n3.1.1 |');
    keys('i', '=');
    expect(alphaTex()).toBe('5.1.2 7.1.4 r.4 |\nr.4 3.1.4 -.1.2 |\n-.1.4 r.4 r.2 |');
    keys('-', '-');
    expect(alphaTex()).toBe('5.1.8 7.1.4 r.8 r.4 r.8 3.1.8 |\n-.1.2{dd} r.8 |\nr.1 |');
    keys('.');
    expect(alphaTex()).toBe('5.1.8{d} 7.1.16 -.1.8{d} r.16 r.4 r.8 r.16 3.1.16 |\n-.1.2 -.1.4{dd} r.16 |\nr.1 |');
  });

  it('a length set with Shift and a digit pushes too', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    keys('i');
    shiftDigit(6);
    expect(alphaTex()).toBe('5.1.2 7.1.4 r.4 |');
  });

  it('Alt+→ moves the note and the music after it a quarter later; Alt+← brings them back', async () => {
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |\n5.1.4 7.1.4 5.1.4 7.1.4 |');
    keys('i', { key: 'ArrowRight', altKey: true });
    expect(alphaTex()).toBe('r.4 5.1.4 7.1.4 5.1.4 |\n7.1.4 5.1.4 7.1.4 5.1.4 |\n7.1.4 r.4 r.2 |');
    keys({ key: 'ArrowLeft', altKey: true });
    expect(alphaTex()).toBe('5.1.4 7.1.4 5.1.4 7.1.4 |\n5.1.4 7.1.4 5.1.4 7.1.4 |\nr.1 |');
    // Out of Insert mode, as before: the 5 is written over the 7.
    keys('i', { key: 'ArrowRight', altKey: true });
    expect(alphaTex().split('\n')[0]).toBe('r.4 5.1.4 5.1.4 7.1.4 |');
  });

  it('a bar pasted before bar 1 keeps its key and tempo, and the Intro slides on with its music (2026-11-15)', async () => {
    const song = '\\title "Song"\n\\ts (6 8)\n\\ks E \\tempo (72 "Slowly") \\section "Intro" 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |\n2.5.4{d} 1.4.4{d} |';
    renderAt(`#tab=${encodeURIComponent(song)}`);
    await screen.findByRole('heading', { name: 'Song' }, SLOW);
    act(() => editor().focus());
    keys('i');
    await paste('\\ts (6 8)\n\\ks E \\tempo (72 "Slowly") 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |');
    expect(alphaTex()).toBe([
      '\\ks E \\tempo (72 "Slowly") 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |',
      '\\section "Intro" 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |',
      '2.5.4{d} 1.4.4{d} |',
    ].join('\n'));
  });

  it('paste puts the copy in before the picked note, as Insert paste does', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    keys('ArrowRight', 'i');
    await paste('9.1.4');
    expect(alphaTex()).toBe('5.1.4 9.1.4 7.1.4 r.4 |');
  });

  it('Delete on a note pulls the music after it back, a Gap opening at the end', async () => {
    await open('5.1.4 7.1.4 5.1.4 7.1.4 |\n3.1.1 |');
    keys('ArrowRight', 'i', 'Delete');
    expect(alphaTex()).toBe('5.1.4 5.1.4 7.1.4 3.1.4 |\n-.1.2{d} r.4 |');
  });

  it('Delete on one note of a chord takes only that note', async () => {
    await open('5.1.4 (7.1 8.2).4 5.1.4 7.1.4 |');
    keys('ArrowRight', 'i', 'Delete');
    expect(alphaTex()).toBe('5.1.4 8.2.4 5.1.4 7.1.4 |');
  });

  it('cut takes the time away too', async () => {
    await open('5.1.4 7.1.4 5.1.4 r.4 |');
    keys('ArrowRight', 'i');
    clipboard('cut');
    expect(alphaTex()).toBe('5.1.4 5.1.4 r.2 |');
  });

  it('out of Insert mode, Delete and cut leave rests as before', async () => {
    await open('5.1.4 7.1.4 5.1.4 r.4 |');
    keys('ArrowRight', 'Delete');
    expect(alphaTex()).toBe('5.1.4 r.4 5.1.4 r.4 |');
  });
});

/** A press just above Column `index` of `text` in 4/4 (jsdom draws the tab 800 wide at 0, 0): the playback line goes there. */
function pressAbove(text: string, index: number) {
  const read = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${text}`);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  const placed = layoutClip(partOf(read.clip), 800, 'tab').systems.flatMap(s => s.bars.flatMap(b => b.columns)).find(c => c.index === index)!;
  fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: placed.x, clientY: -10 });
}

describe('TabPage: the playback line acts as the cursor (2026-11-15)', () => {
  const BAR = '5.1.4 7.1.4 5.1.4 7.1.4 |';

  it('a press above the staff puts the cursor on the line: the keys act there when the tab takes them again', async () => {
    await open(BAR);
    pressAbove(BAR, 2);
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    expect(editor()).not.toHaveFocus();
    act(() => editor().focus());
    keys('n', '9');
    expect(alphaTex()).toBe('5.1.4 7.1.4 9.1.4 7.1.4 |');
  });

  it('→ moves the line and the cursor with it', async () => {
    await open(BAR);
    pressAbove(BAR, 1);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    act(() => editor().focus());
    keys('n', '9');
    expect(alphaTex()).toBe('5.1.4 7.1.4 9.1.4 7.1.4 |');
  });

  it('a paste goes over the music at the line', async () => {
    await open(BAR);
    pressAbove(BAR, 2);
    await paste('9.1.4');
    expect(alphaTex()).toBe('5.1.4 7.1.4 9.1.4 7.1.4 |');
  });

  it('in Insert mode, a paste at the line slides the music after it on', async () => {
    await open(BAR);
    keys('i');
    pressAbove(BAR, 2);
    await paste('9.1.4');
    expect(alphaTex()).toBe('5.1.4 7.1.4 9.1.4 5.1.4 |\n7.1.4 r.4 r.2 |');
  });

  it('a paste at the line after the last column goes on the end', async () => {
    await open(BAR);
    keys('i');
    pressAbove(BAR, 3);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    await paste('9.1.1 |');
    expect(alphaTex()).toBe('5.1.4 7.1.4 5.1.4 7.1.4 |\n9.1.1 |');
  });

  it('the cursor\'s notches stand in the gap before its note, where the line does', async () => {
    await open(BAR);
    keys('ArrowRight', 'ArrowRight', 'i');
    const notchX = Number(/^M([\d.-]+) /.exec(screen.getByTestId('insert-notches').querySelector('path')!.getAttribute('d')!)![1]) + 5;
    pressAbove(BAR, 2);
    expect(Number(screen.getByTestId('play-mark').getAttribute('x1'))).toBeCloseTo(notchX, 5);
  });

  it('in Insert mode the line has the cursor\'s notches; out of it, it has none', async () => {
    await open(BAR);
    pressAbove(BAR, 2);
    expect(screen.queryByTestId('line-insert-notches')).toBeNull();
    keys('i');
    expect(screen.getByTestId('line-insert-notches')).toBeInTheDocument();
    expect(screen.getByTestId('line-insert-notches').querySelectorAll('path')).toHaveLength(2);
    // On the tab again, the cursor has them and the line goes.
    act(() => editor().focus());
    expect(screen.queryByTestId('line-insert-notches')).toBeNull();
    expect(screen.getByTestId('insert-notches')).toBeInTheDocument();
  });
});
