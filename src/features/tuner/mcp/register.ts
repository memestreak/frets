/**
 * The Tuner's part of Frets' MCP server (#283, `src/mcp/`): one tool, `show_tuner`, and the app it
 * shows. The app asks the host for the mic; the host decides.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { appHtml, type AppsHtml } from '@/mcp/types';
import { APP_URI, TOOL_DESCRIPTION, TOOL_NAME, TOOL_RESULT } from './tool';

/** The app's name: `mcp/apps/tuner/`, built to `mcp/dist/tuner.html`. */
export const APP_NAME = 'tuner';

/** What the app's frame asks the host for: the mic. */
export const APP_UI_META = { permissions: { microphone: {} } };

export function registerTunerTools(server: McpServer, apps: AppsHtml): void {
  const html = appHtml(apps, APP_NAME);

  registerAppTool(server, TOOL_NAME, {
    title: 'Tuner',
    description: TOOL_DESCRIPTION,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: APP_URI } },
  }, () => ({
    content: [{ type: 'text', text: TOOL_RESULT }],
  }));

  registerAppResource(server, 'Tuner', APP_URI, {
    description: 'The Frets guitar tuner',
    _meta: { ui: APP_UI_META },
  }, () => ({
    contents: [{ uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: html, _meta: { ui: APP_UI_META } }],
  }));
}
