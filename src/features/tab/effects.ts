import { PlateReverb } from './plateReverb';

/**
 * Playback effects (issue #199): distortion and reverb, as Web Audio nodes between the synthesizer's
 * output and the speakers. They act on the mixed sound, so a chord distorts as one, like a guitar
 * through an amp, and a note's reverb rings on after Stop. Nothing here needs a recording: the
 * speaker cabinet is a few filters and the reverb is fmlab's plate (`plateReverb.ts`), so there is
 * no licence to keep.
 */

/** The effect settings; a Drive or Reverb of 0 is off. */
export interface EffectSettings {
  /** How hard the sound is driven into distortion, 0 (clean) to 1. */
  drive: number;
  /** The distortion's brightness, dark (0) to bright (1). */
  tone: number;
  /** How much reverb is mixed in, 0 (none) to 1. */
  reverb: number;
  /** How long the reverb rings, to -60 dB, in seconds. */
  decay: number;
}

/** The reverb's ring: its shortest, longest and first, in seconds (fmlab's default, 1.5 s). */
export const DECAY_SECONDS = { min: 0.5, max: 5, start: 1.5 };

export const NO_EFFECTS: EffectSettings = { drive: 0, tone: 0.5, reverb: 0, decay: DECAY_SECONDS.start };

/** The plate's tone, 0 (darkest) to 100: fmlab's default. */
const PLATE_TONE = 70;

/** How quickly a knob's change is heard, in seconds (to about two thirds): quick, without a click. */
const GLIDE_SECONDS = 0.02;

/** The gain into the shaper at the lowest Drive above 0 and at full Drive, in dB. */
const DRIVE_DB = { min: 6, max: 46 };

/**
 * The gain into the distortion's shaper for a Drive: 6 dB at the lowest, rising evenly in dB to
 * 46 dB at full, so each turn of the knob sounds like the same step.
 */
export function driveGain(drive: number): number {
  return 10 ** ((DRIVE_DB.min + drive * (DRIVE_DB.max - DRIVE_DB.min)) / 20);
}

/**
 * The level after the distortion, so a distorted sound is about as loud as a clean one: a driven
 * signal is squashed towards full scale, louder the harder it is driven.
 */
export function driveMakeup(drive: number): number {
  return 0.19 / (1 + 1.2 * drive);
}

/** The distortion's darkest and brightest top end, in Hz. */
const TONE_HZ = { min: 1200, max: 6000 };

/** Where the tone's low-pass sits, from dark to bright, evenly in pitch. */
export function toneFrequency(tone: number): number {
  return TONE_HZ.min * (TONE_HZ.max / TONE_HZ.min) ** tone;
}

/**
 * How loud the ring is for a Reverb setting, the dry sound staying full. The plate rings loud
 * (fmlab's default mix is wet 0.5), so even the full knob is a little under that.
 */
export function reverbWet(amount: number): number {
  return 0.45 * amount;
}

/**
 * The shaper's curve: a soft clip (tanh) that leans a little to one side, as a valve does, which
 * adds the even harmonics that make it sound warm rather than buzzy. Maps -1..1 to about -1..1.
 */
export function distortionCurve(points = 2049): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  const bias = 0.25;
  const hardness = 2.5;
  const shift = Math.tanh(bias);
  // Scaled so the curve's ends are at ±1 for the larger side.
  const scale = Math.max(Math.tanh(hardness + bias) - shift, shift - Math.tanh(-hardness + bias));
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    curve[i] = (Math.tanh(hardness * x + bias) - shift) / scale;
  }
  return curve;
}

/**
 * The plate's impulse response, one per ear: fmlab's plate (`plateReverb.ts`, Dattorro's) struck
 * once and recorded, wet only, until it has rung out. A ConvolverNode then plays any sound through
 * it, off the main thread.
 */
export function plateImpulse(sampleRate: number, seconds: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const plate = new PlateReverb(sampleRate);
  plate.set({ seconds, tone: PLATE_TONE, mix: 100, preDelay: 0 }, true);
  // Past -60 dB, with room for the diffusers to fill the tank first.
  const length = Math.ceil((seconds * 1.2 + 0.1) * sampleRate);
  const input = new Float32Array(length);
  input[0] = 1;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const block = 128;
  for (let at = 0; at < length; at += block) {
    const n = Math.min(block, length - at);
    plate.process(input.subarray(at, at + n), left.subarray(at, at + n), right.subarray(at, at + n), n);
  }
  return [left, right];
}

