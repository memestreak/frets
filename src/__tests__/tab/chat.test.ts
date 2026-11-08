import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { clipReducer, type ClipState } from '@/features/tab/clipState';
import { describeArrangement, runTool, spliceBars, TOOLS, type PageSpot } from '@/features/tab/chat/arrangementTools';
import { CHAT_KEY, DEFAULT_CHAT, DEFAULT_MODEL, parseChatPrefs, readChatParam } from '@/features/tab/chat/chatPrefs';
import { ChatError, errorText, readCompletion, type Complete, type CompletionRequest } from '@/features/tab/chat/openRouter';
import { MAX_STEPS, runReply, systemPrompt } from '@/features/tab/chat/reply';
import { runsOf, usageLine } from '@/features/tab/chat/ChatPanel';
import type { Clip } from '@/features/tab/clip';

// `docs/specs/2026-11-08-tab-chat-design.md`: the Chat panel's tools, its calls to OpenRouter, and one reply's loop.
const read = async (text: string) => readAlphaTexWith(alphaTab, text);
const clipOf = (text: string): Clip => {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result.clip;
};
const FOUR = clipOf('\\title "Four"\n:4 0.6 1.6 2.6 3.6 | 5.6 6.6 7.6 8.6 | 0.5 1.5 2.5 3.5 | 5.5 6.5 7.5 8.5 |');
const TWO_TRACKS = clipOf('\\title "Duo"\n\\track "Lead"\n:4 0.1 1.1 2.1 3.1 | 5.1 6.1 7.1 8.1 |\n\\track "Bass"\n:1 0.6 | 3.6 |');
const SPOT: PageSpot = { track: 0, cursorBar: 1, selectedBars: null };
const bars = (clip: Clip, track = 0) => clip.tracks[track].bars.length;

describe('read_arrangement', () => {
  it('numbers every bar of every track, and says where the cursor and selection are', () => {
    const text = describeArrangement(TWO_TRACKS, { track: 1, cursorBar: 0, selectedBars: [0, 1] });
    expect(text).toContain('// track 1, bar 1');
    expect(text).toContain('// track 1, bar 2');
    expect(text).toContain('// track 2, bar 2');
    expect(text).not.toContain('track 2, bar 3');
    expect(text).toContain('Tracks: 2. Shown: track 2.');
    expect(text).toContain('The cursor is in bar 1.');
    expect(text).toContain('Selected: bars 1 to 2 of track 2.');
    expect(describeArrangement(FOUR, SPOT)).toContain('Nothing is selected.');
  });

  it('reads back as the same clip: the numbers are comments', async () => {
    const result = await read(describeArrangement(FOUR, SPOT).split('\n\n')[0]);
    expect(result.ok && writeAlphaTex(result.clip)).toBe(writeAlphaTex(FOUR));
  });

  it('writes the clip as writeAlphaTex did before it was split into tracks and bars', () => {
    expect(writeAlphaTex(TWO_TRACKS)).toMatch(/^\\title "Duo"\n\\track "Lead"\n/);
  });
});

