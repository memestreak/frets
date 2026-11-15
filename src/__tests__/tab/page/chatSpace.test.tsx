import { act, fireEvent, screen, within } from '@testing-library/react';
import { OPENROUTER_URL, MODELS_URL, PRESETS_URL } from '@/features/tab/chat/openRouter';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { CHAT_KEY } from '@/features/tab/chat/chatPrefs';
import { forgetPrompts } from '@/features/tab/chat/ChatPopover';
import { emptyClip, partOf } from '@/features/tab/clip';
import { layoutClip, stringY, type Parts } from '@/features/tab/layout';
import { setUpPage, renderAt, editor, keys, settle, BUILTIN_FILES, SLOW } from './helpers';
import { paletteHeader } from '../tool';

setUpPage();

// Issue #507: Space types in the Chat palette's message box and the Chat popover's prompt, and once the
// arrangement is pressed again it plays and stops, wherever the press lands.
const TWO = ':4 0.6 1.6 2.6 3.6 | 5.6 6.6 7.6 8.6 |';
const TEX = `#tab=${encodeURIComponent(`\\title "Two"\n${TWO}`)}`;
const panel = () => screen.getByRole('region', { name: 'Chat' });
const box = () => within(panel()).getByRole('textbox', { name: 'Message' });
const popover = () => screen.getByRole('dialog', { name: 'Chat' });
const prompt = () => within(popover()).getByRole('textbox', { name: 'Prompt' });
const svg = () => screen.getByRole('img', { name: /drawn as/ });
const reply = { model: 'anthropic/claude-opus-5.5', choices: [{ message: { content: 'Fine.' } }], usage: { prompt_tokens: 900, completion_tokens: 40, cost: 0.0031 } };

/** Serves the built-ins, the guide, the model list and a reply to every message. */
function serve() {
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    const at = String(url);
    if (at === BUILTIN_URL) return new Response(JSON.stringify(BUILTIN_FILES));
    if (at === '/tab-alphatex.txt') return new Response('THE GUIDE');
    if (at === MODELS_URL || at === PRESETS_URL) return new Response(JSON.stringify({ data: [] }));
    if (at === OPENROUTER_URL) return new Response(JSON.stringify(reply));
    throw new Error(`Not fetched in tests: ${at}`);
  }));
}

/** Whether playback started (its sound loading, or playing). */
const playing = () => screen.queryByRole('button', { name: /Loading the sound|Stop/ }) !== null;
/** Space pressed where the keys are now: whether the page took it (true) or left it to a field to type (false). */
const space = () => !fireEvent.keyDown(document.activeElement ?? document.body, { key: ' ' });

async function open(hash = TEX, parts: Parts = 'tab') {
  serve();
  localStorage.setItem(CHAT_KEY, JSON.stringify({ apiKey: 'sk-or-test', model: 'anthropic/claude-opus-5.5' }));
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
  renderAt(hash);
  await screen.findAllByTestId('tab-system', undefined, SLOW);
}
/** The palette's message box takes the keys, as a press in it gives them. */
async function intoBox() {
  if (!screen.queryByRole('textbox', { name: 'Message' })) fireEvent.click(paletteHeader('Chat'));
  fireEvent.pointerDown(box());
  act(() => box().focus());
  await settle();
}
/**
 * A press on the drawing, as a browser makes it: pointer down, mouse down, which gives the tab the focus
 * unless the drawing prevents it (`keepFocus` in `TabClip.tsx`), then pointer up.
 */
