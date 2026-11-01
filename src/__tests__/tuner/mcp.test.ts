import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createFretsServer } from '@/mcp/server';
import { APP_URI, TOOL_NAME } from '@/features/tuner/mcp/tool';

/* show_tuner on Frets' MCP server (#283): the tool, and an app that asks the host for the mic. */

async function connectedClient() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createFretsServer({ metronome: '<p>metronome</p>', tuner: '<p>tuner</p>' }).connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

describe('show_tuner', () => {
  it('is listed with its app', async () => {
    const { tools } = await (await connectedClient()).listTools();
    const tool = tools.find(t => t.name === TOOL_NAME);
    expect(tool?._meta).toMatchObject({ ui: { resourceUri: APP_URI } });
  });

  it('serves the app, asking for the mic in the listing and in the content', async () => {
    const client = await connectedClient();
    const listed = (await client.listResources()).resources.find(r => r.uri === APP_URI);
    expect(listed?._meta).toMatchObject({ ui: { permissions: { microphone: {} } } });
    const { contents } = await client.readResource({ uri: APP_URI });
    expect(contents[0]).toMatchObject({
      uri: APP_URI, mimeType: 'text/html;profile=mcp-app', text: '<p>tuner</p>',
      _meta: { ui: { permissions: { microphone: {} } } },
    });
  });

  it('answers with a line for hosts without apps', async () => {
    const result = await (await connectedClient()).callTool({ name: TOOL_NAME, arguments: {} });
    expect(result.isError).toBeFalsy();
    expect((result.content as { text: string }[])[0].text).toMatch(/Tuner shown/);
  });
});
