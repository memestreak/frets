/**
 * Decodes soundfonts in the Web Worker `soundDecoder.worker.ts`, for the Tab page's player. Kept
 * apart from `soundDecode.ts`, which the worker imports, so the worker never imports itself.
 */
import { DECODE_CMD, type DecodeAnswer, type DecodeRequest, type DecodedSample } from './soundDecode';

/**
 * Decodes soundfonts in a Web Worker, one after another. If no worker can be made, or it fails,
 * `decode` rejects and the player decodes on the main thread instead.
 */
export class SoundDecoder {
  private worker: Worker | null = null;
  private next = 0;
  private readonly waiting = new Map<number, { resolve: (d: DecodedSample[]) => void; reject: (e: Error) => void }>();

  /** Decodes a soundfont's bytes; they are moved to the worker, so the caller can't use them after. */
  decode(bytes: Uint8Array): Promise<DecodedSample[]> {
    const worker = this.workerNow();
    if (!worker) return Promise.reject(new Error('no Web Worker here'));
    const decodeId = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(decodeId, { resolve, reject });
      const request: DecodeRequest = { cmd: DECODE_CMD, decodeId, bytes };
      worker.postMessage(request, [bytes.buffer as ArrayBuffer]);
    });
  }

  /** Starts the worker, so it has loaded alphaTab by the time a soundfont comes to decode. */
  start() {
    this.workerNow();
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new Error('the decoder was closed'));
  }

  private workerNow(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;
    try {
      this.worker = new Worker(new URL('./soundDecoder.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return null;
    }
    this.worker.onmessage = (e: MessageEvent<DecodeAnswer>) => {
      const waiting = this.waiting.get(e.data.decodeId);
      if (!waiting) return;
      this.waiting.delete(e.data.decodeId);
      if ('error' in e.data) waiting.reject(new Error(e.data.error));
      else waiting.resolve(e.data.decoded);
    };
    // A worker that fails to load fails what it was asked, and the next ask makes a new one.
    this.worker.onerror = e => {
      e.preventDefault();
      this.worker?.terminate();
      this.worker = null;
      this.failAll(new Error(e.message || 'the decoder failed'));
    };
    return this.worker;
  }

  private failAll(error: Error) {
    for (const { reject } of this.waiting.values()) reject(error);
    this.waiting.clear();
  }
}
