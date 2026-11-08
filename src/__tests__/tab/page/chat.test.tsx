import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OPENROUTER_URL, MODELS_URL } from '@/features/tab/chat/openRouter';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { CHAT_KEY } from '@/features/tab/chat/chatPrefs';
import { setUpPage, renderAt, alphaTex, undo, BUILTIN_FILES, SLOW } from './helpers';

setUpPage();

// `docs/specs/2026-11-08-tab-chat-design.md` (issue #424): the Chat panel, behind ?chat.
const TEX = `#tab=${encodeURIComponent('\\title "Four"\n:4 0.6 1.6 2.6 3.6 | 5.6 6.6 7.6 8.6 |')}`;
const railButton = (name: string) => screen.queryByRole('button', { name });
const chatPanel = () => screen.getByRole('complementary', { name: 'Chat' });
const call = (id: string, name: string, args: object) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

/** Serves the built-ins, the guide, the model list and OpenRouter's answers, one per request, in order. */
function serve(...answers: object[]) {
  const sent: { headers: Record<string, string>; body: { model: string; messages: { role: string; content: string | null }[] } }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    const at = String(url);
    if (at === BUILTIN_URL) return new Response(JSON.stringify(BUILTIN_FILES));
    if (at === '/tab-alphatex.txt') return new Response('THE GUIDE');
    if (at === MODELS_URL) return new Response(JSON.stringify({ data: [{ id: 'anthropic/claude-opus-5.5', supported_parameters: ['tools'] }, { id: 'no/tools', supported_parameters: [] }] }));
    if (at === OPENROUTER_URL) {
      sent.push({ headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
      const answer = answers[Math.min(sent.length - 1, answers.length - 1)];
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
  it('is not on the rail, nor in Settings, without ?chat', async () => {
    serve();
    renderAt(TEX);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    expect(railButton('Chat')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('treeitem', { name: 'Chat' })).toBeNull();
  });

  it('with ?chat and no key, asks for one and opens Settings at Tab › Chat', async () => {
    serve();
    renderAt(`?chat${TEX}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(railButton('Chat')!);
    expect(within(chatPanel()).getByRole('textbox', { name: 'Message' })).toBeDisabled();
    fireEvent.click(within(chatPanel()).getByRole('button', { name: 'Open Settings' }));
    const key = await screen.findByLabelText('OpenRouter key');
    expect(key).toHaveAttribute('type', 'password');
    fireEvent.change(key, { target: { value: '  sk-or-typed ' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(JSON.parse(localStorage.getItem(CHAT_KEY)!)).toEqual({ apiKey: 'sk-or-typed', model: 'anthropic/claude-opus-5.5' });
    expect(within(chatPanel()).getByRole('textbox', { name: 'Message' })).toBeEnabled();
  });

  it('applies a reply’s changes at once, and one Undo takes them all back', async () => {
    withKey();
    const sent = serve(
      reply({ content: null, tool_calls: [call('a', 'replace_bars', { track: 1, first_bar: 1, last_bar: 1, alphatex: ':1 12.6 |' })] }),
      reply({ content: null, tool_calls: [call('b', 'replace_bars', { track: 1, first_bar: 2, last_bar: 2, alphatex: ':1 9.5 |' })] }),
      reply({ content: 'Both bars are whole notes now.' }),
    );
    renderAt(`?chat${TEX}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(railButton('Chat')!);
    ask('Make both bars whole notes');
    await within(chatPanel()).findByText('Both bars are whole notes now.', undefined, SLOW);
    expect(within(chatPanel()).getByText('Changed bar 1 of track 1')).toBeInTheDocument();
    expect(within(chatPanel()).getByText('Changed bar 2 of track 1')).toBeInTheDocument();
    expect(within(chatPanel()).getByText('anthropic/claude-opus-5.5 · 2,700 in, 120 out · $0.0093')).toBeInTheDocument();
    expect(alphaTex()).toBe('12.6.1 |\n9.5.1 |');
    undo();
    expect(alphaTex()).toBe(before);
    // The request: the key, the model, the guide in the system prompt, the ask last.
    expect(sent[0].headers.Authorization).toBe('Bearer sk-or-test');
    expect(sent[0].body.model).toBe('anthropic/claude-opus-5.5');
    expect(sent[0].body.messages[0]).toMatchObject({ role: 'system' });
    expect(sent[0].body.messages[0].content).toMatch(/THE GUIDE$/);
    expect(sent[0].body.messages.at(-1)).toEqual({ role: 'user', content: 'Make both bars whole notes' });
  });

  it('keeps the conversation for the next ask, and New chat forgets it', async () => {
    withKey();
    const sent = serve(reply({ content: 'Four quarter notes a bar.' }));
    renderAt(`?chat${TEX}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(railButton('Chat')!);
    ask('What rhythm is this?');
    await within(chatPanel()).findByText('Four quarter notes a bar.');
    ask('And bar 2?');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1].body.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
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
    renderAt(`?chat${TEX}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(railButton('Chat')!);
    ask('Hi');
    await within(chatPanel()).findByText(/OpenRouter didn't accept the key in Settings › Tab › Chat: User not found\./);
    expect(alphaTex()).toBe(before);
  });

  it('keeps the page’s keys out of the message box', async () => {
    withKey();
    serve();
    renderAt(`?chat${TEX}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    const before = alphaTex();
    fireEvent.click(railButton('Chat')!);
    const box = within(chatPanel()).getByRole('textbox', { name: 'Message' });
    act(() => box.focus());
    // Delete and Ctrl+Z would change the clip if they reached the page.
    fireEvent.keyDown(box, { key: 'Delete' });
    fireEvent.keyDown(box, { key: 'z', ctrlKey: true });
    expect(alphaTex()).toBe(before);
  });

  it('offers the models that take tools, and saves the one typed', async () => {
    withKey();
    serve();
    renderAt(`?chat${TEX}`);
    await screen.findAllByTestId('tab-system', undefined, SLOW);
    fireEvent.click(railButton('Chat')!);
    await waitFor(() => expect(document.querySelectorAll('datalist option')).toHaveLength(1));
    fireEvent.change(within(chatPanel()).getByRole('combobox', { name: 'Model' }), { target: { value: 'openai/gpt-5' } });
    expect(JSON.parse(localStorage.getItem(CHAT_KEY)!).model).toBe('openai/gpt-5');
  });
});
