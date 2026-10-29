/**
 * Decoding a soundfont's Ogg Vorbis samples (an .sf3's), the slow part of loading a sound: the
 * piano's take about 4 s on a fast machine. `soundDecoder.worker.ts` does it in a Web Worker, so the
 * page stays responsive (`SoundDecoder` in `soundDecoder.ts` asks it), and the samples go to the
 * player's synthesizer, which then finds them decoded. Both sides use alphaTab's own decoder, so the samples are the same to the bit.
 * See docs/specs/2026-10-29-tab-sound-decoding-design.md.
 *
 * alphaTab keeps a soundfont as a `Hydra`, which decodes a sample the first time a clip uses it and
 * keeps it under its byte range (`_sampleCache`). Neither is in alphaTab's types; both are checked
 * against the pinned 1.8.4, and a test fails if the key changes.
 */
import type * as AlphaTabModule from '@coderline/alphatab';

type AlphaTab = typeof AlphaTabModule;

/** One sample of a soundfont, decoded: its byte range in the soundfont's sample data, and its samples. */
export interface DecodedSample {
  start: number;
  end: number;
  samples: Float32Array;
}

/** A soundfont as alphaTab holds it (its `Hydra`). */
export interface Soundfont {
  sHdrs: { start: number; end: number; sampleType: number }[];
  decodeSamples(startByte: number, endByte: number, decompressVorbis: boolean): Float32Array;
  _sampleCache: Map<string, Float32Array>;
}

/** The sample type's bit for an Ogg Vorbis sample, the only kind slow to decode. */
const VORBIS = 16;

/** The soundfonts a synthesizer holds, in the order loaded. */
function fontsOf(synth: AlphaTabModule.synth.AlphaSynth): Soundfont[] {
  return (synth as unknown as { _loadedSoundFonts: Soundfont[] })._loadedSoundFonts;
}

/** The soundfont a synthesizer loaded last. */
export function lastFont(synth: AlphaTabModule.synth.AlphaSynth): Soundfont {
  const fonts = fontsOf(synth);
  return fonts[fonts.length - 1];
}

/** The Ogg Vorbis samples of a soundfont, by byte range. */
export function vorbisSamples(font: Soundfont) {
  return font.sHdrs.filter(sample => (sample.sampleType & VORBIS) !== 0);
}

/** An output that plays nothing, so a synthesizer can be made just to read a soundfont. */
export function silentOutput(): AlphaTabModule.synth.ISynthOutput {
  const never = { on() {}, off() {} };
  return {
    sampleRate: 44100,
    open() {},
    play() {},
    pause() {},
    destroy() {},
    addSamples() {},
    resetSamples() {},
    activate() {},
    ready: never,
    samplesPlayed: never,
    sampleRequest: never,
  } as unknown as AlphaTabModule.synth.ISynthOutput;
}

/**
 * Decodes every Ogg Vorbis sample of a soundfont (an .sf3 file's bytes) with alphaTab's decoder, as
 * its synthesizer would when a clip first uses them. What the worker runs.
 */
export function decodeSoundFont(at: AlphaTab, bytes: Uint8Array): DecodedSample[] {
  const synth = new at.synth.AlphaSynth(silentOutput(), 500);
  synth.loadSoundFont(bytes, false);
  const font = lastFont(synth);
  // The same arguments the synthesizer decodes with, so they make the same samples.
  return vorbisSamples(font).map(({ start, end }) => ({ start, end, samples: font.decodeSamples(start, end, true) }));
}

/** Hands decoded samples to a soundfont the synthesizer holds, so it never decodes them itself. */
export function useDecoded(font: Soundfont, decoded: readonly DecodedSample[]) {
  for (const { start, end, samples } of decoded) font._sampleCache.set(`${start}_${end}_true`, samples);
}

/**
 * Decodes a soundfont's samples on the main thread, one at a time with a pause between, so the page
 * stays responsive meanwhile. Used where no worker can be made.
 */
export async function decodeOnMainThread(font: Soundfont) {
  for (const { start, end } of vorbisSamples(font)) {
    font.decodeSamples(start, end, true);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/* — the worker's messages — */

/**
 * The `cmd` of the page's messages to the worker. alphaTab's own worker code, which starts when the
 * worker imports alphaTab, reads every message's `cmd` and throws on one without it; it ignores this.
 */
export const DECODE_CMD = 'frets.decodeSoundFont';

/** What the page sends the worker: a soundfont's bytes to decode, under an id for the answer. */
export interface DecodeRequest {
  cmd: typeof DECODE_CMD;
  decodeId: number;
  bytes: Uint8Array;
}

/** What the worker answers: the decoded samples, or why it couldn't. */
export type DecodeAnswer = { decodeId: number; decoded: DecodedSample[] } | { decodeId: number; error: string };

/** The buffers of decoded samples, each once, to transfer them rather than copy them. */
export function transferables(decoded: readonly DecodedSample[]): ArrayBuffer[] {
  return [...new Set(decoded.map(d => d.samples.buffer as ArrayBuffer))];
}
