import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OPENROUTER_URL, MODELS_URL, PRESETS_URL } from '@/features/tab/chat/openRouter';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { CHAT_KEY, DEFAULT_INSTRUCTIONS } from '@/features/tab/chat/chatPrefs';
import { setUpPage, renderAt, alphaTex, undo, BUILTIN_FILES, SLOW } from './helpers';
import { column, paletteHeader } from '../tool';

setUpPage();

// `docs/specs/2026-11-08-tab-chat-design.md` (issue #424): the Chat panel.
const TEX = `#tab=${encodeURIComponent('\\title "Four"\n:4 0.6 1.6 2.6 3.6 | 5.6 6.6 7.6 8.6 |')}`;
const chatPanel = () => screen.getByRole('region', { name: 'Chat' });
/** Chat's icon in its header, which shows a reply running or unread (issue #442). */
const chatIcon = () => paletteHeader('Chat').querySelector('.tab-stack-icon')!;
const call = (id: string, name: string, args: object) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

/**
 * Serves the built-ins, the guide, the model list and OpenRouter's answers, one per request, in order. An answer
 * may be a promise, to hold the reply until the test resolves it; Stop rejects it, as a real request is.
 */
function serve(...answers: (object | Promise<object>)[]) {
  const sent: { headers: Record<string, string>; body: { model: string; messages: { role: string; content: string | null }[] } }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    const at = String(url);
    if (at === BUILTIN_URL) return new Response(JSON.stringify(BUILTIN_FILES));
    if (at === '/tab-alphatex.txt') return new Response('THE GUIDE');
    if (at === MODELS_URL) return new Response(JSON.stringify({ data: [{ id: 'anthropic/claude-opus-5.5', supported_parameters: ['tools'] }, { id: 'no/tools', supported_parameters: [] }] }));
    if (at === PRESETS_URL) {
      const key = (init?.headers as Record<string, string>).Authorization;
      // As OpenRouter answered on 2026-11-08 (fewer fields).
      return new Response(JSON.stringify({ data: [{ id: 'c9c5', name: 'default', slug: 'default', description: 'Tab default', status: 'active' }], total_count: 1 }), { status: key === 'Bearer sk-or-test' ? 200 : 401 });
    }
    if (at === OPENROUTER_URL) {
      sent.push({ headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
      const signal = init?.signal;
      const answer = await new Promise<object>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
        void Promise.resolve(answers[Math.min(sent.length - 1, answers.length - 1)]).then(resolve);
      });
      return new Response(JSON.stringify(answer), { status: 'status' in answer ? (answer as { status: number }).status : 200 });
    }
    throw new Error(`Not fetched in tests: ${at}`);
  }));
  return sent;
}
const reply = (message: object) => ({ model: 'anthropic/claude-opus-5.5', choices: [{ message }], usage: { prompt_tokens: 900, completion_tokens: 40, cost: 0.0031 } });
const withKey = () => localStorage.setItem(CHAT_KEY, JSON.stringify({ apiKey: 'sk-or-test', model: 'anthropic/claude-opus-5.5' }));
const ask = (text: string) => {
  const box = within(chatPanel()).getByRole('textbox', { name: 'Message' });
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter' });
};

