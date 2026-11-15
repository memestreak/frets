import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { TOOLS, type PageSpot } from '@/features/tab/chat/arrangementTools';
import { DEFAULT_CHAT, parseChatPrefs } from '@/features/tab/chat/chatPrefs';
import { ChatError, completeWithOpenRouter, maskedKey, OPENROUTER_URL, type Complete } from '@/features/tab/chat/openRouter';
import { runReply } from '@/features/tab/chat/reply';
import { callHeading, firstLine, messageHeading, shortDataUrl, shownArguments, shownJson, withShortImages } from '@/features/tab/chat/advanced';
import type { Clip } from '@/features/tab/clip';

// `docs/specs/2026-11-15-tab-chat-advanced-view-design.md` (issue #495): what the advanced view records and shows.
const read = async (text: string) => readAlphaTexWith(alphaTab, text);
const result = readAlphaTexWith(alphaTab, '\\title "Four"\n:4 0.6 1.6 2.6 3.6 |');
if (!result.ok) throw new Error(result.errors.join('; '));
const CLIP: Clip = result.clip;
const SPOT: PageSpot = { track: 0, cursorBar: 1, selectedBars: null };
const call = (id: string, name: string, args: object) => ({ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } });
const IMAGE = `data:image/png;base64,${'A'.repeat(4096)}`;

describe('Settings › Tab › Chat › Advanced view', () => {
  it('is off by default, kept when saved as true, and off for anything not a boolean', () => {
    expect(DEFAULT_CHAT.advanced).toBe(false);
    expect(parseChatPrefs({ advanced: true }).advanced).toBe(true);
    expect(parseChatPrefs({ advanced: 'yes' }).advanced).toBe(false);
    expect(parseChatPrefs({}).advanced).toBe(false);
  });
});

