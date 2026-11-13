/**
 * The Chat panel's one way out: OpenRouter's chat completions, called straight from the browser with
 * the viewer's own key (`docs/specs/2026-11-08-tab-chat-design.md`). OpenRouter answers browsers from any
 * site (tested 2026-11-08), so Frets needs no server of its own for it. Its OpenAI-style format reaches
 * every model by name, for comparing models (issue #424, Q9).
 */
import type { ToolDef } from './arrangementTools';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const PRESETS_URL = 'https://openrouter.ai/api/v1/presets';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * A part of a viewer's message with images (issue #465): its text, or one image as a `data:` URL, in
 * OpenRouter's OpenAI-style form. A message without images is a plain string.
 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** What a call cost, as OpenRouter reports it; any part may be missing. */
export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  /** Of `promptTokens`, those read from the provider's cache, at a fraction of the price. */
  cachedTokens?: number;
  /** In US dollars. */
  cost?: number;
}

export interface Completion {
  message: Extract<ChatMessage, { role: 'assistant' }>;
  /** The model that answered, which OpenRouter may name more fully than asked. */
  model: string;
  usage: Usage;
}

/** One request: the conversation so far, the tools, and the model. */
export interface CompletionRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  signal?: AbortSignal;
}

export type Complete = (request: CompletionRequest) => Promise<Completion>;

/** A failed call, with what to tell the viewer. */
export class ChatError extends Error {}

/** Asks OpenRouter for the model's next message. */
export const completeWithOpenRouter: Complete = async ({ apiKey, model, messages, tools, signal }) => {
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // How OpenRouter names the app in its activity list.
        'X-Title': 'Frets',
      },
      body: JSON.stringify({ model, messages: wireMessages(messages), tools, usage: { include: true } }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ChatError('Couldn\'t reach OpenRouter. Check the connection and try again.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ChatError(errorText(response.status, body));
  return readCompletion(body, model);
};

/**
 * The messages as sent: the system prompt (the instructions and the whole alphaTex guide, most of every
 * request) marked for the provider to cache, so the calls after the first, within a reply and for some
 * minutes after, pay a fraction for it. Claude and Gemini cache only what is marked; OpenRouter drops the
 * mark for providers that cache on their own or not at all.
 */
export function wireMessages(messages: readonly ChatMessage[]): unknown[] {
  return messages.map(m => (m.role === 'system'
    ? { role: 'system', content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] }
    : m));
}

/** What the viewer is told for a failed call. */
export function errorText(status: number, body: unknown): string {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  const said = typeof message === 'string' && message ? `: ${message}` : '';
  if (status === 401) return `OpenRouter didn't accept the key in Settings › Tab › Chat${said}`;
  if (status === 402) return `The OpenRouter account is out of credit${said}`;
  if (status === 429) return `OpenRouter says to slow down; try again in a moment${said}`;
  return `OpenRouter answered ${status}${said}`;
}

/** The answer's first choice as a message, or a ChatError when it has none. */
export function readCompletion(body: unknown, asked: string): Completion {
  const data = body as {
    model?: unknown;
    choices?: { message?: { content?: unknown; tool_calls?: unknown } }[];
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown; prompt_tokens_details?: { cached_tokens?: unknown } };
    error?: { message?: unknown };
  } | null;
  const message = data?.choices?.[0]?.message;
  if (!message) {
    const said = typeof data?.error?.message === 'string' ? `: ${data.error.message}` : '';
    throw new ChatError(`The model sent no answer${said}`);
  }
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls.filter(isToolCall) : [];
  const number = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : undefined);
  return {
    message: {
      role: 'assistant',
      content: typeof message.content === 'string' ? message.content : null,
      ...(calls.length > 0 ? { tool_calls: calls } : {}),
    },
    model: typeof data?.model === 'string' ? data.model : asked,
    usage: {
      promptTokens: number(data?.usage?.prompt_tokens), completionTokens: number(data?.usage?.completion_tokens),
      cachedTokens: number(data?.usage?.prompt_tokens_details?.cached_tokens), cost: number(data?.usage?.cost),
    },
  };
}

function isToolCall(call: unknown): call is ToolCall {
  const c = call as ToolCall | null;
  return !!c && typeof c.id === 'string' && typeof c.function?.name === 'string';
}

/** A model OpenRouter offers: its id, and whether it reads images (issue #465). */
export interface ModelInfo {
  id: string;
  images: boolean;
}

/** The models OpenRouter offers that take tools, by id, or null when the list can't be had. */
export async function fetchToolModels(signal?: AbortSignal): Promise<ModelInfo[] | null> {
  try {
    const response = await fetch(MODELS_URL, { signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { id?: unknown; supported_parameters?: unknown; architecture?: { input_modalities?: unknown } }[] };
    return (body.data ?? [])
      .filter(m => typeof m.id === 'string' && (!Array.isArray(m.supported_parameters) || m.supported_parameters.includes('tools')))
      .map(m => {
        const inputs = m.architecture?.input_modalities;
        // A model whose inputs aren't listed is taken to read images: only a list without `image` says it can't.
        return { id: m.id as string, images: !Array.isArray(inputs) || inputs.includes('image') };
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  } catch {
    return null;
  }
}

/**
 * Whether the model can't read images, as far as OpenRouter's list says: true only for a model listed
 * without image input. A preset, or a model not in the list (or no list), isn't known, so isn't flagged.
 */
export function knownBlind(model: string, models: readonly ModelInfo[]): boolean {
  return models.find(m => m.id === model)?.images === false;
}

/** A preset saved on OpenRouter: a model with its settings, named by slug, used as the model `@preset/<slug>`. */
export interface Preset {
  model: string;
  description: string;
}

/**
 * The viewer's active presets as models (`@preset/<slug>`), newest first, or null when the list can't be had.
 * Listing them needs the viewer's key (tested 2026-11-08: an ordinary key lists them, and browsers may ask).
 */
export async function fetchPresets(apiKey: string, signal?: AbortSignal): Promise<Preset[] | null> {
  try {
    const response = await fetch(PRESETS_URL, { headers: { Authorization: `Bearer ${apiKey}` }, signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { slug?: unknown; description?: unknown; name?: unknown; status?: unknown }[] };
    return (body.data ?? [])
      .filter(p => typeof p.slug === 'string' && p.slug !== '' && (p.status === undefined || p.status === 'active'))
      .map(p => ({
        model: `@preset/${p.slug as string}`,
        description: typeof p.description === 'string' && p.description.trim() ? p.description.trim() : typeof p.name === 'string' ? p.name : '',
      }));
  } catch {
    return null;
  }
}
