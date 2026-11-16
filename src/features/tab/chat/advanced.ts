/**
 * What the Chat panel's advanced view (issue #495) shows of a model call, as plain text: a message's
 * first line, a call's summary, JSON pretty-printed with every pasted image cut down to its type and size.
 */
import type { ChatMessage } from './openRouter';
import type { CallRecord } from './reply';

/** A `data:` URL longer than this is shown by its type and size, not its bytes. */
const LONG_DATA_URL = 120;

/** A `data:` URL as the view shows it: `data:image/png;base64,… (412 KB)`. */
export function shortDataUrl(url: string): string {
  const comma = url.indexOf(',');
  const head = comma >= 0 ? url.slice(0, comma + 1) : url.slice(0, 40);
  return `${head}… (${sizeText(url.length)})`;
}

/** A size in characters as bytes, kilobytes or megabytes, as `412 KB`. */
function sizeText(chars: number): string {
  if (chars < 1024) return `${chars} B`;
  if (chars < 1024 * 1024) return `${Math.round(chars / 1024)} KB`;
  return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
}

/** `value` with every long `data:` URL in it shortened, at any depth; everything else as it is. */
export function withShortImages(value: unknown): unknown {
  if (typeof value === 'string') return value.startsWith('data:') && value.length > LONG_DATA_URL ? shortDataUrl(value) : value;
  if (Array.isArray(value)) return value.map(withShortImages);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withShortImages(v)]));
  }
  return value;
}

/** JSON as the view shows it: two-space indents, images shortened. A string that isn't JSON shows as it is. */
export function shownJson(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(withShortImages(value), null, 2) ?? String(value);
}

/** A tool call's arguments pretty-printed when they are JSON, else as the model sent them. */
export function shownArguments(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
}

/** A message's words, with each image in it named by its size, as `[image, 412 KB]`. */
export function messageText(message: ChatMessage): string {
  const { content } = message;
  if (content === null) return '';
  if (typeof content === 'string') return content;
  return content.map(part => (part.type === 'text' ? part.text : `[image, ${sizeText(part.image_url.url.length)}]`)).join('\n\n');
}

/** The first line of a text, cut to `max` characters with an ellipsis; '' stays ''. */
export function firstLine(text: string, max = 48): string {
  const line = text.trimStart().split('\n', 1)[0] ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** A message's heading in a request's list: its role, then what it begins with. */
export function messageHeading(message: ChatMessage): string {
  if (message.role === 'assistant' && message.tool_calls?.length) {
    const names = message.tool_calls.map(c => c.function.name).join(', ');
    const said = firstLine(message.content ?? '');
    return `assistant · calls ${names}${said ? ` · ${said}` : ''}`;
  }
  const said = firstLine(messageText(message));
  return said ? `${message.role} · ${said}` : message.role;
}

/** A call's heading: its number, the model that answered, its tokens and how long it took, or that it failed. */
export function callHeading(call: CallRecord, index: number): string {
  const parts = [`Call ${index + 1}`, call.model ?? call.request.model];
  const { usage } = call;
  if (usage && (usage.promptTokens !== undefined || usage.completionTokens !== undefined)) {
    parts.push(`${(usage.promptTokens ?? 0).toLocaleString('en')} in, ${(usage.completionTokens ?? 0).toLocaleString('en')} out`);
  }
  if (call.exchange) parts.push(`${(call.exchange.ms / 1000).toFixed(1)} s`);
  if (call.error) parts.push('failed');
  else if (!call.answer) parts.push('waiting');
  return parts.join(' · ');
}
