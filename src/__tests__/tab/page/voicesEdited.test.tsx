/**
 * Every Voice drawn and edited on the page (step 9, `docs/specs/2026-11-04-tab-voices-drawn-edited-design.md`):
 * the Active voice and the Rail's Voice row, Alt+1–4, a press on another Voice's note, the muted Voices,
 * typing into an absent Voice, the string clash refused, Move to voice, selections over every Voice, copy
 * and paste, Select only voice, Alt+← →, Export and the line under the clip. The pure edits are in
 * `../voicesDrawn.test.ts`.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { readAscii } from '@/features/tab/ascii';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY } from '@/features/tab/layout';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { setUpPage, RIFF, renderAt, keepOpen, notice, paste, editor, keys, alphaTex as written, undo, SLOW } from './helpers';

setUpPage();

const HEAD = '\\voiceMode barWise\n\\ts (4 4)\n';
/** The clip's bars as alphaTex, one a line, without the Voices' mode line. */
const alphaTex = () => written().replace(/^\\voiceMode barWise /, '');

/** Opens `tex` (bars, in 4/4, Voices bar by bar), the editor focused. */
async function open(tex: string) {
  renderAt(`#tab=${encodeURIComponent(`\\title "Voices"\n${HEAD}${tex}`)}`);
  await screen.findByRole('heading', { name: 'Voices' }, SLOW);
  act(() => editor().focus());
}

/** Where Voice `voice`'s Column `index` is drawn on string `string` (jsdom draws the tab 800 wide at 0, 0). */
function spot(tex: string, voice: number, index: number, string: number) {
  const read = readAlphaTexWith(alphaTab, `${HEAD}${tex}`);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  for (const system of layoutClip(partOf(read.clip), 800, 'tab').systems) {
    for (const bar of system.bars) {
      const columns = voice === 0 ? bar.columns : bar.voices?.find(v => v.voice === voice)?.columns ?? [];
      const placed = columns.find(c => c.index === index);
      if (placed) return { clientX: placed.x, clientY: system.top + stringY(system.rows, string), button: 0 };
    }
  }
  throw new Error(`No Column ${index} in voice ${voice + 1}`);
}

/** A press on Voice `voice`'s Column `index`, string `string`. */
function press(tex: string, voice: number, index: number, string: number, options: { shiftKey?: boolean; button?: number } = {}) {
  const at = { ...spot(tex, voice, index, string), ...options };
  const svg = screen.getByRole('img', { name: /drawn as/ });
  fireEvent.pointerDown(svg, at);
  fireEvent.pointerUp(svg, at);
}

const voiceButton = (n: number) => within(screen.getByRole('group', { name: 'Voice' })).getByRole('button', { name: `Voice ${n}` });
const litVoices = () => [1, 2, 3, 4].filter(n => voiceButton(n).getAttribute('aria-pressed') === 'true');
const cursorVoice = () => screen.queryByTestId('cursor-voice')?.textContent ?? null;
const alt = (n: number) => ({ key: String(n), altKey: true, code: `Digit${n}` });
/** The fret numbers another Voice draws, and their colour. */
const otherInk = () => [...document.querySelectorAll('[data-testid="other-voice"] [data-testid="tab-system"] text, [data-testid="other-voice"] text')]
  .map(t => t.getAttribute('fill'));

/** What the clipboard takes from the selection. */
function copied() {
  const data = new Map<string, string>();
  const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
  act(() => { editor().dispatchEvent(copy); });
  return data.get('text/plain')!;
}

/** Voice 1 a melody on string 2, Voice 2 a bass on string 5, in bar 1; Voice 1 alone in bar 2. */
const MELODY = '\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice 3.5.2 5.5.2 |\n5.2.1 |';

