/// <reference types="vite/client" />
/**
 * `npm run mcp:preview`: a stand-in host for the metronome's MCP App (#269), so it can be tried in a
 * browser with no Claude. Frets' real server runs in the page over an in-memory transport; each call
 * mounts the app's HTML in a sandboxed frame through the SDK's own `AppBridge`, as a chat would.
 */
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { AppBridge, PostMessageTransport, getToolUiResourceUri, type McpUiTheme } from '@modelcontextprotocol/ext-apps/app-bridge';
import metronome from '../dist/metronome.html?raw';
import { createFretsServer } from '@/mcp/server';
import { TOOL_NAME } from '@/features/metronome/mcp/tool';

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
  await createFretsServer({ metronome }).connect(serverSide);
  const client = new Client({ name: HOST.name, version: HOST.version });
  await client.connect(clientSide);
  return client;
}
const client = await connectClient();
const tool = (await client.listTools()).tools.find(t => t.name === TOOL_NAME)!;
const uri = getToolUiResourceUri(tool)!;
const html = (await client.readResource({ uri })).contents[0];
log(`tools/list: ${tool.name} → ${uri}`);

async function call(args: Record<string, unknown>) {
  const n = bridges.length + 1;
  const turn = document.createElement('div');
  turn.className = 'turn';
  turn.innerHTML = `<div class="turn-head">Metronome ${n}<span>${JSON.stringify(args)}</span><button type="button">Tear down</button></div>`;
  const frame = document.createElement('iframe');
  frame.title = `Metronome ${n}`;
  frame.sandbox.add('allow-scripts');
  frame.srcdoc = 'text' in html ? html.text : '';
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
    log(`Metronome ${n} → model context: ${text}`);
    latest = (params.structuredContent?.rhythm as Record<string, unknown>) ?? latest;
    return {};
  };
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    const result = await client.callTool({ name: TOOL_NAME, arguments: args });
    const text = (result.content as { text?: string }[]).map(c => c.text).join(' ');
    log(`Metronome ${n} ← tools/call: ${text}`);
    if (!result.isError) latest = (result.structuredContent as { rhythm: Record<string, unknown> }).rhythm;
    await bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  };
  turn.querySelector('button')!.addEventListener('click', async () => {
    await bridge.teardownResource({});
    log(`Metronome ${n}: torn down`);
    turn.remove();
  });
  frame.addEventListener('load', () => {
    void bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  }, { once: true });
}

$('call').addEventListener('click', () => {
  try {
    void call(JSON.parse($<HTMLTextAreaElement>('args').value));
  } catch (e) {
    log(`Not JSON: ${(e as Error).message}`);
  }
});
$('again').addEventListener('click', () => {
  const bpm = typeof latest?.bpm === 'number' ? latest.bpm + 5 : 125;
  void call(latest ? { rhythm: latest, bpm } : { bpm });
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
