import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OPENROUTER_URL, MODELS_URL, PRESETS_URL } from '@/features/tab/chat/openRouter';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { CHAT_KEY } from '@/features/tab/chat/chatPrefs';
import { forgetPrompts } from '@/features/tab/chat/ChatPopover';
import { setUpPage, renderAt, editor, keys, alphaTex, litFrets, BUILTIN_FILES, SLOW } from './helpers';
import { paletteHeader } from '../tool';

setUpPage();

// `docs/specs/2026-11-15-tab-chat-popover-design.md` (issue #488): the Chat popover.
const TWO = ':4 0.6 1.6 2.6 3.6 | 5.6 6.6 7.6 8.6 |';
const TEX = `#tab=${encodeURIComponent(`\\title "Two"\n${TWO}`)}`;
const popover = () => screen.getByRole('dialog', { name: 'Chat' });
const field = () => within(popover()).getByRole('textbox', { name: 'Prompt' });
const call = (id: string, name: string, args: object) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const reply = (message: object) => ({ model: 'anthropic/claude-opus-5.5', choices: [{ message }], usage: { prompt_tokens: 900, completion_tokens: 40, cost: 0.0031 } });

/** Serves the built-ins, the guide, the model list and OpenRouter's answers, one per request, in order. */
function serve(...answers: object[]) {
  const sent: { messages: { role: string; content: string | null }[] }[] = [];
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
/** The last request's prompt: its last user message's text, the prompt before the arrangement. */
const lastUser = (sent: ReturnType<typeof serve>) => {
  const users = sent[sent.length - 1].messages.filter(m => m.role === 'user');
  const content = users[users.length - 1].content as unknown;
  return typeof content === 'string' ? content : (content as { type: string; text?: string }[]).map(p => p.text ?? '').join('');
};
const openPopover = () => keys({ key: 'i', ctrlKey: true });
const send = (text: string) => {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.keyDown(field(), { key: 'Enter' });
};

async function open() {
  localStorage.setItem(CHAT_KEY, JSON.stringify({ apiKey: 'sk-or-test', model: 'anthropic/claude-opus-5.5' }));
  renderAt(TEX);
  await screen.findAllByTestId('tab-system', undefined, SLOW);
  act(() => editor().focus());
}

describe('the Chat popover', { timeout: 20000 }, () => {
  beforeEach(() => forgetPrompts());

  it('opens on Ctrl/⌘+I about the whole arrangement, and sends the prompt as typed', async () => {
    const sent = serve(reply({ content: 'Four quarter notes a bar.' }));
    await open();
    openPopover();
    expect(within(popover()).getByText('Whole arrangement')).toBeInTheDocument();
    send('What is the rhythm?');
    await within(popover()).findByText('Four quarter notes a bar.');
    expect(lastUser(sent)).toMatch(/^What is the rhythm\?/);
    expect(lastUser(sent)).toMatch(/The cursor is in bar 1\./);
  });

  it('with bars 1 to 2 selected, says Bars 1–2 and sends the prompt about them', async () => {
    const sent = serve(reply({ content: 'Fine.' }));
    await open();
    keys({ key: 'a', ctrlKey: true });
    openPopover();
    expect(within(popover()).getByText('Bars 1–2')).toBeInTheDocument();
    send('Add fingering');
    await within(popover()).findByText('Fine.');
    expect(lastUser(sent)).toMatch(/^About the selected bars 1 to 2: Add fingering/);
  });

  it('on a note, is about that note and keeps it lit', async () => {
    const sent = serve(reply({ content: 'An open E.' }));
    await open();
    keys('ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight');
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    openPopover();
    expect(within(popover()).getByText('Note at fret 1 on string 6 in bar 1')).toBeInTheDocument();
    // The field has the keys, and the note stays lit (the tab doesn't let it go).
    act(() => field().focus());
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    send('What note is this?');
    await within(popover()).findByText('An open E.');
    expect(lastUser(sent)).toMatch(/^About the note at fret 1 on string 6 \(counted from the highest\) in bar 1, its column 2: What note is this\?/);
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
  });

  it('with bars selected, keeps the selection lit while it is open', async () => {
    serve();
    await open();
    keys({ key: 'a', ctrlKey: true });
    const lit = litFrets().length;
    expect(lit).toBeGreaterThan(0);
    openPopover();
    act(() => field().focus());
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(litFrets().length).toBe(lit);
  });

  it('stays open with the reply and its model line, and the Chat panel has the prompt and reply', async () => {
    serve(reply({ content: 'Four quarter notes a bar.' }));
    await open();
    openPopover();
    send('What is the rhythm?');
    await within(popover()).findByText('Four quarter notes a bar.');
    expect(within(popover()).getByText(/anthropic\/claude-opus-5\.5 · 900 in/)).toBeInTheDocument();
    expect(field()).toHaveValue('');
    expect(within(popover()).queryByRole('button', { name: 'Undo' })).toBeNull();
    fireEvent.click(within(popover()).getByRole('button', { name: 'Open in Chat' }));
    expect(screen.queryByRole('dialog', { name: 'Chat' })).toBeNull();
    const panel = screen.getByRole('region', { name: 'Chat' });
    expect(within(panel).getByText('What is the rhythm?')).toBeInTheDocument();
    expect(within(panel).getByText('Four quarter notes a bar.')).toBeInTheDocument();
  });

  it('after a reply that changed the arrangement, Undo takes the change back', async () => {
    serve(
      reply({ content: null, tool_calls: [call('c1', 'replace_bars', { track: 1, first_bar: 2, last_bar: 2, alphatex: ':1 9.6 |' })] }),
      reply({ content: 'Made bar 2 one note.' }),
    );
    await open();
    openPopover();
    send('Make bar 2 one note');
    await within(popover()).findByText('Made bar 2 one note.');
    // Showing the alphaTex leaves the Tab view, which closes the popover: Undo first.
    fireEvent.click(within(popover()).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(alphaTex()).toMatch(/\|\n5\.6\.4 6\.6\.4 7\.6\.4 8\.6\.4 \|$/));
  });

  it('↑ brings back the last prompt sent, ↓ empties the field again', async () => {
    serve(reply({ content: 'Yes.' }));
    await open();
    openPopover();
    send('Is it in A minor?');
    await within(popover()).findByText('Yes.');
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(field()).toHaveValue('Is it in A minor?');
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(field()).toHaveValue('');
  });

  it('Esc closes it and keeps the selection', async () => {
    serve();
    await open();
    keys({ key: 'a', ctrlKey: true });
    openPopover();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Chat' })).toBeNull();
    openPopover();
    expect(within(popover()).getByText('Bars 1–2')).toBeInTheDocument();
  });

  it('the bar menu ends with Chat…, which opens the popover', async () => {
    serve();
    await open();
    fireEvent.contextMenu(editor());
    const items = within(screen.getByRole('menu', { name: 'Bar' })).getAllByRole('menuitem');
    expect(items[items.length - 1]).toHaveTextContent('Chat…');
    fireEvent.click(items[items.length - 1]);
    expect(await screen.findByRole('dialog', { name: 'Chat' })).toBeInTheDocument();
  });

  it('with no key, the field is disabled', async () => {
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    act(() => editor().focus());
    openPopover();
    expect(field()).toBeDisabled();
    expect(paletteHeader('Chat')).toBeInTheDocument();
  });
});
