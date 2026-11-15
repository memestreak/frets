import { act, fireEvent, screen, within } from '@testing-library/react';
import { OPENROUTER_URL, MODELS_URL, PRESETS_URL } from '@/features/tab/chat/openRouter';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { CHAT_KEY } from '@/features/tab/chat/chatPrefs';
import { setUpPage, renderAt, editor, keys, litFrets, pickFirstTimeSignature, settle, BUILTIN_FILES, SLOW } from './helpers';
import { paletteHeader } from '../tool';

setUpPage();

// Issue #498: the Chat palette keeps what is selected, picked and lit, and its message is about it, as the
// Chat popover's prompt is (`docs/specs/2026-11-15-tab-chat-popover-design.md`).
const TWO = ':4 0.6 1.6 2.6 3.6 | 5.6 6.6 7.6 8.6 |';
const TEX = `#tab=${encodeURIComponent(`\\title "Two"\n${TWO}`)}`;
const panel = () => screen.getByRole('region', { name: 'Chat' });
const box = () => within(panel()).getByRole('textbox', { name: 'Message' });
const reply = (message: object) => ({ model: 'anthropic/claude-opus-5.5', choices: [{ message }], usage: { prompt_tokens: 900, completion_tokens: 40, cost: 0.0031 } });

/** Serves the built-ins, the guide, the model list and OpenRouter's answers, one per request, in order. */
function serve(...answers: object[]) {
  const sent: { messages: { role: string; content: unknown }[] }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    const at = String(url);
    if (at === BUILTIN_URL) return new Response(JSON.stringify(BUILTIN_FILES));
    if (at === '/tab-alphatex.txt') return new Response('THE GUIDE');
    if (at === MODELS_URL) return new Response(JSON.stringify({ data: [] }));
    if (at === PRESETS_URL) return new Response(JSON.stringify({ data: [] }));
    if (at === OPENROUTER_URL) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(answers[Math.min(sent.length - 1, answers.length - 1)]));
    }
    throw new Error(`Not fetched in tests: ${at}`);
  }));
  return sent;
}
/** The last request's last user message, as text: the prompt, then the arrangement. */
const lastUser = (sent: ReturnType<typeof serve>) => {
  const users = sent[sent.length - 1].messages.filter(m => m.role === 'user');
  const content = users[users.length - 1].content;
  return typeof content === 'string' ? content : (content as { text?: string }[]).map(p => p.text ?? '').join('');
};

async function open() {
  localStorage.setItem(CHAT_KEY, JSON.stringify({ apiKey: 'sk-or-test', model: 'anthropic/claude-opus-5.5' }));
  renderAt(TEX);
  await screen.findAllByTestId('tab-system', undefined, SLOW);
  fireEvent.click(paletteHeader('Chat'));
  act(() => editor().focus());
}
/** The message box takes the keys, as a press in it gives them, and the focus settles. */
async function typeIn(text: string) {
  fireEvent.pointerDown(box());
  act(() => box().focus());
  await settle();
  fireEvent.change(box(), { target: { value: text } });
}
const sendIt = () => fireEvent.keyDown(box(), { key: 'Enter' });

describe('the Chat palette with something selected (issue #498)', { timeout: 20000 }, () => {
  it('keeps bars 1 to 2 selected and lit while its box has the keys, and sends the message about them', async () => {
    const sent = serve(reply({ content: 'Fine.' }));
    await open();
    keys({ key: 'a', ctrlKey: true });
    const lit = litFrets().length;
    expect(lit).toBeGreaterThan(0);
    await typeIn('Add fingering');
    expect(litFrets().length).toBe(lit);
    expect(within(panel()).getByText('Bars 1–2')).toBeInTheDocument();
    sendIt();
    await within(panel()).findByText('Fine.');
    expect(lastUser(sent)).toMatch(/^About the selected bars 1 to 2: Add fingering/);
    expect(litFrets().length).toBe(lit);
  });

  it('keeps the note the cursor is on lit, and sends the message about it', async () => {
    const sent = serve(reply({ content: 'An F.' }));
    await open();
    keys('ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    await typeIn('What note is this?');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    expect(within(panel()).getByText('Note at fret 1 on string 6 in bar 1')).toBeInTheDocument();
    sendIt();
    await within(panel()).findByText('An F.');
    expect(lastUser(sent)).toMatch(/^About the note at fret 1 on string 6 \(counted from the highest\) in bar 1, its column 2: What note is this\?/);
  });

  it('keeps a picked time signature picked, and sends the message about it', async () => {
    const sent = serve(reply({ content: 'Four four.' }));
    await open();
    pickFirstTimeSignature();
    await typeIn('What meter?');
    expect(within(panel()).getByText('Time signature in bar 1')).toBeInTheDocument();
    sendIt();
    await within(panel()).findByText('Four four.');
    expect(lastUser(sent)).toMatch(/^About the time signature in bar 1: What meter\?/);
    expect(lastUser(sent)).toMatch(/Picked: the time signature in bar 1 of track 1\./);
  });

  it('opened without touching the tab, says Whole arrangement and sends the message as typed', async () => {
    const sent = serve(reply({ content: 'Two bars.' }));
    localStorage.setItem(CHAT_KEY, JSON.stringify({ apiKey: 'sk-or-test', model: 'anthropic/claude-opus-5.5' }));
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(paletteHeader('Chat'));
    await typeIn('How long is it?');
    expect(within(panel()).getByText('Whole arrangement')).toBeInTheDocument();
    sendIt();
    await within(panel()).findByText('Two bars.');
    expect(lastUser(sent)).toMatch(/^How long is it\?/);
  });

  it('the keys going on from the palette to another control let the note go', async () => {
    serve();
    await open();
    keys('ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight');
    await typeIn('Hello');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Settings' }).focus());
    await settle();
    expect(screen.queryByTestId('selected-note')).toBeNull();
    expect(within(panel()).getByText('Whole arrangement')).toBeInTheDocument();
  });
});