describe('the Chat panel', () => {
  it('is the last palette, after Chords, and in Settings, with no flag in the address', async () => {
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const names = [...column().querySelectorAll('.tab-stack > section')].map(r => r.getAttribute('aria-label'));
    expect(names.slice(-2)).toEqual(['Chords', 'Chat']);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('treeitem', { name: 'Chat' })).toBeInTheDocument();
  });

  it('with no key, asks for one and opens Settings at Tab › Chat', async () => {
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(paletteHeader('Chat'));
    expect(within(chatPanel()).getByRole('textbox', { name: 'Message' })).toBeDisabled();
    fireEvent.click(within(chatPanel()).getByRole('button', { name: 'Open Settings' }));
    const key = await screen.findByLabelText('OpenRouter key');
    // Shown as typed, and no autocorrect or autocapitalize "off": each stops macOS text replacement in Chrome.
    for (const field of [key, within(screen.getByRole('dialog')).getByLabelText('Model')]) {
      expect(field).toHaveAttribute('type', 'text');
      expect(field).toHaveAttribute('autocomplete', 'off');
      expect(field).toHaveAttribute('spellcheck', 'false');
      expect(field).not.toHaveAttribute('autocorrect');
      expect(field).not.toHaveAttribute('autocapitalize');
    }
    fireEvent.change(key, { target: { value: '  sk-or-typed ' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(JSON.parse(localStorage.getItem(CHAT_KEY)!)).toEqual({ apiKey: 'sk-or-typed', model: 'anthropic/claude-opus-5.5', instructions: null, custom: '' });
    expect(within(chatPanel()).getByRole('textbox', { name: 'Message' })).toBeEnabled();
  });

  it('applies a reply’s changes at once, and one Undo takes them all back', async () => {
    withKey();
    const sent = serve(
      reply({ content: null, tool_calls: [call('a', 'replace_bars', { track: 1, first_bar: 1, last_bar: 1, alphatex: ':1 12.6 |' })] }),
      reply({ content: null, tool_calls: [call('b', 'replace_bars', { track: 1, first_bar: 2, last_bar: 2, alphatex: ':1 9.5 |' })] }),
      reply({ content: 'Both bars are whole notes now.' }),
    );
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(paletteHeader('Chat'));
    ask('Make both bars whole notes');
    await within(chatPanel()).findByText('Both bars are whole notes now.', undefined, SLOW);
    expect(within(chatPanel()).getByText('Changed bar 1 of track 1')).toBeInTheDocument();
    expect(within(chatPanel()).getByText('Changed bar 2 of track 1')).toBeInTheDocument();
    expect(within(chatPanel()).getByText('anthropic/claude-opus-5.5 · 2,700 in, 120 out · $0.0093')).toBeInTheDocument();
    expect(alphaTex()).toBe('12.6.1 |\n9.5.1 |');
    undo();
    expect(alphaTex()).toBe(before);
    // The request: the key, the model, the guide at the end of the system prompt, marked to be cached,
    // and the ask last, carrying the arrangement as it was, with its numbered bars and its problems.
    expect(sent[0].headers.Authorization).toBe('Bearer sk-or-test');
    expect(sent[0].body.model).toBe('anthropic/claude-opus-5.5');
    const system = sent[0].body.messages[0] as unknown as { role: string; content: { type: string; text: string; cache_control: object }[] };
    expect(system.role).toBe('system');
    expect(system.content).toHaveLength(1);
    expect(system.content[0].text).toMatch(/THE GUIDE$/);
    expect(system.content[0].cache_control).toEqual({ type: 'ephemeral' });
    const asked = sent[0].body.messages.at(-1)!;
    expect(asked.role).toBe('user');
    expect(asked.content).toMatch(/^Make both bars whole notes\n\n<arrangement>\n/);
    expect(asked.content).toContain('// track 1, bar 1');
    expect(asked.content).toMatch(/\n\n(Frets marks no problems\.|Problems Frets marks:\n[\s\S]*)\n<\/arrangement>$/);
  });

  it('keeps the conversation for the next ask, and New chat forgets it', async () => {
    withKey();
    const sent = serve(reply({ content: 'Four quarter notes a bar.' }));
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(paletteHeader('Chat'));
    ask('What rhythm is this?');
    await within(chatPanel()).findByText('Four quarter notes a bar.');
    ask('And bar 2?');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1].body.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    // An earlier ask is sent alone; only the newest carries the arrangement.
    expect(sent[1].body.messages[1].content).toBe('What rhythm is this?');
    expect(sent[1].body.messages[3].content).toMatch(/^And bar 2\?\n\n<arrangement>\n/);
    await waitFor(() => expect(within(chatPanel()).getAllByText('Four quarter notes a bar.')).toHaveLength(2));
    fireEvent.click(within(chatPanel()).getByRole('button', { name: 'New chat' }));
    expect(within(chatPanel()).queryByText('What rhythm is this?')).toBeNull();
    ask('Hello');
    await waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2].body.messages.map(m => m.role)).toEqual(['system', 'user']);
  });

  it('shows a refused key as an error, and changes nothing', async () => {
    withKey();
    serve({ status: 401, error: { message: 'User not found.' } });
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(paletteHeader('Chat'));
    ask('Hi');
    await within(chatPanel()).findByText(/OpenRouter didn't accept the key in Settings › Tab › Chat: User not found\./);
    expect(alphaTex()).toBe(before);
  });

  it('keeps the page’s keys out of the message box', async () => {
    withKey();
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(paletteHeader('Chat'));
    const box = within(chatPanel()).getByRole('textbox', { name: 'Message' });
    act(() => box.focus());
    // Delete and Ctrl+Z would change the clip if they reached the page.
    fireEvent.keyDown(box, { key: 'Delete' });
    fireEvent.keyDown(box, { key: 'z', ctrlKey: true });
    expect(alphaTex()).toBe(before);
  });

  it('offers the presets saved on OpenRouter first, then the models that take tools, and saves the one typed', async () => {
    withKey();
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(paletteHeader('Chat'));
    const field = within(chatPanel()).getByRole('combobox', { name: 'Model' });
    const offered = () => within(chatPanel()).queryAllByRole('option').map(o => o.textContent);
    // Everything is listed, though the field holds a model only one entry contains.
    await waitFor(() => { fireEvent.blur(field); fireEvent.focus(field); expect(offered()).toHaveLength(2); });
    expect(offered()).toEqual(['@preset/defaultTab default', 'anthropic/claude-opus-5.5']);
    // Typing filters the list; picking one saves it and closes the list.
    fireEvent.change(field, { target: { value: 'tab def' } });
    expect(offered()).toEqual(['@preset/defaultTab default']);
    fireEvent.click(within(chatPanel()).getByRole('option'));
    expect(JSON.parse(localStorage.getItem(CHAT_KEY)!).model).toBe('@preset/default');
    expect(within(chatPanel()).queryByRole('listbox')).toBeNull();
    // Escape closes the list and stays out of the page.
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(within(chatPanel()).queryByRole('listbox')).toBeNull();
    fireEvent.change(within(chatPanel()).getByRole('combobox', { name: 'Model' }), { target: { value: 'openai/gpt-5' } });
    expect(JSON.parse(localStorage.getItem(CHAT_KEY)!).model).toBe('openai/gpt-5');
  });
});

