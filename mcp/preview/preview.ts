/// <reference types="vite/client" />
/**
 * `npm run mcp:preview`: a stand-in host for Frets' MCP Apps (the metronome, #269; the line, #340; the tuner, #283),
 * so they can be tried in a browser with no Claude. Frets' real server runs in the page over an in-memory transport; each call
 * mounts the app's HTML in a sandboxed frame through the SDK's own `AppBridge`, as a chat would.
 * `npm run build` also puts it on the site at `/mcp-preview/`; `?theme=dark` starts it dark.
 */
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { AppBridge, PostMessageTransport, getToolUiResourceUri, type McpUiTheme } from '@modelcontextprotocol/ext-apps/app-bridge';
import metronome from '../dist/metronome.html?raw';
import tab from '../dist/tab.html?raw';
import tuner from '../dist/tuner.html?raw';
import { createFretsServer } from '@/mcp/server';
import { TOOL_NAME as METRONOME } from '@/features/metronome/mcp/tool';
import { TOOL_NAME as TAB } from '@/features/tab/mcp/tool';
import { TOOL_NAME as TUNER } from '@/features/tuner/mcp/tool';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Set by `mcp/vite.preview.config.mts`: the commit this page was built at. */
declare const __COMMIT__: string;
if (__COMMIT__ === 'dev') {
  $('commit').textContent = 'dev';
} else {
  const link = Object.assign(document.createElement('a'), {
    href: `https://github.com/memestreak/frets/commit/${__COMMIT__}`, target: '_blank', rel: 'noopener noreferrer', textContent: __COMMIT__,
  });
  $('commit').append(link);
}
/**
 * Adds a line to "What the model sees", newest first, named `<method> · <tool> #<call>` (see
 * `entryTitle`). With `detail`, the line opens to it: everything the model is sent, not just the text.
 */
const log = (line: string, detail?: Record<string, unknown>) => {
  const entry = document.createElement(detail === undefined ? 'div' : 'details');
  entry.className = 'entry';
  if (detail === undefined) {
    entry.textContent = line;
  } else {
    const summary = document.createElement('summary');
    summary.textContent = line;
    summary.addEventListener('click', () => summary.blur());
    entry.append(summary);
    detailed.set(entry, detail);
    fillSections(entry, detail);
  }
  $('log').prepend(entry);
};
/** Each opened-able log entry's message, so its parts can be laid out again when the log's width changes. */
const detailed = new Map<HTMLElement, Record<string, unknown>>();
/** How many characters of JSON fit on a line of the log, at its current width. */
const logColumns = () => Math.max(24, Math.floor(($('log').clientWidth - 32) / 7.2));
function fillSections(entry: HTMLElement, detail: Record<string, unknown>) {
  entry.querySelectorAll('.section, pre').forEach(el => el.remove());
  for (const { title, body } of sections(detail, logColumns())) {
    const head = document.createElement('div');
    head.className = 'section';
    head.textContent = title;
    const pre = document.createElement('pre');
    pre.textContent = body;
    entry.append(head, pre);
  }
}
/** A log line: the MCP method, then what it's about, e.g. `tools/call · show_tab #2 (~180 tokens)`. */
const entryTitle = (method: string, about: string) => `${method} · ${about}`;
/** What a host passes on to the model: everything but `_meta`, which is for the host and the app. */
const forModel = (message: Record<string, unknown>) => {
  const seen = { ...message };
  delete seen._meta;
  return seen;
};
/**
 * A message split into what each part is: a result's or update's text (`content`) and its
 * structured data (`structuredContent`); a tool's description and input schema; then the rest.
 */