describe('the Active voice', () => {
  it('lights Voice 1 in the Voice row while the tab has the keys; Alt+2 lights 2 and shows "2" by the cursor; Esc puts it back to 1', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    expect(litVoices()).toEqual([1]);
    expect(cursorVoice()).toBeNull();
    keys({ key: 'n' }, alt(2));
    expect(litVoices()).toEqual([2]);
    expect(cursorVoice()).toBe('2');
    keys('Escape', 'Escape');
    expect(litVoices()).toEqual([]);
    act(() => editor().focus());
    expect(litVoices()).toEqual([1]);
  });

  it('a Voice button makes that Voice active, its tip naming the key and, where it has no notes, how to add them', async () => {
    await open(MELODY);
    press(MELODY, 0, 4, 1);
    expect(voiceButton(2)).toHaveAttribute('data-tip', 'Voice 2 (Alt+2), type to add notes in it');
    expect(voiceButton(1)).toHaveAttribute('data-tip', 'Voice 1 (Alt+1)');
    fireEvent.click(voiceButton(3));
    expect(litVoices()).toEqual([3]);
  });

  it('a press on a Voice 2 note picks it and makes Voice 2 active', async () => {
    await open(MELODY);
    press(MELODY, 1, 1, 4);
    expect(litVoices()).toEqual([2]);
    expect(cursorVoice()).toBe('2');
    // Delete takes that note away, in Voice 2.
    keys('Delete');
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice 3.5.2 r.2 |\n5.2.1 |');
  });
});

describe('the other Voices muted', () => {
  it('draws the other Voice\'s numbers in --ink-muted while the cursor is on the tab, in ink with nothing on it; one Voice mutes nothing', async () => {
    await open(MELODY);
    keys('Escape');
    expect(otherInk().length).toBeGreaterThan(0);
    expect(otherInk().every(fill => fill !== 'var(--ink-muted)')).toBe(true);
    // A press focuses the tab in a browser; jsdom moves no focus on a press.
    act(() => editor().focus());
    press(MELODY, 0, 0, 1);
    expect(otherInk().every(fill => fill === 'var(--ink-muted)')).toBe(true);
    expect(document.querySelector('[data-testid="other-voice"]')).toHaveAttribute('data-muted', 'true');
    keys('Escape');
    expect(otherInk().every(fill => fill !== 'var(--ink-muted)')).toBe(true);
  });

  it('draws nothing muted in a one-Voice clip', async () => {
    await open('5.2.4 7.2.4 r.2 |');
    press('5.2.4 7.2.4 r.2 |', 0, 0, 1);
    expect(document.querySelectorAll('[data-testid="other-voice"]')).toHaveLength(0);
    expect(document.querySelectorAll('text[fill="var(--ink-muted)"]').length).toBe(0);
  });
});

describe('typing into another Voice', () => {
  it('typing in an absent Voice 2 creates it with its rests; deleting its last note makes it absent again', async () => {
    await open('5.2.1 |');
    press('5.2.1 |', 0, 0, 1);
    keys({ key: 'n' }, alt(2), ...Array(6).fill('ArrowUp'), ...Array(4).fill('ArrowDown'), { key: '%', shiftKey: true, code: 'Digit5' }, '3');
    // A quarter in Voice 2, its rests after it.
    expect(alphaTex()).toBe('\\voice 5.2.1 \\voice 3.5.4 r.4 r.2 |');
    keys('Escape', 'Escape');
    press('\\voice 5.2.1 \\voice 3.5.4 r.4 r.2 |', 1, 0, 4);
    keys('Delete');
    expect(alphaTex()).toBe('5.2.1 |');
  });

  it('refuses a fret on a string Voice 1 is sounding, and says so', async () => {
    await open('5.2.1 |');
    press('5.2.1 |', 0, 0, 1);
    keys({ key: 'n' }, alt(2), ...Array(6).fill('ArrowUp'), 'ArrowDown', '7');
    expect(notice()).toHaveTextContent('String 2 is sounding in voice 1 there.');
    expect(alphaTex()).toBe('5.2.1 |');
  });
});

