/**
 * Frets' MCP server (`src/mcp/README.md`): one server, named `frets`, that every page adds its
 * tools to. A chat app adds it once, at `/mcp`, and each new tool arrives on the same URL. It keeps
 * no state and needs no model. The same server runs over stdio (`mcp/stdio.ts`), over HTTP at
 * `/mcp` (`functions/mcp.ts`) and in `npm run mcp:preview`.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { MCP_PAGES } from './tools';
import type { AppsHtml } from './types';

export const SERVER_INFO = { name: 'frets', version: '1.0.0' };

/** A server with every page's tools, serving `apps`, the built apps' HTML by name. */
export function createFretsServer(apps: AppsHtml): McpServer {
  const server = new McpServer(SERVER_INFO);
  for (const register of MCP_PAGES) register(server, apps);
  return server;
}