// Issue #442: the conversation is the page's, so it outlasts the palette, and Chat's icon shows a reply running.
describe('the Chat conversation outside the panel', () => {
  const chatButton = () => paletteHeader('Chat');
  /** A reply held until `release` is called. */
  const held = () => {
    let release!: (answer: object) => void;
    const answer = new Promise<object>(resolve => { release = resolve; });
    return { answer, release };
  };

  it('keeps a reply running when Chat folds, shows it on Chat’s icon, and marks it unread', async () => {
    withKey();
    const first = held();
    serve(
      reply({ content: null, tool_calls: [call('a', 'replace_bars', { track: 1, first_bar: 1, last_bar: 1, alphatex: ':1 12.6 |' })] }),
      first.answer,
    );
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(chatButton());
    ask('Make bar 1 a whole note');
    await within(chatPanel()).findByText('Changed bar 1 of track 1', undefined, SLOW);
    expect(chatIcon()).toHaveAttribute('data-status', 'working');
    expect(chatIcon()).toHaveAttribute('data-tip', 'Chat: Replying…');
    // Chat folds: its contents go, the reply goes on.
    fireEvent.click(chatButton());
    expect(within(chatPanel()).queryByRole('textbox', { name: 'Message' })).toBeNull();
    expect(chatIcon()).toHaveAttribute('data-status', 'working');
    expect(screen.getAllByRole('status').some(s => s.textContent === 'Chat: Replying…')).toBe(true);
    await act(async () => first.release(reply({ content: 'Bar 1 is a whole note now.' })));
    await waitFor(() => expect(chatIcon()).toHaveAttribute('data-status', 'unread'));
    expect(chatIcon()).toHaveAttribute('data-tip', 'Chat: New reply');
    expect(alphaTex()).toBe('12.6.1 |\n5.6.4 6.6.4 7.6.4 8.6.4 |');
    // Chat again: the ask, its notes and the reply are there, and the mark is gone.
    fireEvent.click(chatButton());
    expect(within(chatPanel()).getByText('Make bar 1 a whole note')).toBeInTheDocument();
    expect(within(chatPanel()).getByText('Changed bar 1 of track 1')).toBeInTheDocument();
    expect(within(chatPanel()).getByText('Bar 1 is a whole note now.')).toBeInTheDocument();
    expect(chatIcon()).not.toHaveAttribute('data-status');
    expect(chatIcon()).not.toHaveAttribute('data-tip');
    // The mark doesn't come back on closing the panel.
    fireEvent.click(chatButton());
    expect(chatIcon()).not.toHaveAttribute('data-status');
  });

  it('keeps the conversation and the half-written message when the panel closes', async () => {
    withKey();
    const sent = serve(reply({ content: 'Four quarter notes a bar.' }));
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(chatButton());
    ask('What rhythm is this?');
    await within(chatPanel()).findByText('Four quarter notes a bar.');
    // A reply ended with the panel open is read: no mark.
    expect(chatIcon()).not.toHaveAttribute('data-status');
    fireEvent.change(within(chatPanel()).getByRole('textbox', { name: 'Message' }), { target: { value: 'And bar' } });
    fireEvent.click(chatButton());
    fireEvent.click(chatButton());
    expect(within(chatPanel()).getByText('What rhythm is this?')).toBeInTheDocument();
    expect(within(chatPanel()).getByRole('textbox', { name: 'Message' })).toHaveValue('And bar');
    ask('And bar 2?');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1].body.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('can be stopped after the panel is opened again, and nothing changes after', async () => {
    withKey();
    const first = held();
    serve(first.answer);
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(chatButton());
    ask('Make bar 1 a whole note');
    await waitFor(() => expect(chatIcon()).toHaveAttribute('data-status', 'working'));
    fireEvent.click(chatButton());
    fireEvent.click(chatButton());
    fireEvent.click(within(chatPanel()).getByRole('button', { name: 'Stop' }));
    await within(chatPanel()).findByText('Stopped.');
    expect(chatIcon()).not.toHaveAttribute('data-status');
    await act(async () => first.release(reply({ content: null, tool_calls: [call('a', 'replace_bars', { track: 1, first_bar: 1, last_bar: 1, alphatex: ':1 12.6 |' })] })));
    expect(alphaTex()).toBe(before);
  });

  it('stops a running reply when the viewer leaves the page', async () => {
    withKey();
    const first = held();
    const sent = serve(first.answer);
    const page = renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(chatButton());
    ask('Make bar 1 a whole note');
    await waitFor(() => expect(sent).toHaveLength(1));
    const signal = vi.mocked(fetch).mock.calls.find(([url]) => url === OPENROUTER_URL)![1]!.signal!;
    page.unmount();
    expect(signal.aborted).toBe(true);
  });
});

// `docs/specs/2026-11-09-tab-chat-prompt-design.md` (issue #426): the prompt in Settings › Tab › Chat.
/** A request's system prompt, sent as one text block marked for caching. */
const systemText = (message: { content: unknown }) => (message.content as { text: string }[])[0].text;
describe('the Chat prompt in Settings', () => {
  const openChatSettings = async () => {
    fireEvent.click(paletteHeader('Chat'));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'Chat' }));
    return screen.getByLabelText('Instructions') as HTMLTextAreaElement;
  };
  const saved = () => JSON.parse(localStorage.getItem(CHAT_KEY)!);

  it('shows the default instructions; Reset shows only while they are edited, and puts the default back', async () => {
    withKey();
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const box = await openChatSettings();
    expect(box.value).toBe(DEFAULT_INSTRUCTIONS);
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
    fireEvent.change(box, { target: { value: 'Be brief.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(box.value).toBe(DEFAULT_INSTRUCTIONS);
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
    // Typed back word for word is not an edit.
    fireEvent.change(box, { target: { value: 'Be brief.' } });
    fireEvent.change(box, { target: { value: DEFAULT_INSTRUCTIONS } });
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(saved()).toMatchObject({ instructions: null, custom: '' });
  });

  it('saves edited instructions as typed; a double-click on the label resets them', async () => {
    withKey();
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    let box = await openChatSettings();
    fireEvent.change(box, { target: { value: ' Be brief. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(saved().instructions).toBe(' Be brief. ');
    box = await openChatSettings();
    expect(box.value).toBe(' Be brief. ');
    fireEvent.doubleClick(screen.getByText('Instructions'));
    expect(box.value).toBe(DEFAULT_INSTRUCTIONS);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(saved().instructions).toBeNull();
  });

  it('unfolds the guide read-only with Show, and folds it with Hide', async () => {
    withKey();
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    await openChatSettings();
    expect(screen.queryByLabelText('The alphaTex guide')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show guide' }));
    const guide = screen.getByLabelText('The alphaTex guide') as HTMLTextAreaElement;
    await waitFor(() => expect(guide.value).toBe('THE GUIDE'));
    expect(guide.readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hide guide' }));
    expect(screen.queryByLabelText('The alphaTex guide')).toBeNull();
  });

  it('keeps Settings open on Enter in the Custom prompt box', async () => {
    withKey();
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    await openChatSettings();
    const custom = screen.getByLabelText('Custom prompt');
    fireEvent.keyDown(custom, { key: 'Enter' });
    expect(screen.getByLabelText('Custom prompt')).toBeInTheDocument();
  });

  it('sends a custom prompt saved mid-conversation with the next message', async () => {
    withKey();
    const sent = serve(reply({ content: 'Four quarter notes a bar.' }));
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(paletteHeader('Chat'));
    ask('What rhythm is this?');
    await within(chatPanel()).findByText('Four quarter notes a bar.');
    expect(systemText(sent[0].body.messages[0])).toBe(`${DEFAULT_INSTRUCTIONS}\n\nTHE GUIDE`);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'Chat' }));
    fireEvent.change(screen.getByLabelText('Custom prompt'), { target: { value: 'Answer in Spanish.' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    ask('And bar 2?');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(systemText(sent[1].body.messages[0])).toBe(`${DEFAULT_INSTRUCTIONS}\n\nTHE GUIDE\n\nThe guitarist's own instructions:\nAnswer in Spanish.`);
    expect(sent[1].body.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });
});