describe('moving notes into another Voice', () => {
  it('Alt+2 on selected Voice 1 notes leaves a Gap, writes over Voice 2, leaves them selected in Voice 2; one undo step', async () => {
    await open(MELODY);
    press(MELODY, 0, 2, 1);
    keys({ key: 'ArrowRight', shiftKey: true }, alt(2));
    expect(litVoices()).toEqual([2]);
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 r.2 \\voice 3.5.2 8.2.4 7.2.4 |\n5.2.1 |');
    undo();
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice 3.5.2 5.5.2 |\n5.2.1 |');
  });

  it('refuses a move or a paste that would put two Voices on one string, whole', async () => {
    // Voice 3's 7 sounds on string 2 at beat 2, where Voice 1's half note, moved into Voice 2, would too.
    const tex = '\\voice 5.2.2 r.2 \\voice r.1 \\voice r.4 7.2.4 r.2 |';
    await open(tex);
    press(tex, 0, 0, 1);
    keys(alt(2));
    expect(notice()).toHaveTextContent('String 2 is sounding in voice 3 there.');
    expect(alphaTex()).toBe('\\voice 5.2.2 r.2 \\voice r.1 \\voice r.4 7.2.4 r.2 |');
    // A paste into Voice 2 over Voice 1's held note on string 2.
    press(tex, 0, 0, 1);
    keys(alt(2));
    expect(notice()).toHaveTextContent('String 2 is sounding in voice 3 there.');
    keys('Escape');
    act(() => editor().focus());
    keys({ key: 'n' }, alt(2));
    await paste('9.2.4 |');
    expect(notice()).toHaveTextContent('String 2 is sounding in voice 1 there.');
    expect(alphaTex()).toBe('\\voice 5.2.2 r.2 \\voice r.1 \\voice r.4 7.2.4 r.2 |');
  });

  it('the menu\'s Move to voice › moves the picked note', async () => {
    await open(MELODY);
    press(MELODY, 0, 3, 1);
    fireEvent.contextMenu(editor());
    fireEvent.click(screen.getByRole('menuitem', { name: /Move to voice/ }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Move to voice' })).getByRole('menuitem', { name: 'Voice 3' }));
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 8.2.4 r.4 \\voice 3.5.2 5.5.2 \\voice r.2 r.4 7.2.4 |\n5.2.1 |');
  });
});

describe('a selection over every Voice', () => {
  it('Shift+→ over a two-Voice bar selects both Voices\' notes, and Delete makes rests in both, one undo step', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true });
    // Voice 2's half note starts in the selection's time, so it is selected too.
    expect(document.querySelectorAll('[data-testid="other-voice"] text[fill="var(--select)"]').length).toBeGreaterThan(0);
    keys('Delete');
    expect(alphaTex()).toBe('\\voice r.2 8.2.4 7.2.4 \\voice r.2 5.5.2 |\n5.2.1 |');
    undo();
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice 3.5.2 5.5.2 |\n5.2.1 |');
  });

  it('the length keys lay each Voice\'s run out again', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true }, '-');
    expect(alphaTex()).toBe('\\voice 5.2.8 7.2.8 r.4 8.2.4 7.2.4 \\voice 3.5.4 r.4 5.5.2 |\n5.2.1 |');
  });

  it('T acts on the Active voice only: it ties Voice 1\'s two 5s and leaves Voice 2\'s two 3s apart', async () => {
    const pairs = '\\voice 5.2.4 5.2.4 r.2 \\voice 3.5.4 3.5.4 r.2 |';
    await open(pairs);
    press(pairs, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true }, 't');
    expect(alphaTex()).toBe('\\voice 5.2.2 r.2 \\voice 3.5.4 3.5.4 r.2 |');
  });

  it('; puts a tuplet on the Active voice\'s note only', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true }, ';');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tuplet' })).getByRole('button', { name: '3' }));
    const text = alphaTex();
    expect(text).toContain('\\voice 3.5.2 5.5.2 |');
    expect(text).not.toContain('\\voice 5.2.4 7.2.4 8.2.4');
  });

  it('copies both Voices with \\voice and pastes each back in its own Voice, with no "Pasted voice 1 only."', async () => {
    await open(`${MELODY}\nr.1 |`);
    press(`${MELODY}\nr.1 |`, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true });
    const text = copied();
    expect(text).toMatch(/\\voice/);
    keys('Escape');
    act(() => editor().focus());
    press(`${MELODY}\nr.1 |`, 0, 5, 1);
    await paste(text);
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice 3.5.2 5.5.2 |\n5.2.1 |\n\\voice 5.2.4 7.2.4 r.2 \\voice 3.5.2 r.2 |');
    expect(notice()).not.toHaveTextContent(/voice 1 only/);
  });

  it('Select only voice › 2 keeps Voice 2\'s notes and makes it active', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true });
    fireEvent.contextMenu(editor());
    fireEvent.click(screen.getByRole('menuitem', { name: /Select only voice/ }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Select only voice' })).getByRole('menuitem', { name: 'Voice 2' }));
    expect(litVoices()).toEqual([2]);
    keys('Delete');
    expect(alphaTex()).toBe('\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice r.2 5.5.2 |\n5.2.1 |');
  });

  it('a right-click inside the selection keeps it for the menu; outside it, picks the note there', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    keys({ key: 'ArrowRight', shiftKey: true });
    press(MELODY, 0, 1, 1, { button: 2 });
    fireEvent.contextMenu(editor());
    expect(screen.getByRole('menuitem', { name: /Select only voice/ })).toBeInTheDocument();
    keys('Escape');
    press(MELODY, 0, 3, 1, { button: 2 });
    fireEvent.contextMenu(editor());
    expect(screen.queryByRole('menuitem', { name: /Select only voice/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Move to voice/ })).toBeInTheDocument();
  });

  it('a hover opens a submenu and lights its item alone; a hover on a plain item shuts it', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    fireEvent.contextMenu(editor());
    const move = screen.getByRole('menuitem', { name: /Move to voice/ });
    fireEvent.mouseEnter(move.parentElement!);
    fireEvent.mouseEnter(move);
    expect(screen.getByRole('menu', { name: 'Move to voice' })).toBeInTheDocument();
    expect(move).toHaveFocus();
    const after = screen.getByRole('menuitem', { name: 'Insert bar after' });
    fireEvent.mouseLeave(move.parentElement!);
    fireEvent.mouseEnter(after);
    expect(screen.queryByRole('menu', { name: 'Move to voice' })).toBeNull();
    expect(after).toHaveFocus();
  });
});

