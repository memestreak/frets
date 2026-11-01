/**
 * The metronome's MCP server over HTTP at `/mcp` (#269), a Cloudflare Pages Function that ships
 * with the site; every preview has its own. Stateless: each request gets a fresh server. The app's
 * HTML is `npm run mcp:build`'s output, bundled in as text.
 */
import { createMcpHandler } from '@modelcontextprotocol/server';
import appHtml from '../mcp/dist/app.html';
import { createMetronomeServer } from '../src/features/metronome/mcp/server';

const handler = createMcpHandler(() => createMetronomeServer(appHtml));

export const onRequest = ({ request }: { request: Request }): Promise<Response> => handler.fetch(request);
