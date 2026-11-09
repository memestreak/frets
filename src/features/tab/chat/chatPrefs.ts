/**
 * The Chat panel's Settings section, Tab › Chat (`docs/specs/2026-11-08-tab-chat-design.md`): the
 * OpenRouter key the page calls models with, the model it calls, and the system prompt's two editable
 * parts (`docs/specs/2026-11-09-tab-chat-prompt-design.md`, issue #426). Saved on this device only,
 * under `frets.tab.chat`; the key never goes into a link.
 */

export const CHAT_KEY = 'frets.tab.chat';

/** OpenRouter's name for Claude Opus 5.5, the model a first visit calls (issue #424, Q5). */
export const DEFAULT_MODEL = 'anthropic/claude-opus-5.5';

/** The system prompt's own instructions, sent before the agent guide unless the viewer edits them. */
export const DEFAULT_INSTRUCTIONS = [
  'You are helping a guitarist with the arrangement open on the Tab page of Frets, a guitar app.',
  'They may ask you to analyse it (harmony, rhythm, technique, playability) or to change it.',
  'Each message from the viewer ends with the arrangement as it was when they sent it, as read_arrangement gives it, so you needn\'t read it first.',
  'Read it again with read_arrangement after a change, or if they may have edited it since.',
  'Change it only when asked, with replace_bars for a run of bars or replace_arrangement for anything else.',
  'Every change you make in one reply is undone together by one Undo, so make the whole change the viewer asked for.',
  'The arrangement comes with the problems Frets marks on it; mention any that bear on what was asked, and fix them only when asked.',
  'Answer briefly. Your answer is shown as markdown: use short lists, a small table or `code` where they help (HTML shows as text). Name bars by number. Do not paste alphaTex into your answer unless asked.',
  'Frets writes alphaTex as the guide below describes.',
].join('\n');

export interface ChatPrefs {
  /** The viewer's OpenRouter key, or '' for none. */
  apiKey: string;
  /** An OpenRouter model id, as `anthropic/claude-opus-5.5`. */
  model: string;
  /**
   * The instructions as the viewer edited them, or `null` for `DEFAULT_INSTRUCTIONS`. Kept only while
   * they differ from the default (Q4), so a later change to the default reaches everyone who didn't edit it.
   */
  instructions: string | null;
  /** The viewer's own prompt, sent last, after the agent guide (Q3); '' for none. */
  custom: string;
}

export const DEFAULT_CHAT: ChatPrefs = { apiKey: '', model: DEFAULT_MODEL, instructions: null, custom: '' };

/** The instructions sent: the viewer's, or the default. */
export function instructionsOf(prefs: Pick<ChatPrefs, 'instructions'>): string {
  return prefs.instructions ?? DEFAULT_INSTRUCTIONS;
}

/** The instructions to keep for a text: `null` when it is the default, so only an edit is saved. */
export function keptInstructions(text: string): string | null {
  return text === DEFAULT_INSTRUCTIONS ? null : text;
}

/**
 * `frets.tab.chat` as saved: each field kept when it is a string, else its default. The prompts are
 * kept as typed (never trimmed); instructions equal to the default read as `null`.
 */
export function parseChatPrefs(raw: unknown): ChatPrefs {
  const saved = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const apiKey = typeof saved.apiKey === 'string' ? saved.apiKey.trim() : DEFAULT_CHAT.apiKey;
  const model = typeof saved.model === 'string' && saved.model.trim() ? saved.model.trim() : DEFAULT_CHAT.model;
  const instructions = typeof saved.instructions === 'string' ? keptInstructions(saved.instructions) : DEFAULT_CHAT.instructions;
  const custom = typeof saved.custom === 'string' ? saved.custom : DEFAULT_CHAT.custom;
  return { apiKey, model, instructions, custom };
}
