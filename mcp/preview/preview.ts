/// <reference types="vite/client" />
/**
 * `npm run mcp:preview`: a stand-in host for Frets' MCP Apps (the metronome, #269; the line, #340),
 * so they can be tried in a browser with no Claude. Frets' real server runs in the page over an in-memory transport; each call
 * mounts the app's HTML in a sandboxed frame through the SDK's own `AppBridge`, as a chat would.
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

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (line: string) => {
  const el = $('log');
  el.textContent = `${line}\n\n${el.textContent}`;
};

const HOST = { name: 'Frets preview host', version: '1.0.0' };
let theme: McpUiTheme = 'light';
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

/** Each previewed tool's app, by tool name, and what its turns are called. */
const apps = new Map<string, { html: string; label: string }>();
for (const [name, label] of [[METRONOME, 'Metronome'], [TAB, 'Line']] as const) {
  const uri = getToolUiResourceUri(tools.find(t => t.name === name)!)!;
  const content = (await client.readResource({ uri })).contents[0];
  apps.set(name, { html: 'text' in content ? content.text : '', label });
  log(`tools/list: ${name} → ${uri}`);
}

/** What each tool's arguments box starts with. */
const EXAMPLES: Record<string, string> = {
  [METRONOME]: '{ "bpm": 92, "beats": 7, "groups": "2+2+3" }',
  [TAB]: JSON.stringify({
    bpm: 90,
    bars: [
      { columns: [8, 8, 8, 8, 8, 8, 4].map((value, i) => ({ duration: { value }, notes: [{ pitch: ['A3', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4'][i] }] })) },
      { columns: [{ duration: { value: 2 }, notes: [{ string: 3, fret: 2, bend: { quarters: 4 } }], chord: 'Am' }, { duration: { value: 2 }, notes: [{ string: 5, fret: 0 }] }] },
    ],
  }, null, 1),
};

async function call(name: string, args: Record<string, unknown>) {
  const { html, label } = apps.get(name)!;
  const n = bridges.length + 1;
  const turn = document.createElement('div');
  turn.className = 'turn';
  turn.innerHTML = `<div class="turn-head">${label} ${n}<span>${JSON.stringify(args)}</span><button type="button">Tear down</button></div>`;
  const frame = document.createElement('iframe');
  frame.title = `${label} ${n}`;
  frame.sandbox.add('allow-scripts');
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
    const text = params.content?.map(c => ('text' in c ? c.text : '')).join(' ');
    log(`${label} ${n} → model context: ${text}`);
    if (name === METRONOME) latest = (params.structuredContent?.rhythm as Record<string, unknown>) ?? latest;
    return {};
  };
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text?: string }[]).map(c => c.text).join(' ');
    log(`${label} ${n} ← tools/call: ${text}`);
    if (!result.isError && name === METRONOME) latest = (result.structuredContent as { rhythm: Record<string, unknown> }).rhythm;
    await bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  };
  turn.querySelector('button')!.addEventListener('click', async () => {
    await bridge.teardownResource({});
    log(`${label} ${n}: torn down`);
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
$<HTMLSelectElement>('theme').addEventListener('change', e => {
  theme = (e.target as HTMLSelectElement).value as McpUiTheme;
  document.body.dataset.theme = theme;
  for (const b of bridges) void b.sendHostContextChange({ theme });
});
const width = () => {
  $('column').style.maxWidth = `${$<HTMLSelectElement>('width').value}px`;
};
$('width').addEventListener('change', width);
width();
