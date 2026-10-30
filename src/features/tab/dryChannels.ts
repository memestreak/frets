/**
 * Some MIDI channels kept out of the effects: the metronome's and the count-in's clicks (Jeremy,
 * 2026-10-30: "The metronome should not have effects applied to it"). alphaTab's synthesizer mixes
 * every channel into one stream of samples, so the clicks would be distorted and ring in the reverb
 * with the notes. Here the synthesizer's mixing step is replaced by one that writes the voices of the
 * dry channels into samples of their own, block for block beside the main ones, which the output
 * (`audioOutput.ts`) plays past the effects.
 *
 * The replacement is alphaTab 1.8.4's `TinySoundFont._fillWorkingBuffer` with one change: which
 * buffer a voice is rendered into. It reaches into alphaTab's internals, so `dryChannels.test.ts`
 * renders real clicks and notes through it, to fail if an upgrade changes them.
 */
import type * as AlphaTabModule from '@coderline/alphatab';

/** A voice of alphaTab's synthesizer, as far as the mixing step uses it. */
interface Voice {
  playingPreset: number;
  playingChannel: number;
  kill(): void;
  render(synth: TinySoundFont, buffer: Float32Array, offset: number, samples: number, muted: boolean): void;
}

/** A MIDI event waiting in the synthesizer's queue. */
interface QueuedEvent {
  isMetronome: boolean;
  event: unknown;
}

/** alphaTab's synthesizer (`TinySoundFont`), as far as the mixing step uses it. */
interface TinySoundFont {
  _fillWorkingBuffer(buffer: Float32Array | null, offset: number, samples: number): QueuedEvent[];
  _midiEventQueue: { isEmpty: boolean; dequeue(): QueuedEvent };
  _voices: Voice[];
  _mutedChannels: Map<number, boolean>;
  _soloChannels: Map<number, boolean>;
  _isAnySolo: boolean;
  _metronomeChannel: number;
  metronomeVolume: number;
  channelNoteOff(channel: number, key: number): void;
  channelNoteOn(channel: number, key: number, velocity: number): void;
  processMidiMessage(event: unknown): void;
}

/** alphaTab's own metronome key (`SynthConstants.MetronomeKey`); Frets plays its own clicks instead. */
const METRONOME_KEY = 33;

/**
 * The dry channels' samples, made beside each block of main samples the synthesizer fills. A block is
 * known by its memory, which the part of it handed to the output (`subarray`) shares.
 */
export class DrySamples {
  private readonly blocks = new WeakMap<ArrayBufferLike, Float32Array>();

  /** The dry samples beside `main`, made empty on first use. */
  beside(main: Float32Array): Float32Array {
    let dry = this.blocks.get(main.buffer);
    if (!dry) {
      dry = new Float32Array(main.buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
      this.blocks.set(main.buffer, dry);
    }
    return dry;
  }

  /** The dry samples for the stretch of a block `main` is, and forgets the block; null when none were made. */
  take(main: Float32Array): Float32Array | null {
    const dry = this.blocks.get(main.buffer);
    if (!dry) return null;
    this.blocks.delete(main.buffer);
    const from = main.byteOffset / Float32Array.BYTES_PER_ELEMENT;
    return dry.subarray(from, from + main.length);
  }
}

/**
 * Renders `channels` into their own samples from now on: the synthesizer leaves them out of the
 * samples it hands the output, and `dry.take` gives them for each block it does hand over.
 */
export function keepDry(synth: AlphaTabModule.synth.AlphaSynth, channels: readonly number[], dry: DrySamples) {
  const tsf = (synth as unknown as { synthesizer: TinySoundFont }).synthesizer;
  const isDry = new Set(channels);
  tsf._fillWorkingBuffer = function fill(buffer, offset, samples) {
    const anySolo = this._isAnySolo;
    const processed: QueuedEvent[] = [];
    while (!this._midiEventQueue.isEmpty) {
      const m = this._midiEventQueue.dequeue();
      if (m.isMetronome && this.metronomeVolume > 0) {
        this.channelNoteOff(this._metronomeChannel, METRONOME_KEY);
        this.channelNoteOn(this._metronomeChannel, METRONOME_KEY, 95 / 127);
      } else if (m.event) this.processMidiMessage(m.event);
      processed.push(m);
    }
    for (const voice of this._voices) {
      if (voice.playingPreset === -1) continue;
      const channel = voice.playingChannel;
      const muted = this._mutedChannels.has(channel) || (anySolo && channel !== this._metronomeChannel && !this._soloChannels.has(channel));
      if (!buffer) voice.kill();
      // The one change: a dry channel's voice goes into the samples beside the block.
      else voice.render(this, isDry.has(channel) ? dry.beside(buffer) : buffer, offset, samples, muted);
    }
    return processed;
  };
}
