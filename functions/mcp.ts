/**
 * Frets' MCP server over HTTP at `/mcp` (`src/mcp/README.md`), a Cloudflare Pages Function that
 * ships with the site; every preview has its own. Stateless: each request gets a fresh server. Each
 * app's HTML is `npm run mcp:build`'s output, bundled in as text: a new app adds its import here.
 */
import { createMcpHandler } from '@modelcontextprotocol/server';
import metronome from '../mcp/dist/metronome.html';
import { createFretsServer } from '../src/mcp/server';

const handler = createMcpHandler(() => createFretsServer({ metronome }));

export const onRequest = ({ request }: { request: Request }): Promise<Response> => handler.fetch(request);
