import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { MCP_SERVER } from '@/features/agents/agentGuides';
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
});