function sections(message: Record<string, unknown>, width: number): { title: string; body: string }[] {
  const json = (value: unknown) => pretty(value, width);
  const out: { title: string; body: string }[] = [];
  const rest = { ...message };
  if (Array.isArray(rest.content)) {
    const parts = rest.content as { type: string; text?: string }[];
    out.push({ title: 'Text (content)', body: parts.map(c => (c.type === 'text' ? c.text : json(c))).join('\n\n') });
    delete rest.content;
  }
  if ('structuredContent' in rest) {
    out.push({ title: 'Structured data (structuredContent)', body: json(rest.structuredContent) });
    delete rest.structuredContent;
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
  return out;
}
/** A rough token count (about 4 characters a token), for a sense of what a tool costs. */
const tokens = (value: unknown) => `~${Math.round(JSON.stringify(value).length / 4)} tokens`;

const HOST = { name: 'Frets preview host', version: '1.0.0' };
let theme: McpUiTheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
const bridges: AppBridge[] = [];
/** The rhythm the newest metronome last reported, for "call again". */
let latest: Record<string, unknown> | null = null;

async function connectClient() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createFretsServer({ metronome, tab, tuner }).connect(serverSide);
  const client = new Client({ name: HOST.name, version: HOST.version });
  await client.connect(clientSide);
  return client;
}
const client = await connectClient();
const tools = (await client.listTools()).tools;
for (const tool of [...tools].reverse()) {
  const seen = forModel(tool);
  log(entryTitle('tools/list', `${tool.name} (${tokens(seen)})`), seen);
}
log(entryTitle('tools/list', `${tools.length} tools (${tokens(tools.map(forModel))} in all)`));

/** Each previewed tool's app's HTML, by tool name. */
const apps = new Map<string, string>();
for (const name of [METRONOME, TAB, TUNER]) {
  const uri = getToolUiResourceUri(tools.find(t => t.name === name)!)!;
  const content = (await client.readResource({ uri })).contents[0];
  apps.set(name, 'text' in content ? content.text : '');
}

/** JSON, indented, but with each object or array that fits in `width` characters kept on one line. */
function pretty(value: unknown, width = 72, indent = ''): string {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== 'object' || indent.length + flat.length <= width) return flat;
  const inner = `${indent}  `;
  const lines = Array.isArray(value)
    ? value.map(v => inner + pretty(v, width, inner))
    : Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${pretty(v, width, inner)}`);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`;
}

