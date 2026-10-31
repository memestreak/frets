/**
 * The metronome's MCP server (#269): one tool, `show_metronome`, and the app it shows. It keeps no
 * state and needs no model: it checks the rhythm and hands it, with the app's HTML, to the host.
 * The same server runs over stdio (`mcp/stdio.ts`) and over HTTP at `/mcp` (`functions/mcp.ts`).
 */
import { McpServer } from '@modelcontextprotocol/server';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { APP_URI, TOOL_DESCRIPTION, TOOL_NAME, describeRhythm, rhythmFromInput, toolInput, type MetronomeState } from './tool';

export const SERVER_INFO = { name: 'frets-metronome', version: '1.0.0' };

/** A server that serves `appHtml`, the single-file app (`mcp/dist/app.html`). */
export function createMetronomeServer(appHtml: string): McpServer {
  const server = new McpServer(SERVER_INFO);

  registerAppTool(server, TOOL_NAME, {
    title: 'Metronome',
    description: TOOL_DESCRIPTION,
    inputSchema: toolInput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: APP_URI } },
  }, input => {
    const made = rhythmFromInput(input);
    if (!made.ok) return { isError: true, content: [{ type: 'text', text: made.error }] };
    const state: MetronomeState = made.state;
    return {
      content: [{ type: 'text', text: `Metronome ready (stopped): ${describeRhythm(state.rhythm)}. The user presses Start.` }],
      structuredContent: { ...state },
    };
  });

  registerAppResource(server, 'Metronome', APP_URI, { description: 'The Frets metronome' }, () => ({
    contents: [{ uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: appHtml }],
  }));

  return server;
}
