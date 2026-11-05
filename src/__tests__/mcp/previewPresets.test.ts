import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createFretsServer } from '@/mcp/server';
import { TOOL_NAME as TAB } from '@/features/tab/mcp/tool';
import { PRESETS } from '../../../mcp/preview/presets';

/* The stand-in host's presets (mcp/preview/presets.ts), called against the real server. */

const REPO = join(__dirname, '../../..');
const APPS = readdirSync(join(REPO, 'mcp/apps'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

async function connect() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createFretsServer(Object.fromEntries(APPS.map(a => [a, `<p>${a}</p>`]))).connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

describe('the stand-in host\'s presets', () => {
  it('has presets for every tool the server lists, and for no other', async () => {
    const { tools } = await (await connect()).listTools();
    expect(Object.keys(PRESETS).sort()).toEqual(tools.map(t => t.name).sort());
    for (const t of tools) expect(PRESETS[t.name].length, t.name).toBeGreaterThan(0);
  });

  it('starts show_tab with no loop', () => {
    expect(PRESETS[TAB][0].args).not.toHaveProperty('loop');
  });

  it('keeps a loop preset for show_tab', () => {
    expect(PRESETS[TAB].some(p => 'loop' in p.args)).toBe(true);
  });

  it('names each of a tool\'s presets differently', () => {
    for (const [tool, presets] of Object.entries(PRESETS)) {
      expect(new Set(presets.map(p => p.name)).size, tool).toBe(presets.length);
    }
  });

  it('gets the answer each preset expects: shown, or refused by the check', async () => {
    const client = await connect();
    for (const [tool, presets] of Object.entries(PRESETS)) {
      for (const p of presets) {
        const result = await client.callTool({ name: tool, arguments: p.args });
        expect(Boolean(result.isError), `${tool}: ${p.name}`).toBe(Boolean(p.fails));
      }
    }
  });
});