/** What each tool's arguments box starts with. */
const EXAMPLES: Record<string, string> = {
  [METRONOME]: '{ "bpm": 92, "beats": 7, "groups": "2+2+3" }',
  [TAB]: pretty({
    bpm: 90,
    bars: [
      { columns: [8, 8, 8, 8, 8, 8, 4].map((value, i) => ({ duration: { value }, notes: [{ pitch: ['A3', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4'][i] }] })) },
      { columns: [{ duration: { value: 2 }, notes: [{ string: 3, fret: 2, bend: { quarters: 4 } }], chord: 'Am' }, { duration: { value: 2 }, notes: [{ string: 5, fret: 0 }] }] },
    ],
    loop: { start: { bar: 1, column: 3 }, end: { bar: 2, column: 1 } },
  }),
  [TUNER]: '{}',
};

/** A call's arguments: one line, which opens to the whole call, pretty-printed. */
const argsView = () => '<details class="args"><summary><span></span></summary><pre></pre></details>';
function fillArgs(turn: HTMLElement, args: Record<string, unknown>) {
  turn.querySelector('.args summary span')!.textContent = JSON.stringify(args);
  turn.querySelector('.args pre')!.textContent = pretty(args);
  // Let go of the toggle after a press, as every Frets widget does.
  const summary = turn.querySelector<HTMLElement>('.args summary')!;
  summary.addEventListener('click', () => summary.blur());
}

async function call(name: string, args: Record<string, unknown>) {
  const html = apps.get(name)!;
  // A turn is named by its tool and call number, as the log names its messages.
  const label = `${name} #${bridges.length + 1}`;
  const turn = document.createElement('div');
  turn.className = 'turn';
  turn.innerHTML = `<div class="turn-head"><span class="label"></span>${argsView()}<button type="button">Tear down</button></div>`;
  turn.querySelector('.label')!.textContent = label;
  fillArgs(turn, args);
  const frame = document.createElement('iframe');
  frame.title = label;
  frame.sandbox.add('allow-scripts');
  // The tuner's resource asks for the mic; this host grants it, as Claude does.
  if (name === TUNER) frame.allow = 'microphone';
  frame.srcdoc = html;
  turn.append(frame);
  $('column').append(turn);

  const bridge = new AppBridge(client, HOST, { serverTools: {}, logging: {}, updateModelContext: { text: {}, structuredContent: {} } }, {
    hostContext: { theme, displayMode: 'inline', platform: 'web' },
  });
  bridges.push(bridge);
  bridge.onsizechange = ({ height }) => {
    if (height) frame.style.height = `${Math.ceil(height)}px`;
  };
  bridge.onupdatemodelcontext = async params => {
    const seen = forModel(params);
    log(entryTitle('ui/update-model-context', `${label} (${tokens(seen)})`), seen);
    if (name === METRONOME) latest = (params.structuredContent?.rhythm as Record<string, unknown>) ?? latest;
    return {};
  };
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    const result = await client.callTool({ name, arguments: args });
    const seen = forModel(result);
    log(entryTitle('tools/call', `${label} (${tokens(seen)})`), seen);
    if (!result.isError && name === METRONOME) latest = (result.structuredContent as { rhythm: Record<string, unknown> }).rhythm;
    await bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  };
  turn.querySelector('button')!.addEventListener('click', async () => {
    await bridge.teardownResource({});
    log(entryTitle('ui/resource-teardown', label));
    turn.remove();
  });
  frame.addEventListener('load', () => {
    void bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  }, { once: true });
}

const toolPick = $<HTMLSelectElement>('tool');
const pickTool = () => {
  $<HTMLTextAreaElement>('args').value = EXAMPLES[toolPick.value];
  $('call').textContent = `Call ${toolPick.value}`;
};
toolPick.addEventListener('change', pickTool);
pickTool();
$('call').addEventListener('click', () => {
  try {
    void call(toolPick.value, JSON.parse($<HTMLTextAreaElement>('args').value));
  } catch (e) {
    log(`Not JSON: ${(e as Error).message}`);
  }
});
$('again').addEventListener('click', () => {
  const bpm = typeof latest?.bpm === 'number' ? latest.bpm + 5 : 125;
  void call(METRONOME, latest ? { rhythm: latest, bpm } : { bpm });
});
$('clear').addEventListener('click', e => {
  $('log').textContent = '';
  detailed.clear();
  (e.currentTarget as HTMLElement).blur();
});
const themePick = $<HTMLSelectElement>('theme');
themePick.value = theme;
document.body.dataset.theme = theme;
themePick.addEventListener('change', () => {
  theme = themePick.value as McpUiTheme;
  document.body.dataset.theme = theme;
  for (const b of bridges) void b.sendHostContextChange({ theme });
});
/**
 * A drag handle on an edge (role="separator"): drag it, or focus it and press ← → (Shift for bigger
 * steps). The handle sits on its box's right edge and the left edge stays put, so the width moves
 * as far as the pointer does. `set` clamps and applies a width and returns what it applied.
 */
function resizer(handle: HTMLElement, start: number, set: (px: number) => number, done = () => {}) {
  let width = start;
  const apply = (px: number) => {
    width = set(px);
    handle.querySelector('span')!.textContent = `${width} px`;
    handle.setAttribute('aria-valuenow', String(width));
  };
  handle.addEventListener('pointerdown', down => {
    const [x0, w0] = [down.clientX, width];
    handle.setPointerCapture(down.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add('resizing'); // frames would otherwise swallow the pointer
    const move = (e: PointerEvent) => apply(w0 + e.clientX - x0);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('lostpointercapture', () => {
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      handle.removeEventListener('pointermove', move);
      handle.blur();
      done();
    }, { once: true });
  });
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 50 : 10;
    if (e.key === 'ArrowLeft') apply(width - step);
    else if (e.key === 'ArrowRight') apply(width + step);
    else return;
    e.preventDefault();
    done();
  });
  apply(start);
}

/** The chat column's width; the column sits at the chat's left, next to the sidebar. */
const wrap = $('column').parentElement!;
resizer($('resize'), 640, px => {
  const room = wrap.parentElement!.clientWidth - 64; // the chat's padding and the handle
  const w = Math.round(Math.max(280, Math.min(px, room)));
  wrap.style.width = `${w}px`;
  return w;
});

/** The left sidebar's width; the log lays its messages out again to fit. */
const layout = document.querySelector<HTMLElement>('.layout')!;
resizer($('side-resize'), 320, px => {
  const w = Math.round(Math.max(240, Math.min(px, window.innerWidth - 360)));
  layout.style.setProperty('--side', `${w}px`);
  return w;
}, () => detailed.forEach((detail, entry) => fillSections(entry, detail)));