describe('replace_bars', () => {
  it('replaces a run of bars with as many, more or fewer', async () => {
    const same = await runTool('replace_bars', JSON.stringify({ track: 1, first_bar: 2, last_bar: 3, alphatex: ':2 12.6 12.5 | :1 0.4 |' }), { clip: FOUR, spot: SPOT, read });
    expect(same.clip && bars(same.clip)).toBe(4);
    expect(same.note).toBe('Changed bars 2 to 3 of track 1');
    const fewer = await runTool('replace_bars', JSON.stringify({ track: 1, first_bar: 2, last_bar: 4, alphatex: ':1 0.4 |' }), { clip: FOUR, spot: SPOT, read });
    expect(fewer.clip && bars(fewer.clip)).toBe(2);
    const deleted = await runTool('replace_bars', JSON.stringify({ track: 1, first_bar: 4, last_bar: 4, alphatex: '' }), { clip: FOUR, spot: SPOT, read });
    expect(deleted.clip && bars(deleted.clip)).toBe(3);
    expect(deleted.answer).toContain('track 1: 3 bars');
    expect(deleted.note).toBe('Changed bar 4 of track 1');
  });

  it('inserts before bar N with last_bar N-1, and after the last bar', async () => {
    const before = await runTool('replace_bars', JSON.stringify({ track: 1, first_bar: 1, last_bar: 0, alphatex: ':1 9.6 |' }), { clip: FOUR, spot: SPOT, read });
    expect(before.clip && bars(before.clip)).toBe(5);
    expect(before.note).toBe('Inserted bars before bar 1 of track 1');
    expect(before.clip && writeAlphaTex(before.clip)).toMatch(/9\.6/);
    const after = spliceBars(FOUR, 1, 5, 4, ':1 9.6 |');
    expect('text' in after && after.text.trimEnd().endsWith(':1 9.6 |')).toBe(true);
  });

  it('changes only the track asked for', async () => {
    const out = await runTool('replace_bars', JSON.stringify({ track: 2, first_bar: 2, last_bar: 2, alphatex: ':1 5.6 |' }), { clip: TWO_TRACKS, spot: SPOT, read });
    expect(out.clip && writeAlphaTex(out.clip)).toContain('5.6');
    expect(out.clip?.tracks[0]).toEqual(TWO_TRACKS.tracks[0]);
  });

  it('refuses bars or a track that is not there, changing nothing', async () => {
    for (const args of [
      { track: 3, first_bar: 1, last_bar: 1, alphatex: '' },
      { track: 1, first_bar: 6, last_bar: 6, alphatex: '' },
      { track: 1, first_bar: 3, last_bar: 1, alphatex: '' },
      { track: 1, first_bar: 0, last_bar: 1, alphatex: '' },
      { track: 1, first_bar: 1.5, last_bar: 2, alphatex: '' },
    ]) {
      const out = await runTool('replace_bars', JSON.stringify(args), { clip: FOUR, spot: SPOT, read });
      expect(out.failed, JSON.stringify(args)).toBe(true);
      expect(out.clip).toBeUndefined();
      expect(out.answer).toContain('Nothing changed.');
    }
  });

  it('sends the reader’s errors back for text it can’t read, and changes nothing', async () => {
    const out = await runTool('replace_bars', JSON.stringify({ track: 1, first_bar: 1, last_bar: 1, alphatex: ':4 (( 0.6 |' }), { clip: FOUR, spot: SPOT, read });
    expect(out.failed).toBe(true);
    expect(out.clip).toBeUndefined();
    expect(out.answer).toMatch(/^Not valid alphaTex, so nothing changed\. Errors:\n- /);
    expect(out.note).toBe('Tried: changed bar 1 of track 1, but the alphaTex had errors');
  });

  it('refuses missing or mistyped arguments, and arguments that are not JSON', async () => {
    expect((await runTool('replace_bars', JSON.stringify({ track: '1', first_bar: 1, last_bar: 1, alphatex: '' }), { clip: FOUR, spot: SPOT, read })).failed).toBe(true);
    expect((await runTool('replace_bars', '{"track": 1', { clip: FOUR, spot: SPOT, read })).answer).toBe('Your arguments were not valid JSON; nothing changed.');
    expect((await runTool('play_it', '{}', { clip: FOUR, spot: SPOT, read })).answer).toBe('There is no tool called play_it.');
  });
});

describe('replace_arrangement', () => {
  it('takes the whole text; with no \\title the arrangement keeps its title', async () => {
    const out = await runTool('replace_arrangement', JSON.stringify({ alphatex: ':1 0.6 |' }), { clip: FOUR, spot: SPOT, read });
    expect(out.clip?.name).toBe('Four');
    expect(out.clip && bars(out.clip)).toBe(1);
    const named = await runTool('replace_arrangement', JSON.stringify({ alphatex: '\\title "New"\n:1 0.6 |' }), { clip: FOUR, spot: SPOT, read });
    expect(named.clip?.name).toBe('New');
  });

  it('refuses text it can’t read', async () => {
    const out = await runTool('replace_arrangement', JSON.stringify({ alphatex: '\\nonsense ((' }), { clip: FOUR, spot: SPOT, read });
    expect(out.failed).toBe(true);
    expect(out.clip).toBeUndefined();
  });

  it('declares three tools, each taking no other arguments', () => {
    expect(TOOLS.map(t => t.function.name)).toEqual(['read_arrangement', 'replace_bars', 'replace_arrangement']);
    for (const t of TOOLS) expect(t.function.parameters.additionalProperties).toBe(false);
  });
});

