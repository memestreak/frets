/**
 * Frets' MCP server over stdio, for Claude Desktop and Claude Code on your own computer. Built to
 * `mcp/dist/server.mjs` with every app's HTML beside it (`npm run mcp:build`); point the host at
 * `node mcp/dist/server.mjs` (the steps are in `src/mcp/README.md`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createFretsServer } from '@/mcp/server';

const dist = new URL('./', import.meta.url);
const apps = Object.fromEntries(readdirSync(dist).filter(f => f.endsWith('.html'))
  .map(f => [basename(f, '.html'), readFileSync(new URL(f, dist), 'utf8')]));
await createFretsServer(apps).connect(new StdioServerTransport());
