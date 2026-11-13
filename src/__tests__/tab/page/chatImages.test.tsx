import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OPENROUTER_URL, MODELS_URL, PRESETS_URL } from '@/features/tab/chat/openRouter';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { CHAT_KEY } from '@/features/tab/chat/chatPrefs';
import { setUpPage, renderAt, BUILTIN_FILES, SLOW } from './helpers';
import { paletteHeader } from '../tool';

setUpPage();

// `docs/specs/2026-11-13-tab-chat-images-design.md` (issue #465): images pasted, dropped or added in the Chat panel.
const TEX = `#tab=${encodeURIComponent('\\title "Four"\n:4 0.6 1.6 2.6 3.6 |')}`;
const chatPanel = () => screen.getByRole('region', { name: 'Chat' });
const box = () => within(chatPanel()).getByRole('textbox', { name: 'Message' });
const thumbnails = () => within(chatPanel()).queryByRole('group', { name: 'Images to send' });
const png = (name = 'image.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
const PNG_URL = 'data:image/png;base64,iVBORw==';

type Sent = { model: string; messages: { role: string; content: unknown }[] };
function serve() {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    const at = String(url);
    if (at === BUILTIN_URL) return new Response(JSON.stringify(BUILTIN_FILES));
    if (at === '/tab-alphatex.txt') return new Response('THE GUIDE');
    if (at === MODELS_URL) {
      return new Response(JSON.stringify({ data: [
        { id: 'anthropic/claude-opus-5.5', supported_parameters: ['tools'], architecture: { input_modalities: ['text', 'image'] } },
        { id: 'text/only', supported_parameters: ['tools'], architecture: { input_modalities: ['text'] } },
      ] }));
    }
    if (at === PRESETS_URL) return new Response(JSON.stringify({ data: [] }));
    if (at === OPENROUTER_URL) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ model: 'anthropic/claude-opus-5.5', choices: [{ message: { content: `Answer ${sent.length}.` } }] }));
    }
    throw new Error(`Not fetched in tests: ${at}`);
  }));
  return sent;
}
async function open(model = 'anthropic/claude-opus-5.5') {
  localStorage.setItem(CHAT_KEY, JSON.stringify({ apiKey: 'sk-or-test', model }));
  const sent = serve();
  renderAt(TEX);
  await screen.findAllByTestId('tab-system', undefined, SLOW);
  fireEvent.click(paletteHeader('Chat'));
  return sent;
}
/** Pastes files, with text too when given; true when the paste went on to the box as text. */
const paste = (files: File[], text?: string) => fireEvent.paste(box(), {
  clipboardData: { files, types: [...(files.length ? ['Files'] : []), ...(text !== undefined ? ['text/plain'] : [])], getData: () => text ?? '' },
});

