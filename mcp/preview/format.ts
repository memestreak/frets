/**
 * How the stand-in host's log shows MCP messages (`preview.ts`): each entry's title, the sections a
 * message splits into, and the JSON in them. Pure, so it is tested on its own (`src/__tests__/mcp/previewFormat.test.ts`).
 */

/** A log line: the MCP method, then what it's about, e.g. `tools/call · show_tab #2 (~180 tokens)`. */
export const entryTitle = (method: string, about: string) => `${method} · ${about}`;
/** What a host passes on to the model: everything but `_meta`, which is for the host and the app. */
export const forModel = (message: Record<string, unknown>) => {
  const seen = { ...message };
  delete seen._meta;
  return seen;
};
/**
 * A message split into what each part is: a result's or update's text (`content`) and its
 * structured data (`structuredContent`); a tool's description and input schema; then the rest; and
 * last, `_meta`, which the host keeps from the model (a tool's app's `ui://` address is in it).
 */
export function sections(message: Record<string, unknown>, width: number): { title: string; body: string }[] {
  const json = (value: unknown) => pretty(value, width);
  const out: { title: string; body: string }[] = [];
  const { _meta: meta, ...rest } = message;
  if (Array.isArray(rest.content)) {
    const parts = rest.content as { type: string; text?: string }[];
    out.push({ title: 'Text (content)', body: parts.map(c => (c.type === 'text' ? c.text : json(c))).join('\n\n') });
    delete rest.content;
  }
  if ('structuredContent' in rest) {
    out.push({ title: 'Structured data (structuredContent)', body: json(rest.structuredContent) });
    delete rest.structuredContent;
  }
  if (typeof rest.instructions === 'string') {
    out.push({ title: 'Instructions', body: rest.instructions });
    delete rest.instructions;
  }
  if (typeof rest.description === 'string') {
    out.push({ title: 'Description', body: rest.description });
    delete rest.description;
  }
  if ('inputSchema' in rest) {
    out.push({ title: 'Input schema (inputSchema)', body: json(rest.inputSchema) });
    delete rest.inputSchema;
  }
  const others = Object.entries(rest).filter(([, v]) => v !== undefined);
  if (others.length) out.push({ title: out.length ? 'Also' : 'Message', body: json(Object.fromEntries(others)) });
  if (meta !== undefined) out.push({ title: 'Host only (_meta), not sent to the model', body: json(meta) });
  return out;
}
/** An app's size, as its HTML's UTF-8 bytes, e.g. `4.0 MB`. */
export const megabytes = (html: string) => `${(new TextEncoder().encode(html).length / 1e6).toFixed(1)} MB`;
/** A rough token count (about 4 characters a token), for a sense of what a tool costs. */
export const tokens = (value: unknown) => `~${Math.round(JSON.stringify(value).length / 4)} tokens`;

/** JSON, indented, but with each object or array that fits in `width` characters kept on one line. */
export function pretty(value: unknown, width = 72, indent = ''): string {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== 'object' || indent.length + flat.length <= width) return flat;
  const inner = `${indent}  `;
  const lines = Array.isArray(value)
    ? value.map(v => inner + pretty(v, width, inner))
    : Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${pretty(v, width, inner)}`);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`;
}
