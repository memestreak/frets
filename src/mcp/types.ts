/**
 * What a page gives Frets' MCP server (`src/mcp/README.md`): a function that adds its tools, and
 * the apps they show, to the server.
 */
import type { McpServer } from '@modelcontextprotocol/server';

/** Every app's single-file HTML, by name: `mcp/apps/<name>/` builds to `mcp/dist/<name>.html`. */
export type AppsHtml = Readonly<Record<string, string>>;

/** Adds a page's tools and app resources to the server. */
export type RegisterTools = (server: McpServer, apps: AppsHtml) => void;

/** The named app's HTML, or a clear error when the build left it out. */
export function appHtml(apps: AppsHtml, name: string): string {
  const html = apps[name];
  if (html === undefined) throw new Error(`No MCP App "${name}": run npm run mcp:build (mcp/apps/${name}/).`);
  return html;
}
