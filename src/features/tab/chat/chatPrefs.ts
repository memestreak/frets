/**
 * The Chat panel's Settings section, Tab › Chat (`docs/specs/2026-11-08-tab-chat-design.md`): the
 * OpenRouter key the page calls models with, and the model it calls. Saved on this device only, under
 * `frets.tab.chat`; the key never goes into a link.
 */

export const CHAT_KEY = 'frets.tab.chat';

/** OpenRouter's name for Claude Opus 5.5, the model a first visit calls (issue #424, Q5). */
export const DEFAULT_MODEL = 'anthropic/claude-opus-5.5';

export interface ChatPrefs {
  /** The viewer's OpenRouter key, or '' for none. */
  apiKey: string;
  /** An OpenRouter model id, as `anthropic/claude-opus-5.5`. */
  model: string;
}

export const DEFAULT_CHAT: ChatPrefs = { apiKey: '', model: DEFAULT_MODEL };

/** `frets.tab.chat` as saved: each field kept when it is a string, else its default. */
export function parseChatPrefs(raw: unknown): ChatPrefs {
  const saved = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const apiKey = typeof saved.apiKey === 'string' ? saved.apiKey.trim() : DEFAULT_CHAT.apiKey;
  const model = typeof saved.model === 'string' && saved.model.trim() ? saved.model.trim() : DEFAULT_CHAT.model;
  return { apiKey, model };
}

/** The query parameter that shows the Chat panel while it is unfinished (Q8): `/tab?chat`. */
export const CHAT_PARAM = 'chat';

/** Whether the address asks for the Chat panel: `?chat`, with any value or none. */
export function readChatParam(search: string): boolean {
  return new URLSearchParams(search).has(CHAT_PARAM);
}
