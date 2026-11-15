/**
 * One reply in the Chat panel (`docs/specs/2026-11-08-tab-chat-design.md`): the model is asked, runs
 * the tools it calls on the arrangement, and is asked again with their answers, until it answers in
 * words or `MAX_STEPS` calls have been made. Every change goes to the page as it is made; the page
 * makes the reply's changes one Undo step (Q3).
 */
import { runTool, TOOLS, type PageSpot, type ToolContext, type ToolDef } from './arrangementTools';
import { ChatError, type ChatMessage, type Complete, type ContentPart, type Exchange, type ToolCall, type Usage } from './openRouter';
import type { Clip } from '../clip';
import { DEFAULT_CHAT, instructionsOf, type ChatPrefs } from './chatPrefs';

/** The most model calls one reply makes, so a model that keeps calling tools stops. */
export const MAX_STEPS = 12;

/**
 * One model call of a reply, as the advanced view shows it (issue #495): what was asked, what came back,
 * and what each tool the model called answered it. Kept whether or not the view is on (Q7).
 */
export interface CallRecord {
  request: { model: string; messages: ChatMessage[]; tools: ToolDef[] };
  /** The index of the first message new since the reply's previous call (for its first call, the viewer's message). */
  newFrom: number;
  exchange?: Exchange;
  /** The model's message, when one came. */
  answer?: Extract<ChatMessage, { role: 'assistant' }>;
  /** The model that answered and the call's own usage, when an answer came. */
  model?: string;
  usage?: Usage;
  /** Each tool call the model made, with its arguments as sent and the tool's answer. */
  results: { call: ToolCall; answer: string; failed?: boolean }[];
  /** Why the call failed, when it did. */
  error?: string;
}

/** What the panel shows of a reply: its text, what its tools did, and what it cost. */
export interface ReplyResult {
  /** The messages the reply added to the conversation: the model's and the tools'. */
  messages: ChatMessage[];
  text: string;
  notes: { text: string; failed?: boolean }[];
  model: string;
  usage: Usage;
  /** Each model call, in order (issue #495). */
  calls: CallRecord[];
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
  /** The calls so far, each time one is made, answered or fails, for the advanced view. */
  onCalls?: (calls: CallRecord[]) => void;
  signal?: AbortSignal;
}

export async function runReply(options: ReplyOptions): Promise<ReplyResult> {
  const { complete, apiKey, model, current, read, onClip, onNote, onCalls, signal } = options;
  const added: ChatMessage[] = [];
  const notes: ReplyResult['notes'] = [];
  const usage: Usage = {};
  const calls: CallRecord[] = [];
  /** Replaces the newest call's record with `record`, and tells the panel. */
  const record = (changed: CallRecord) => {
    calls[calls.length - 1] = changed;
    onCalls?.([...calls]);
  };
  let answeredBy = model;
  for (let step = 0; step < MAX_STEPS; step++) {
    const messages = [...options.messages, ...added];
    const previous = calls.at(-1)?.request.messages.length;
    calls.push({ request: { model, messages, tools: TOOLS }, newFrom: previous ?? messages.length - 1, results: [] });
    onCalls?.([...calls]);
    let answer;
    try {
      answer = await complete({ apiKey, model, messages, tools: TOOLS, signal });
    } catch (e) {
      const error = signal?.aborted ? 'Stopped.' : e instanceof Error ? e.message : 'Something went wrong.';
      record({ ...calls[calls.length - 1], error, ...(e instanceof ChatError && e.exchange ? { exchange: e.exchange } : {}) });
      throw e;
    }
    answeredBy = answer.model;
    addUsage(usage, answer.usage);
    added.push(answer.message);
    let call: CallRecord = { ...calls[calls.length - 1], answer: answer.message, model: answer.model, usage: answer.usage, exchange: answer.exchange };
    record(call);
    const toolCalls = answer.message.tool_calls ?? [];
    if (toolCalls.length === 0) return { messages: added, text: answer.message.content ?? '', notes, model: answeredBy, usage, calls };
    for (const toolCall of toolCalls) {
      signal?.throwIfAborted();
      const { clip, spot } = current();
      const outcome = await runTool(toolCall.function.name, toolCall.function.arguments, { clip, spot, read });
      if (outcome.clip) onClip(outcome.clip);
      const note = { text: outcome.note, ...(outcome.failed ? { failed: true } : {}) };
      notes.push(note);
      onNote?.(note);
      added.push({ role: 'tool', tool_call_id: toolCall.id, content: outcome.answer });
      call = { ...call, results: [...call.results, { call: toolCall, answer: outcome.answer, ...(outcome.failed ? { failed: true } : {}) }] };
      record(call);
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

/**
 * A viewer's message as the model gets it (issue #465): the text alone, or, with images, the text then
 * each image as a part of its own, in the order they were added.
 */
export function userContent(text: string, images: readonly { url: string }[]): string | ContentPart[] {
  if (images.length === 0) return text;
  return [{ type: 'text', text }, ...images.map(({ url }) => ({ type: 'image_url' as const, image_url: { url } }))];
}

/** The text of an ask sent with images and no words, so the model is told what they are for. */
export const IMAGES_ONLY_ASK = 'Transcribe the attached image into the arrangement.';

/** The heading over the viewer's own prompt, so the model reads it as theirs and apart from the guide. */
export const CUSTOM_HEADING = "The guitarist's own instructions:";

/**
 * The system prompt (`docs/specs/2026-11-09-tab-chat-prompt-design.md`): the instructions (the viewer's
 * or the default), then the agent guide to Frets' alphaTex, always, then the viewer's own prompt, if any,
 * last, where a model gives it most weight.
 */
export function systemPrompt(guide: string, prompts: Pick<ChatPrefs, 'instructions' | 'custom'> = DEFAULT_CHAT): string {
  const custom = prompts.custom.trim() ? `${CUSTOM_HEADING}\n${prompts.custom}` : '';
  // Instructions cleared to nothing send nothing; the guide is always there.
  return [instructionsOf(prompts), guide, custom].filter(part => part.trim()).join('\n\n');
}
