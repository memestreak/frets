/**
 * The MCP Apps' stand-in for the Tab player's `SoundDecoder` (`src/features/tab/soundDecoder.ts`),
 * swapped in by `mcp/vite.config.mts`. A host's frame can't load the worker's own file, which the
 * single-file build can't inline, so every soundfont decodes on the main thread instead.
 */
import type { DecodedSample } from '@/features/tab/soundDecode';

export class SoundDecoder {
  decode(): Promise<DecodedSample[]> {
    return Promise.reject(new Error('no decoder worker in an MCP App'));
  }

  start() {}

  destroy() {}
}
