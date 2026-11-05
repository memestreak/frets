/**
 * The Tab page's part of Frets' MCP server (#340, `src/mcp/`): `show_tab` and the app it shows. It
 * checks the line, answers with a line of text and the Frets link (for hosts with no apps too), and
 * hands the checked line, as JSON, to the app.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { appHtml, type AppsHtml } from '@/mcp/types';
import { writePart } from '../alphatex';
import { shareLink } from '../shareLink';
import { VIEW_WORDS, describeLine, describeLoop, lineFromInput, loopOf } from './lineJson';
import { APP_URI, TOOL_DESCRIPTION, TOOL_NAME, toolInput, type LineInput, type LoopInput, type View } from './tool';

/** The app's name: `mcp/apps/tab/`, built to `mcp/dist/tab.html`. */
export const APP_NAME = 'tab';

/** Where Open in Frets and the result's link go. */
export const SITE = 'https://frets.eminor.net';

/** What the tool hands the app: the checked line, how to draw it, and its loop points if it has any. */
export interface TabState {
  line: LineInput;
  view: View;
  loop?: LoopInput;
}

export function registerTabTools(server: McpServer, apps: AppsHtml): void {
  const html = appHtml(apps, APP_NAME);

  registerAppTool(server, TOOL_NAME, {
    title: 'Staff and tab',
    description: TOOL_DESCRIPTION,
    inputSchema: toolInput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: APP_URI } },
  }, async input => {
    const made = lineFromInput(input);
    if (!made.ok) return { isError: true, content: [{ type: 'text', text: made.error }] };
    const link = await shareLink(SITE, writePart(made.part));
    const state: TabState = { line: made.line, view: made.view };
    if (made.loop) state.loop = loopOf(made.part, made.loop);
    const looping = made.loop ? `, loop points on ${describeLoop(made.part, made.loop)}` : '';
    return {
      content: [{ type: 'text', text: `Shown: ${describeLine(made.part)}, as ${VIEW_WORDS[made.view]}${looping}. Open in Frets: ${link}` }],
      structuredContent: { ...state },
    };
  });

  registerAppResource(server, 'Staff and tab', APP_URI, { description: 'A line of guitar music, as staff over tab, that plays' }, () => ({
    contents: [{ uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
  }));
}
