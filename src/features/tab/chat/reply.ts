/**
 * One reply in the Chat panel (`docs/specs/2026-11-08-tab-chat-design.md`): the model is asked, runs
 * the tools it calls on the arrangement, and is asked again with their answers, until it answers in
 * words or `MAX_STEPS` calls have been made. Every change goes to the page as it is made; the page
 * makes the reply's changes one Undo step (Q3).
 */
import { runTool, TOOLS, type PageSpot, type ToolContext } from './arrangementTools';
import { ChatError, type ChatMessage, type Complete, type Usage } from './openRouter';
import type { Clip } from '../clip';

/** The most model calls one reply makes, so a model that keeps calling tools stops. */
export const MAX_STEPS = 12;

/** What the panel shows of a reply: its text, what its tools did, and what it cost. */
export interface ReplyResult {
  /** The messages the reply added to the conversation: the model's and the tools'. */
  messages: ChatMessage[];
  text: string;
  notes: { text: string; failed?: boolean }[];
  model: string;
  usage: Usage;
}

export interface ReplyOptions {
  complete: Complete;
  apiKey: string;
  model: string;
  /** The system prompt, then the conversation so far, ending with the viewer's message. */
  messages: ChatMessage[];
  /** The clip and the viewer's place now: read again before each tool call, as the viewer may edit meanwhile. */
  current: () => { clip: Clip; spot: PageSpot };
  read: ToolContext['read'];
  /** A tool changed the clip. */
  onClip: (clip: Clip) => void;
  /** Something new to show while the reply goes on. */
  onNote?: (note: { text: string; failed?: boolean }) => void;
  signal?: AbortSignal;
}

export async function runReply(options: ReplyOptions): Promise<ReplyResult> {
  const { complete, apiKey, model, current, read, onClip, onNote, signal } = options;
  const added: ChatMessage[] = [];
  const notes: ReplyResult['notes'] = [];
  const usage: Usage = {};
  let answeredBy = model;
  for (let step = 0; step < MAX_STEPS; step++) {
    const answer = await complete({ apiKey, model, messages: [...options.messages, ...added], tools: TOOLS, signal });
    answeredBy = answer.model;
    addUsage(usage, answer.usage);
    added.push(answer.message);
    const calls = answer.message.tool_calls ?? [];
    if (calls.length === 0) return { messages: added, text: answer.message.content ?? '', notes, model: answeredBy, usage };
    for (const call of calls) {
      signal?.throwIfAborted();
      const { clip, spot } = current();
      const outcome = await runTool(call.function.name, call.function.arguments, { clip, spot, read });
      if (outcome.clip) onClip(outcome.clip);
      const note = { text: outcome.note, ...(outcome.failed ? { failed: true } : {}) };
      notes.push(note);
      onNote?.(note);
      added.push({ role: 'tool', tool_call_id: call.id, content: outcome.answer });
    }
  }
  // The changes made so far stay, and Undo takes them back.
  throw new ChatError(`The model kept calling tools; stopped after ${MAX_STEPS} calls.`);
}

function addUsage(total: Usage, more: Usage) {
  for (const key of ['promptTokens', 'completionTokens', 'cachedTokens', 'cost'] as const) {
    if (more[key] !== undefined) total[key] = (total[key] ?? 0) + more[key];
  }
}

/** The viewer's message as the request carries it: the ask, then the arrangement as it is now. */
export function askWithArrangement(ask: string, arrangement: string): string {
  return `${ask}\n\n<arrangement>\n${arrangement}\n</arrangement>`;
}

/** The system prompt: what the panel is for, then the agent guide to Frets' alphaTex. */
export function systemPrompt(guide: string): string {
  return [
    'You are helping a guitarist with the arrangement open on the Tab page of Frets, a guitar app.',
    'They may ask you to analyse it (harmony, rhythm, technique, playability) or to change it.',
    'Each message from the viewer ends with the arrangement as it was when they sent it, as read_arrangement gives it, so you needn\'t read it first.',
    'Read it again with read_arrangement after a change, or if they may have edited it since.',
    'Change it only when asked, with replace_bars for a run of bars or replace_arrangement for anything else.',
    'Every change you make in one reply is undone together by one Undo, so make the whole change the viewer asked for.',
    'The arrangement comes with the problems Frets marks on it; mention any that bear on what was asked, and fix them only when asked.',
    'Answer briefly. Your answer is shown as markdown: use short lists, a small table or `code` where they help (HTML shows as text). Name bars by number. Do not paste alphaTex into your answer unless asked.',
    'Frets writes alphaTex as the guide below describes.',
    '',
    guide,
  ].join('\n');
}
