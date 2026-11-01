/**
 * `npm run mcp:build`: every MCP App in `mcp/apps/` (each folder one app, built to
 * `mcp/dist/<name>.html`), then the stdio server, `mcp/dist/server.mjs`.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const here = import.meta.dirname;
const apps = readdirSync(path.join(here, 'apps'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

for (const app of apps) {
  process.env.MCP_APP = app;
  await build({ configFile: path.join(here, 'vite.config.mts') });
}
await build({ configFile: path.join(here, 'vite.server.config.mts') });