describe('images in the Chat panel', () => {
  it('sends a pasted image with no words as a transcription ask, and keeps it for later asks', async () => {
    const sent = await open();
    expect(within(chatPanel()).getByRole('button', { name: 'Send' })).toBeDisabled();
    // An image alone isn't pasted as text.
    expect(paste([png()])).toBe(false);
    const waiting = await within(chatPanel()).findByRole('img', { name: 'Image 1' });
    expect(waiting).toHaveAttribute('src', PNG_URL);
    expect(within(chatPanel()).getByRole('button', { name: 'Send' })).toBeEnabled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    await within(chatPanel()).findByText('Answer 1.');
    // The request: the ask's text with the arrangement, then the image.
    const asked = sent[0].messages.at(-1)!.content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(asked).toHaveLength(2);
    expect(asked[0].text).toMatch(/^Transcribe the attached image into the arrangement\.\n\n<arrangement>\n/);
    expect(asked[1]).toEqual({ type: 'image_url', image_url: { url: PNG_URL } });
    // The box is empty again, and the ask shows its image.
    expect(thumbnails()).toBeNull();
    expect(within(chatPanel()).getByRole('img', { name: 'Image 1' }).closest('.tab-chat-ask')).not.toBeNull();
    // The next ask sends the image again, with the earlier ask, but no arrangement.
    fireEvent.change(box(), { target: { value: 'Now bar 2' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1].messages[1].content).toEqual([
      { type: 'text', text: 'Transcribe the attached image into the arrangement.' },
      { type: 'image_url', image_url: { url: PNG_URL } },
    ]);
    expect(sent[1].messages[3].content).toMatch(/^Now bar 2\n\n<arrangement>/);
  });

  it('sends words and images together, and the ask shows both', async () => {
    const sent = await open();
    paste([png('page 1.png'), png('page 2.png')]);
    await within(chatPanel()).findByRole('img', { name: 'page 2.png' });
    fireEvent.change(box(), { target: { value: 'Put these after bar 1' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await within(chatPanel()).findByText('Answer 1.');
    const asked = sent[0].messages.at(-1)!.content as { type: string; text?: string }[];
    expect(asked.map(p => p.type)).toEqual(['text', 'image_url', 'image_url']);
    expect(asked[0].text).toMatch(/^Put these after bar 1\n\n<arrangement>/);
    expect(within(chatPanel()).getByText('Put these after bar 1')).toBeInTheDocument();
  });

  it('pastes text as text when the clipboard holds text and an image', async () => {
    await open();
    expect(paste([png()], 'Am F C G')).toBe(true);
    expect(await within(chatPanel()).findByRole('img', { name: 'Image 1' })).toBeInTheDocument();
    // Text alone is an ordinary paste.
    expect(paste([], 'just words')).toBe(true);
    expect(within(chatPanel()).getAllByRole('img')).toHaveLength(1);
  });

  it('removes a waiting image with its button, and Send needs words again', async () => {
    await open();
    paste([png('a.png'), png('b.png')]);
    await within(chatPanel()).findByRole('img', { name: 'b.png' });
    fireEvent.click(within(chatPanel()).getByRole('button', { name: 'Remove image 1' }));
    expect(within(chatPanel()).queryByRole('img', { name: 'a.png' })).toBeNull();
    expect(within(chatPanel()).getByRole('img', { name: 'b.png' })).toBeInTheDocument();
    fireEvent.click(within(chatPanel()).getByRole('button', { name: 'Remove image 1' }));
    expect(thumbnails()).toBeNull();
    expect(within(chatPanel()).getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('shows a thumbnail full size when pressed, waiting or sent, and Esc closes it', async () => {
    const sent = await open();
    paste([png('page 1.png')]);
    fireEvent.click(await within(chatPanel()).findByRole('button', { name: 'Show page 1.png full size' }));
    const dialog = screen.getByRole('dialog', { name: 'page 1.png' });
    expect(within(dialog).getByRole('img', { name: 'page 1.png' })).toHaveAttribute('src', PNG_URL);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Showing it changes nothing in the message.
    expect(within(chatPanel()).getByRole('img', { name: 'page 1.png' })).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(sent).toHaveLength(1));
    fireEvent.click(await within(chatPanel()).findByRole('button', { name: 'Show page 1.png full size' }));
    expect(screen.getByRole('dialog', { name: 'page 1.png' })).toBeInTheDocument();
  });

  it('takes nothing from a drop on the box, and has no Add image button (paste only)', async () => {
    await open();
    fireEvent.drop(box(), { dataTransfer: { files: [png('dropped.png')], types: ['Files'], getData: () => '' } });
    expect(within(chatPanel()).queryByRole('button', { name: 'Add image' })).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(thumbnails()).toBeNull();
  });

  it('marks waiting images with ⚠ when OpenRouter lists the model without image input, and not for one that reads them', async () => {
    await open('text/only');
    paste([png()]);
    const warning = await within(chatPanel()).findByRole('img', { name: /^text\/only can't read images/ });
    expect(warning).toHaveAttribute('title', "text/only can't read images, so it won't see these. Pick a model that can, such as anthropic/claude-opus-5.5.");
    fireEvent.change(within(chatPanel()).getByRole('combobox', { name: 'Model' }), { target: { value: 'anthropic/claude-opus-5.5' } });
    expect(within(chatPanel()).queryByRole('img', { name: /can't read images/ })).toBeNull();
    // A preset isn't known, so isn't marked.
    fireEvent.change(within(chatPanel()).getByRole('combobox', { name: 'Model' }), { target: { value: '@preset/default' } });
    expect(within(chatPanel()).queryByRole('img', { name: /can't read images/ })).toBeNull();
  });

  it('shows no ⚠ with no images waiting', async () => {
    await open('text/only');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(MODELS_URL, expect.anything()));
    expect(within(chatPanel()).queryByRole('img')).toBeNull();
  });
});
