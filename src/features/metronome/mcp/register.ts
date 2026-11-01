/**
 * The metronome's part of Frets' MCP server (#269, `src/mcp/`): one tool, `show_metronome`, and the
 * app it shows. It checks the rhythm and hands it, with the app's HTML, to the host.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { appHtml, type AppsHtml } from '@/mcp/types';
import { APP_URI, TOOL_DESCRIPTION, TOOL_NAME, describeRhythm, rhythmFromInput, toolInput, type MetronomeState } from './tool';

/** The app's name: `mcp/apps/metronome/`, built to `mcp/dist/metronome.html`. */
export const APP_NAME = 'metronome';

export function registerMetronomeTools(server: McpServer, apps: AppsHtml): void {
  const html = appHtml(apps, APP_NAME);

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
    contents: [{ uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
  }));
}