describe('one reply', () => {
  /** A model that answers with each of `turns` in order, and the requests it was sent. */
  const scripted = (...turns: Awaited<ReturnType<Complete>>['message'][]) => {
    const sent: CompletionRequest[] = [];
    const complete: Complete = async request => {
      sent.push({ ...request, messages: [...request.messages] });
      const message = turns[Math.min(sent.length - 1, turns.length - 1)];
      return { message, model: request.model, usage: { promptTokens: 100, completionTokens: 10, cost: 0.002 } };
    };
    return { complete, sent };
  };
  const call = (id: string, name: string, args: object) => ({ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } });

  it('runs the tools the model calls, sends their answers back, and ends with its words', async () => {
    const { complete, sent } = scripted(
      { role: 'assistant', content: null, tool_calls: [call('a', 'read_arrangement', {}), call('b', 'replace_bars', { track: 1, first_bar: 1, last_bar: 1, alphatex: ':1 12.6 |' })] },
      { role: 'assistant', content: 'Bar 1 is now one long note.' },
    );
    let clip = FOUR;
    const changes: Clip[] = [];
    const result = await runReply({
      complete, apiKey: 'k', model: 'm', messages: [{ role: 'user', content: 'Make bar 1 one note' }],
      current: () => ({ clip, spot: SPOT }), read,
      onClip: next => { changes.push(next); clip = next; },
    });
    expect(result.text).toBe('Bar 1 is now one long note.');
    expect(result.notes.map(n => n.text)).toEqual(['Read the arrangement', 'Changed bar 1 of track 1']);
    expect(changes).toHaveLength(1);
    expect(sent).toHaveLength(2);
    // The second request carries both tools' answers, by their calls' ids.
    const answers = sent[1].messages.filter(m => m.role === 'tool');
    expect(answers.map(m => m.role === 'tool' && m.tool_call_id)).toEqual(['a', 'b']);
    expect(answers[0].content).toContain('// track 1, bar 4');
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 20, cost: 0.004 });
    expect(sent[0].tools).toBe(TOOLS);
  });

  it('stops a model that keeps calling tools after MAX_STEPS calls', async () => {
    const { complete, sent } = scripted({ role: 'assistant', content: null, tool_calls: [call('x', 'read_arrangement', {})] });
    await expect(runReply({ complete, apiKey: 'k', model: 'm', messages: [], current: () => ({ clip: FOUR, spot: SPOT }), read, onClip: () => {} }))
      .rejects.toThrow(`stopped after ${MAX_STEPS} calls`);
    expect(sent).toHaveLength(MAX_STEPS);
  });

  it('stops when the viewer presses Stop', async () => {
    const stop = new AbortController();
    const complete: Complete = async () => {
      stop.abort();
      return { message: { role: 'assistant', content: null, tool_calls: [call('x', 'replace_bars', { track: 1, first_bar: 1, last_bar: 1, alphatex: '' })] }, model: 'm', usage: {} };
    };
    const onClip = vi.fn();
    await expect(runReply({ complete, apiKey: 'k', model: 'm', messages: [], current: () => ({ clip: FOUR, spot: SPOT }), read, onClip, signal: stop.signal })).rejects.toThrow();
    expect(onClip).not.toHaveBeenCalled();
  });

  it('puts the agent guide after its own instructions', () => {
    expect(systemPrompt('GUIDE TEXT')).toMatch(/Frets[\s\S]*Undo[\s\S]*\n\nGUIDE TEXT$/);
  });
});

