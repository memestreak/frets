/**
 * The small Web Audio output `playback.ts` plays alphaTab's synthesizer through, on the main thread:
 * the samples it makes, queued and played by a ScriptProcessorNode. The dry channels' samples
 * (`dryChannels.ts`: the clicks) come with each block and are played past the effects.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import { DrySamples } from './dryChannels';
import { EffectsChain, NO_EFFECTS, type EffectSettings } from './effects';

/** A list of listeners, as alphaTab's outputs report events. */
class Emitter<T = void> {
  private listeners: ((arg: T) => void)[] = [];
  on(listener: (arg: T) => void) {
    this.listeners.push(listener);
    return () => this.off(listener);
  }
  off(listener: (arg: T) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  trigger(arg: T) {
    for (const listener of this.listeners) listener(arg);
  }
}

/**
 * The synthesizer's sample rate. alphaTab reads it from the output before the output opens, so it
 * is fixed; the AudioContext is made at the same rate, and the browser converts it for the speakers.
 */
const SAMPLE_RATE = 44100;
/** Samples per channel the audio node asks for at a time. */
const NODE_SIZE = 4096;
/** About how many samples (both channels) one answer from the synthesizer holds. */
const ANSWER_SIZE = 4096;
/** How long the end of playback fades, so it doesn't click. */
const FADE_SECONDS = 0.03;
/** How long Stop fades the sound out (Jeremy, 2026-10-27: "the notes stop with a glitch"). */
const STOP_FADE_SECONDS = 0.06;

/** A block of interleaved stereo samples: the main ones, and the dry ones beside them, if any. */
interface Chunk {
  main: Float32Array;
  dry: Float32Array | null;
}

/** The node's four outputs: the main sound's left and right, then the dry sound's. */
interface Channels {
  left: Float32Array;
  right: Float32Array;
  dryLeft: Float32Array;
  dryRight: Float32Array;
}

/** Interleaved stereo samples waiting to be played. */
class SampleQueue {
  chunks: Chunk[] = [];
  /** How many samples (both channels) are queued. */
  size = 0;
  push(main: Float32Array, dry: Float32Array | null) {
    this.chunks.push({ main, dry });
    this.size += main.length;
  }
  /** Moves queued samples into the channels from their start; returns how many frames it filled. */
  drainInto({ left, right, dryLeft, dryRight }: Channels): number {
    let i = 0;
    while (i < left.length && this.chunks.length > 0) {
      const { main, dry } = this.chunks[0];
      let s = 0;
      while (i < left.length && s + 1 < main.length) {
        left[i] = main[s];
        right[i] = main[s + 1];
        dryLeft[i] = dry ? dry[s] : 0;
        dryRight[i] = dry ? dry[s + 1] : 0;
        i++;
        s += 2;
      }
      this.size -= s;
      if (s >= main.length - 1) this.chunks.shift();
      else this.chunks[0] = { main: main.subarray(s), dry: dry && dry.subarray(s) };
    }
    for (const channel of [left, right, dryLeft, dryRight]) channel.fill(0, i);
    return i;
  }
}

/** The node's output buffer as its four channels. */
function channelsOf(buffer: AudioBuffer): Channels {
  const [left, right, dryLeft, dryRight] = [0, 1, 2, 3].map(c => buffer.getChannelData(c));
  return { left, right, dryLeft, dryRight };
}

/**
 * The synthesizer's samples played through a ScriptProcessorNode (alphaTab's own fallback; an
 * AudioWorklet would need a script of its own served beside the page). The synthesizer fills a
 * queue of interleaved stereo samples; the node drains it and asks for more when it runs low.
 * The AudioContext is made on the first play, not when the output opens, so the synthesizer can be
 * made and its sounds loaded before any press (a browser only lets a context start after one).
 */
export class WebAudioOutput implements AlphaTabModule.synth.ISynthOutput {
  readonly ready = new Emitter();
  readonly samplesPlayed = new Emitter<number>();
  readonly sampleRequest = new Emitter();
  /** The dry channels' samples beside each block the synthesizer hands over (`dryChannels.ts`). */
  readonly dry = new DrySamples();
  private context: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  /** Between the node and the effects, so Stop can fade the sound out (and a reverb rings on). */
  private gain: GainNode | null = null;
  /** The effects and the volume, between the fade and the speakers; made with the AudioContext. */
  private effects: EffectsChain | null = null;
  private effectSettings: EffectSettings = NO_EFFECTS;
  private volume = 1;
  private samples = new SampleQueue();
  /** The block of samples handed to the speakers last: when it starts sounding, and how long it is. */
  private lastBlock: { playbackTime: number; seconds: number } | null = null;
  /** Requests made and not yet answered by `addSamples`. */
  private pending = 0;
  /** How many samples (both channels) to keep ready. */
  private target = 0;
  /** Whether the last answer held no samples: the clip has ended. */
  private answeredEmpty = false;