async function press(at: { clientX: number; clientY: number }) {
  const where = { ...at, button: 0 };
  fireEvent.pointerDown(svg(), where);
  if (fireEvent.mouseDown(svg(), where)) act(() => editor().focus());
  fireEvent.pointerUp(svg(), where);
  await settle();
}
/** Where the presses land, in jsdom's drawing 800 wide at 0, 0, for the arrangement drawn in `parts`. */
function spots(parts: Parts, clip = partOf(emptyClip())) {
  const { systems } = layoutClip(clip, 800, parts);
  const [system] = systems;
  const [bar] = system.bars;
  const middle = (bar.x0 + bar.x1) / 2;
  return {
    /** Just above the drawing: the playback line goes there. */
    above: { clientX: middle, clientY: -8 },
    /** Far below the drawing, beside nothing. */
    below: { clientX: 790, clientY: systems[systems.length - 1].top + 400 },
    /** On a string of the tab, else a line of the staff. */
    on: { clientX: middle, clientY: system.top + (system.rows.tab ? stringY(system.rows, 2) : system.rows.score!.top + 8) },
  };
}

describe('Space after Chat (issue #507)', { timeout: 20000 }, () => {
  beforeEach(() => forgetPrompts());

  it('types in the palette’s message box, and plays again after a press above the staff', async () => {
    await open();
    await intoBox();
    expect(space()).toBe(false);
    expect(playing()).toBe(false);
    await press(spots('tab').above);
    expect(box()).not.toHaveFocus();
    expect(space()).toBe(true);
    expect(playing()).toBe(true);
  });

  it.each(['tab', 'both', 'staff'] as const)('plays again after a press on the arrangement or beside it (%s)', async parts => {
    for (const where of ['above', 'below', 'on'] as const) {
      await open(TEX, parts);
      await intoBox();
      await press(spots(parts, partOf(emptyClip()))[where]);
      expect(box(), where).not.toHaveFocus();
      expect(space(), where).toBe(true);
      expect(playing(), where).toBe(true);
      document.body.innerHTML = '';
    }
  });

  it('plays again after a press on a note', async () => {
    await open();
    await intoBox();
    // The first note, the 0 on string 6.
    const zero = [...svg().querySelectorAll('text')].find(t => t.textContent === '0')!;
    const at = { clientX: Number(zero.getAttribute('x')), clientY: Number(zero.getAttribute('y')) - 3 };
    await press(at);
    expect(editor()).toHaveFocus();
    expect(space()).toBe(true);
    expect(playing()).toBe(true);
  });

  it('types after Send, and plays again after a press above the staff', async () => {
    await open();
    await intoBox();
    fireEvent.change(box(), { target: { value: 'Hello' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await within(panel()).findByText('Fine.');
    expect(box()).toHaveFocus();
    expect(space()).toBe(false);
    await press(spots('tab').above);
    expect(space()).toBe(true);
    expect(playing()).toBe(true);
  });

  it('types in a new empty arrangement’s message box, and plays again after a press in its bar', async () => {
    await open('');
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    await settle();
    await intoBox();
    expect(space()).toBe(false);
    await press(spots('tab').on);
    expect(space()).toBe(true);
    expect(playing()).toBe(true);
  });

  it('types in the popover’s prompt, and plays again after Esc', async () => {
    await open();
    act(() => editor().focus());
    keys({ key: 'i', ctrlKey: true });
    expect(prompt()).toHaveFocus();
    expect(space()).toBe(false);
    fireEvent.keyDown(prompt(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Chat' })).toBeNull();
    expect(space()).toBe(true);
    expect(playing()).toBe(true);
  });

  it('types in the popover’s prompt after Send, and plays again after a press above the staff', async () => {
    await open();
    act(() => editor().focus());
    keys({ key: 'i', ctrlKey: true });
    fireEvent.change(prompt(), { target: { value: 'Hello' } });
    fireEvent.keyDown(prompt(), { key: 'Enter' });
    await within(popover()).findByText('Fine.');
    expect(prompt()).toHaveFocus();
    expect(space()).toBe(false);
    await press(spots('tab').above);
    expect(document.activeElement?.closest('.tab-chat-popover')).toBeFalsy();
    expect(space()).toBe(true);
    expect(playing()).toBe(true);
  });
});