describe('OpenRouter', () => {
  it('reads the first choice, its tool calls and what it cost', () => {
    const answer = readCompletion({
      model: 'anthropic/claude-opus-5.5',
      choices: [{ message: { content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'read_arrangement', arguments: '{}' } }, { bad: true }] } }],
      usage: { prompt_tokens: 1200, completion_tokens: 30, cost: 0.0123 },
    }, 'asked');
    expect(answer.model).toBe('anthropic/claude-opus-5.5');
    expect(answer.message.tool_calls).toHaveLength(1);
    expect(answer.usage).toEqual({ promptTokens: 1200, completionTokens: 30, cost: 0.0123 });
    const plain = readCompletion({ choices: [{ message: { content: 'Hi' } }] }, 'asked');
    expect(plain).toEqual({ message: { role: 'assistant', content: 'Hi' }, model: 'asked', usage: { promptTokens: undefined, completionTokens: undefined, cost: undefined } });
  });

  it('fails clearly with no choice, and says what a failed status means', () => {
    expect(() => readCompletion({ error: { message: 'Provider down' } }, 'm')).toThrow(new ChatError('The model sent no answer: Provider down'));
    expect(errorText(401, { error: { message: 'No auth' } })).toBe('OpenRouter didn\'t accept the key in Settings › Tab › Chat: No auth');
    expect(errorText(402, null)).toBe('The OpenRouter account is out of credit');
    expect(errorText(500, {})).toBe('OpenRouter answered 500');
  });

  it('counts a note repeated in a row once', () => {
    const read = { text: 'Read the arrangement' };
    const failed = { text: 'Read the arrangement', failed: true };
    expect(runsOf([read, read, read, failed, read]).map(r => [r.note.text, !!r.note.failed, r.count]))
      .toEqual([['Read the arrangement', false, 3], ['Read the arrangement', true, 1], ['Read the arrangement', false, 1]]);
  });

  it('shows the model, tokens and cost under a reply', () => {
    expect(usageLine('m', { promptTokens: 12345, completionTokens: 67, cost: 0.0042 })).toBe('m · 12,345 in, 67 out · $0.0042');
    expect(usageLine('m', { cost: 0.25 })).toBe('m · $0.25');
    expect(usageLine('m', {})).toBe('m');
  });
});

describe('Settings › Tab › Chat', () => {
  it('keeps a key and model as saved, trimmed, and falls back to Opus 5.5', () => {
    expect(CHAT_KEY).toBe('frets.tab.chat');
    expect(parseChatPrefs({ apiKey: ' sk-or-1 ', model: ' openai/gpt-5 ' })).toEqual({ apiKey: 'sk-or-1', model: 'openai/gpt-5' });
    expect(parseChatPrefs(null)).toEqual(DEFAULT_CHAT);
    expect(parseChatPrefs({ apiKey: 3, model: '  ' })).toEqual({ apiKey: '', model: DEFAULT_MODEL });
    expect(DEFAULT_MODEL).toBe('anthropic/claude-opus-5.5');
  });

  it('shows the panel only for ?chat', () => {
    expect(readChatParam('?chat')).toBe(true);
    expect(readChatParam('?theme=light&chat=1')).toBe(true);
    expect(readChatParam('')).toBe(false);
    expect(readChatParam('?chats')).toBe(false);
  });
});

describe('a reply’s changes are one Undo step', () => {
  const start: ClipState = { id: 'a', clip: FOUR, base: FOUR, past: [], future: [] };
  const one = clipOf(':1 0.6 |');
  const two = clipOf(':1 1.6 |');

  it('joins an amend to the step before it; Undo goes back past both', () => {
    let state = clipReducer(start, { type: 'replace', clip: one });
    state = clipReducer(state, { type: 'amend', clip: two });
    expect(state.clip).toBe(two);
    expect(state.past).toEqual([FOUR]);
    state = clipReducer(state, { type: 'undo' });
    expect(state.clip).toBe(FOUR);
    state = clipReducer(state, { type: 'redo' });
    expect(state.clip).toBe(two);
  });

  it('makes an amend with no step before it a step of its own, and clears redo', () => {
    const state = clipReducer(start, { type: 'amend', clip: one });
    expect(state.past).toEqual([FOUR]);
    const undone = clipReducer(clipReducer(state, { type: 'replace', clip: two }), { type: 'undo' });
    expect(clipReducer(undone, { type: 'amend', clip: two }).future).toEqual([]);
  });
});