describe('what the view shows', () => {
  it('cuts a long data: URL to its type and size at any depth, and leaves short ones and other text alone', () => {
    expect(shortDataUrl(IMAGE)).toBe('data:image/png;base64,… (4 KB)');
    expect(withShortImages({ a: [{ url: IMAGE }, 'data:x,1', 'plain'] })).toEqual({ a: [{ url: 'data:image/png;base64,… (4 KB)' }, 'data:x,1', 'plain'] });
  });

  it('pretty-prints JSON with two-space indents, and shows text that isn’t JSON as it came', () => {
    expect(shownJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(shownJson('Bad gateway')).toBe('Bad gateway');
    expect(shownArguments('{"track":1}')).toBe('{\n  "track": 1\n}');
    expect(shownArguments('{not json')).toBe('{not json');
  });

  it('heads a message with its role and first line, an image by its size, a tool call by its name', () => {
    expect(firstLine('\nOne\nTwo')).toBe('One');
    expect(firstLine('x'.repeat(70), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(messageHeading({ role: 'user', content: [{ type: 'image_url', image_url: { url: IMAGE } }] })).toBe('user · [image, 4 KB]');
    expect(messageHeading({ role: 'assistant', content: null, tool_calls: [call('a', 'read_arrangement', {})] })).toBe('assistant · calls read_arrangement');
    expect(messageHeading({ role: 'assistant', content: '' })).toBe('assistant');
  });

  it('heads a call with its number, model, tokens and time; failed and waiting say so', () => {
    const base = { request: { model: 'm', messages: [], tools: TOOLS }, newFrom: 0, results: [] };
    expect(callHeading({
      ...base, model: 'm/full', answer: { role: 'assistant', content: 'Hi' }, usage: { promptTokens: 1200, completionTokens: 40 },
      exchange: { url: OPENROUTER_URL, headers: {}, body: {}, status: 200, response: {}, ms: 1234 },
    }, 1)).toBe('Call 2 · m/full · 1,200 in, 40 out · 1.2 s');
    expect(callHeading({ ...base, error: 'Nope' }, 0)).toBe('Call 1 · m · failed');
    expect(callHeading(base, 0)).toBe('Call 1 · m · waiting');
  });

  it('masks a key to dots and its last 4 characters', () => {
    expect(maskedKey('sk-or-v1-abcd1234')).toBe('••••1234');
  });
});

describe('a reply’s calls', () => {
  it('records each call: the request, the answer, each tool’s result, and which messages are new', async () => {
    const turns = [
      { role: 'assistant' as const, content: null, tool_calls: [call('a', 'read_arrangement', {})] },
      { role: 'assistant' as const, content: 'One bar.' },
    ];
    let n = 0;
    const complete: Complete = async request => ({ message: turns[n++], model: `${request.model}-full`, usage: { promptTokens: 10 } });
    const seen: number[] = [];
    const reply = await runReply({
      complete, apiKey: 'k', model: 'm',
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'Before' }, { role: 'assistant', content: 'Old' }, { role: 'user', content: 'How many bars?' }],
      current: () => ({ clip: CLIP, spot: SPOT }), read, onClip: () => {}, onCalls: calls => seen.push(calls.length),
    });
    const [first, second] = reply.calls;
    expect(reply.calls).toHaveLength(2);
    // The first call's only new message is the viewer's; the second's are the model's tool call and the tool's answer.
    expect(first.newFrom).toBe(3);
    expect(second.newFrom).toBe(4);
    expect(second.request.messages.slice(4).map(m => m.role)).toEqual(['assistant', 'tool']);
    expect(first.model).toBe('m-full');
    expect(first.results).toHaveLength(1);
    expect(first.results[0].call.function.name).toBe('read_arrangement');
    expect(first.results[0].answer).toContain('// track 1, bar 1');
    expect(second.answer?.content).toBe('One bar.');
    expect(second.request.tools).toBe(TOOLS);
    // Told as each call is sent, answered and its tools run.
    expect(seen).toEqual([1, 1, 1, 2, 2]);
  });

  it('records a failed call with its error and what crossed the wire, and a stopped one as Stopped', async () => {
    const exchange = { url: OPENROUTER_URL, headers: {}, body: { model: 'm' }, status: 500, response: 'oops', ms: 5 };
    const failing: Complete = async () => { throw new ChatError('OpenRouter answered 500', exchange); };
    let calls: Parameters<NonNullable<Parameters<typeof runReply>[0]['onCalls']>>[0] = [];
    await expect(runReply({ complete: failing, apiKey: 'k', model: 'm', messages: [{ role: 'user', content: 'Hi' }], current: () => ({ clip: CLIP, spot: SPOT }), read, onClip: () => {}, onCalls: c => { calls = c; } }))
      .rejects.toThrow('OpenRouter answered 500');
    expect(calls).toHaveLength(1);
    expect(calls[0].error).toBe('OpenRouter answered 500');
    expect(calls[0].exchange).toBe(exchange);

    const stop = new AbortController();
    const stopped: Complete = async () => { stop.abort(); throw new DOMException('Aborted', 'AbortError'); };
    await expect(runReply({ complete: stopped, apiKey: 'k', model: 'm', messages: [{ role: 'user', content: 'Hi' }], current: () => ({ clip: CLIP, spot: SPOT }), read, onClip: () => {}, onCalls: c => { calls = c; }, signal: stop.signal }))
      .rejects.toThrow();
    expect(calls[0].error).toBe('Stopped.');
  });
});

describe('what crosses the wire', () => {
  afterEach(() => vi.unstubAllGlobals());
  const request = { apiKey: 'sk-or-secret-wxyz', model: 'm', messages: [{ role: 'user' as const, content: 'Hi' }], tools: TOOLS };

  it('keeps the body exactly as sent, the headers with the key masked, the status and the answer', async () => {
    let sentBody = '';
    const answer = { model: 'm', choices: [{ message: { content: 'Hello' } }] };
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => { sentBody = String(init?.body); return new Response(JSON.stringify(answer)); }));
    const { exchange } = await completeWithOpenRouter(request);
    expect(exchange?.body).toEqual(JSON.parse(sentBody));
    expect(exchange?.headers.Authorization).toBe('Bearer ••••wxyz');
    expect(JSON.stringify(exchange)).not.toContain('sk-or-secret');
    expect(exchange?.headers['X-Title']).toBe('Frets');
    expect(exchange?.url).toBe(OPENROUTER_URL);
    expect(exchange?.status).toBe(200);
    expect(exchange?.response).toEqual(answer);
  });

  it('keeps a failed answer’s status and body, as text when it isn’t JSON, and no status when nothing came', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad gateway', { status: 502 })));
    const failed = await completeWithOpenRouter(request).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(ChatError);
    expect((failed as ChatError).message).toBe('OpenRouter answered 502');
    expect((failed as ChatError).exchange).toMatchObject({ status: 502, response: 'Bad gateway' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const offline = await completeWithOpenRouter(request).catch((e: unknown) => e);
    expect((offline as ChatError).exchange?.status).toBeUndefined();
    expect((offline as ChatError).exchange?.response).toBeUndefined();

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'No choices' } }))));
    const empty = await completeWithOpenRouter(request).catch((e: unknown) => e);
    expect((empty as ChatError).message).toBe('The model sent no answer: No choices');
    expect((empty as ChatError).exchange?.status).toBe(200);
  });
});
