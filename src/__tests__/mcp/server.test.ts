import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { MCP_SERVER } from '@/features/agents/agentGuides';
import { SERVER_INSTRUCTIONS } from '@/mcp/instructions';
import { createFretsServer } from '@/mcp/server';

/* Frets' one MCP server (src/mcp/README.md) against what builds, serves and lists it. */

const REPO = join(__dirname, '../../..');
/** Every app the build makes: one per folder in mcp/apps/. */
const APPS = readdirSync(join(REPO, 'mcp/apps'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
const stubApps = Object.fromEntries(APPS.map(a => [a, `<p>${a}</p>`]));

async function connect(apps: Record<string, string>) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createFretsServer(apps).connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

describe('the Frets MCP server', () => {
  it('is named frets', async () => {
    const client = await connect(stubApps);
    expect(client.getServerVersion()?.name).toBe('frets');
  });

  it('gives the model its instructions as it connects', async () => {
    const client = await connect(stubApps);
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
  });

  it('names every tool it lists in its instructions, and no other', async () => {
    const { tools } = await (await connect(stubApps)).listTools();
    const named = [...SERVER_INSTRUCTIONS.matchAll(/\bshow_\w+/g)].map(m => m[0]);
    expect([...new Set(named)].sort()).toEqual(tools.map(t => t.name).sort());
  });

  it('keeps its instructions under 400 tokens (about 4 characters a token)', () => {
    expect(SERVER_INSTRUCTIONS.length / 4).toBeLessThan(400);
  });

  it('points its instructions at the alphaTex guide, and never says "lick"', () => {
    expect(SERVER_INSTRUCTIONS).toContain('https://frets.eminor.net/tab-alphatex.txt');
    expect(SERVER_INSTRUCTIONS).not.toMatch(/\blicks?\b/i);
  });

  it('logs its instructions in the stand-in host', () => {
    const host = readFileSync(join(REPO, 'mcp/preview/preview.ts'), 'utf8');
    expect(host).toContain('client.getInstructions()');
  });

  it('lists the tools the Agents page and llms.txt list, in that order', async () => {
    const { tools } = await (await connect(stubApps)).listTools();
    expect(tools.map(t => t.name)).toEqual(MCP_SERVER.tools.map(t => t.name));
  });

  it('serves each app it names from the HTML it was given', async () => {
    const client = await connect(stubApps);
    const { resources } = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    for (const r of resources) {
      const { contents } = await client.readResource({ uri: r.uri });
      expect(Object.values(stubApps)).toContain('text' in contents[0] ? contents[0].text : '');
    }
  });

  it('says which app is missing when the build left one out', () => {
    expect(() => createFretsServer({})).toThrow(/No MCP App "metronome"/);
  });

  it('gets every app from /mcp, the Cloudflare function', () => {
    const fn = readFileSync(join(REPO, 'functions/mcp.ts'), 'utf8');
    for (const app of APPS) expect(fn, app).toContain(`import ${app} from '../mcp/dist/${app}.html';`);
  });

  it('gets every app and offers every tool in the stand-in host, /mcp-preview', async () => {
    const host = readFileSync(join(REPO, 'mcp/preview/preview.ts'), 'utf8');
    for (const app of APPS) expect(host, app).toContain(`import ${app} from '../dist/${app}.html?raw';`);
    const page = readFileSync(join(REPO, 'mcp/preview/index.html'), 'utf8');
    const { tools } = await (await connect(stubApps)).listTools();
    for (const t of tools) expect(page, t.name).toContain(`<option>${t.name}</option>`);
  });

  it('builds the stand-in host into the site, after the export that empties out/', () => {
    const { scripts } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
    expect(scripts.build).toMatch(/next build && vite build --config mcp\/vite\.preview\.config\.mts$/);
  });
});