describe('Alt+← →', () => {
  it('visit Voice 1\'s note, then Voice 2\'s at the same time', async () => {
    await open(MELODY);
    press(MELODY, 0, 0, 1);
    keys({ key: 'ArrowRight', altKey: true });
    expect(litVoices()).toEqual([2]);
    keys({ key: 'ArrowRight', altKey: true });
    expect(litVoices()).toEqual([1]);
    keys({ key: 'ArrowLeft', altKey: true });
    expect(litVoices()).toEqual([2]);
  });
});

describe('Export and the line under the clip', () => {
  /** Voice 2 holds a bass under bar 1 and plays on Voice 1's string 3 in bar 2. */
  const CLASH = '\\voice 3.3.4 5.3.4 r.2 \\voice 0.6.1 |\n\\voice 5.3.1 \\voice r.2 7.3.2 |';

  it('says no "not drawn yet" under the clip; the string clash sentence stays', async () => {
    await open(CLASH);
    keys('Escape');
    expect(notice()).toHaveTextContent('Bar 2 has two voices on string 3.');
    expect(notice()).not.toHaveTextContent(/not drawn yet/);
  });

  it('says nothing of voices for one Voice', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    expect(notice()).not.toHaveTextContent(/voice/);
  });

  it('shows no "Voice 1 only" ⚠ in any format', async () => {
    await open(CLASH);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Voices' });
    const format = within(dialog).getByRole('combobox', { name: 'Format' });
    for (const f of ['png', 'svg', 'ascii', 'musicxml', 'alphatex', 'guitarPro']) {
      fireEvent.change(format, { target: { value: f } });
      expect(within(dialog).queryByRole('img', { name: /Voice 1 only/ })).toBeNull();
    }
  });

  it('lists Alt+1–4 in the ? overlay under Note input and Selected notes and rests', () => {
    const groups = TAB_SHORTCUTS.filter(g => g.shortcuts.some(s => s.keys.includes('Alt+1–4'))).map(g => g.title);
    expect(groups).toEqual(['Note input', 'Selected notes and rests']);
  });
});