  get sampleRate() {
    return SAMPLE_RATE;
  }
  open(bufferTimeInMilliseconds: number) {
    this.target = Math.max(NODE_SIZE * 2, Math.floor((bufferTimeInMilliseconds * this.sampleRate) / 1000)) * 2;
    this.ready.trigger();
  }
  activate() {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.effects = new EffectsChain(this.context);
      this.effects.set(this.effectSettings);
      this.effects.setVolume(this.volume);
      this.effects.output.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }
  play() {
    this.activate();
    const { context, effects } = this;
    if (!context || !effects) return;
    this.resetSamples();
    // Four channels: the main sound's two, into the effects, and the dry sound's two, past them.
    const node = context.createScriptProcessor(NODE_SIZE, 0, 4);
    const gain = context.createGain();
    const split = context.createChannelSplitter(4);
    const main = context.createChannelMerger(2);
    const dry = context.createChannelMerger(2);
    node.onaudioprocess = e => this.fill(e.outputBuffer, e.playbackTime);
    node.connect(gain).connect(split);
    split.connect(main, 0, 0);
    split.connect(main, 1, 1);
    split.connect(dry, 2, 0);
    split.connect(dry, 3, 1);
    main.connect(effects.input);
    dry.connect(effects.dryInput);
    this.node = node;
    this.gain = gain;
    this.request();
  }
  /**
   * Stops asking for samples. Cut off at once the sound would click, so the node plays on a moment
   * from what was queued, alone, while its gain fades to nothing; then it is disconnected.
   */
  pause() {
    const { context, node, gain } = this;
    this.node = null;
    this.gain = null;
    if (!node || !gain) return;
    if (!context || context.state !== 'running') {
      node.onaudioprocess = null;
      node.disconnect();
      return;
    }
    const tail = this.samples;
    this.samples = new SampleQueue();
    node.onaudioprocess = e => tail.drainInto(channelsOf(e.outputBuffer));
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
    // Long enough for the fade to reach the speakers through the node's own buffer.
    setTimeout(() => {
      node.onaudioprocess = null;
      node.disconnect();
      gain.disconnect();
    }, (STOP_FADE_SECONDS + (2 * NODE_SIZE) / context.sampleRate) * 1000);
  }
  /** Sets the effects (`effects.ts`); what is playing follows at once. */
  setEffects(settings: EffectSettings) {
    this.effectSettings = settings;
    this.effects?.set(settings);
  }
  /**
   * Sets the volume, 0 to 1, after the effects: turned down, a distorted sound is quieter, not
   * cleaner. Set here rather than in the synthesizer, it is heard at once.
   */
  setVolume(volume: number) {
    this.volume = volume;
    this.effects?.setVolume(volume);
  }
  destroy() {
    this.pause();
    void this.context?.close();
    this.context = null;
    this.effects = null;
  }
  addSamples(samples: Float32Array) {
    this.pending = Math.max(0, this.pending - 1);
    // The synthesizer has stopped: fade what is left to nothing, so it ends without a click.
    if (samples.length === 0 && !this.answeredEmpty) this.fadeQueueOut();
    this.answeredEmpty = samples.length === 0;
    const dry = this.dry.take(samples);
    if (samples.length > 0) this.samples.push(samples, dry);
  }
  resetSamples() {
    this.samples = new SampleQueue();
    this.pending = 0;
  }
  enumerateOutputDevices() {
    return Promise.resolve([]);
  }
  setOutputDevice() {
    return Promise.resolve();
  }
  getOutputDevice() {
    return Promise.resolve(null);
  }

  /**
   * Asks the synthesizer for samples until enough are queued or asked for. It answers at once, on
   * this thread, and with nothing once the clip has ended; then asking stops until the next fill.
   */
  private request() {
    while (this.samples.size + this.pending * ANSWER_SIZE < this.target) {
      this.pending++;
      this.answeredEmpty = false;
      this.sampleRequest.trigger();
      if (this.answeredEmpty) return;
    }
  }

  /** Fades the last few milliseconds queued down to silence. */
  private fadeQueueOut() {
    let left = Math.floor(FADE_SECONDS * this.sampleRate) * 2;
    const total = left;
    const chunks = this.samples.chunks;
    for (let c = chunks.length - 1; c >= 0 && left > 0; c--) {
      // Copied: the synthesizer may reuse the array it handed over.
      const main = chunks[c].main.slice();
      const dry = chunks[c].dry?.slice() ?? null;
      for (let i = main.length - 1; i >= 0 && left > 0; i--, left--) {
        // Interleaved stereo: both samples of a frame get the same gain.
        const frameFromEnd = Math.floor((total - left) / 2);
        main[i] *= frameFromEnd / (total / 2);
        if (dry) dry[i] *= frameFromEnd / (total / 2);
      }
      chunks[c] = { main, dry };
    }
  }

  /**
   * How far, in milliseconds, the synthesizer's position is ahead of what is heard now. It counts a
   * block of samples as played once handed over, but the block sounds a little later and over its
   * own length, and the speakers add their own delay.
   */
  aheadMs(): number {
    const context = this.context;
    if (!context || !this.lastBlock) return 0;
    const delay = context.outputLatency || context.baseLatency || 0;
    return (this.lastBlock.playbackTime + this.lastBlock.seconds - context.currentTime + delay) * 1000;
  }

  private fill(buffer: AudioBuffer, playbackTime: number) {
    const frames = this.samples.drainInto(channelsOf(buffer));
    this.lastBlock = { playbackTime, seconds: frames / buffer.sampleRate };
    this.samplesPlayed.trigger(frames);
    this.request();
  }
}

/* — the player — */