/**
 * The effects, as one chain of nodes made once for an AudioContext: `input` takes the synthesizer's
 * sound and `output` goes to the speakers. Distortion comes first, then reverb, as on a guitarist's
 * board. Each effect is always connected and faded in or out by gains, so a change never clicks.
 *
 *   input ─┬─────────────── clean ────────────────┬─┬─────────────┬─ volume → limiter → output
 *          └ drive → tighten → shaper → tone → cab ┘ └ plate → wet ┘
 */
export class EffectsChain {
  readonly input: GainNode;
  /** After the volume, a limiter, so distortion and reverb together never clip the speakers. */
  readonly output: DynamicsCompressorNode;
  private readonly volume: GainNode;
  private readonly context: BaseAudioContext;
  private readonly clean: GainNode;
  private readonly drive: GainNode;
  private readonly makeup: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly wet: GainNode;
  private readonly ring: ConvolverNode;
  /** The decay the ring was made for, or null before any reverb was wanted. */
  private ringSeconds: number | null = null;

  constructor(context: BaseAudioContext) {
    this.context = context;
    const gain = (value: number) => {
      const node = context.createGain();
      node.gain.value = value;
      return node;
    };
    const filter = (type: BiquadFilterType, frequency: number, q = 0.707, dB = 0) => {
      const node = context.createBiquadFilter();
      node.type = type;
      node.frequency.value = frequency;
      node.Q.value = q;
      node.gain.value = dB;
      return node;
    };
    this.input = gain(1);
    this.volume = gain(1);
    this.output = context.createDynamicsCompressor();
    this.output.threshold.value = -3;
    this.output.knee.value = 0;
    this.output.ratio.value = 20;
    this.output.attack.value = 0.002;
    this.output.release.value = 0.1;
    this.volume.connect(this.output);
    this.clean = gain(1);
    this.drive = gain(driveGain(0));
    this.makeup = gain(0);
    this.tone = filter('lowpass', toneFrequency(NO_EFFECTS.tone));
    this.wet = gain(0);
    this.ring = context.createConvolver();

    // Distortion: lows thinned before the shaper so chords don't turn to mud, and a push in the
    // mids, as an overdrive pedal has; after it, the tone and a speaker cabinet's shape (no deep
    // lows, a bump at 110 Hz, a dip at 400 Hz, presence at 2.2 kHz, little past 6.5 kHz).
    const shaper = context.createWaveShaper();
    shaper.curve = distortionCurve();
    shaper.oversample = '4x';
    const distorted = chain([
      this.drive,
      filter('highpass', 140),
      filter('peaking', 900, 0.8, 5),
      shaper,
      this.tone,
      filter('highpass', 80),
      filter('peaking', 110, 1, 3),
      filter('peaking', 400, 1, -4),
      filter('peaking', 2200, 1, 4),
      filter('lowpass', 6500),
      this.makeup,
    ]);
    const afterDistortion = gain(1);
    this.input.connect(this.clean).connect(afterDistortion);
    this.input.connect(distorted.first);
    distorted.last.connect(afterDistortion);

    // Reverb: the dry sound and the ring side by side. The ring is the plate's own level.
    this.ring.normalize = false;
    afterDistortion.connect(this.volume);
    afterDistortion.connect(this.ring).connect(this.wet).connect(this.volume);
  }

  /** Sets every effect; what is playing follows at once. */
  set(settings: EffectSettings) {
    const now = this.context.currentTime;
    const glide = (param: AudioParam, value: number) => param.setTargetAtTime(value, now, GLIDE_SECONDS);
    const on = settings.drive > 0;
    glide(this.clean.gain, on ? 0 : 1);
    glide(this.makeup.gain, on ? driveMakeup(settings.drive) : 0);
    glide(this.drive.gain, driveGain(settings.drive));
    glide(this.tone.frequency, toneFrequency(settings.tone));
    if (settings.reverb > 0 && settings.decay !== this.ringSeconds) {
      // The ring is made only once a reverb is wanted, and again when its decay changes.
      const [left, right] = plateImpulse(this.context.sampleRate, settings.decay);
      const impulse = this.context.createBuffer(2, left.length, this.context.sampleRate);
      impulse.copyToChannel(left, 0);
      impulse.copyToChannel(right, 1);
      this.ring.buffer = impulse;
      this.ringSeconds = settings.decay;
    }
    glide(this.wet.gain, reverbWet(settings.reverb));
  }

  /** The volume, 0 to 1, after every effect, so turning it down doesn't change how distorted it sounds. */
  setVolume(volume: number) {
    this.volume.gain.setTargetAtTime(volume, this.context.currentTime, GLIDE_SECONDS);
  }
}

/** Connects nodes one after another. */
function chain(nodes: AudioNode[]): { first: AudioNode; last: AudioNode } {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
  return { first: nodes[0], last: nodes[nodes.length - 1] };
}
