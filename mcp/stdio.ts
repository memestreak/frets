/**
 * The metronome's MCP server over stdio, for Claude Desktop and Claude Code on your own computer
 * (#269). Built to `mcp/dist/server.mjs` with the app beside it: `npm run mcp:build`, then point the
 * host at `node mcp/dist/server.mjs` (the steps are in `src/features/metronome/README.md`).
 */
import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createMetronomeServer } from '@/features/metronome/mcp/server';

const appHtml = readFileSync(new URL('./app.html', import.meta.url), 'utf8');
await createMetronomeServer(appHtml).connect(new StdioServerTransport());
