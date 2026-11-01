/**
 * Every page's tools on Frets' MCP server, in the order `tools/list` shows them. A page joins the
 * server with one line here (`src/mcp/README.md`).
 */
import { registerMetronomeTools } from '@/features/metronome/mcp/register';
import { registerTunerTools } from '@/features/tuner/mcp/register';
import type { RegisterTools } from './types';

export const MCP_PAGES: readonly RegisterTools[] = [
  registerMetronomeTools,
  registerTunerTools,
];
