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
export const DECAY_SECONDS = { min: 0.3, max: 5, start: 1.5 };

export const NO_EFFECTS: EffectSettings = { drive: 0, tone: 0.5, reverb: 0, decay: DECAY_SECONDS.start };

/**
 * The FX as saved and set in the FX dialog (Jeremy, 2026-10-28): each effect's own switch and
 * knobs, and `on`, the light switch on the FX button that turns them all on or off together.
 */
export interface FxSettings extends EffectSettings {
  on: boolean;
  distortionOn: boolean;
  reverbOn: boolean;
}

/** The FX at first: all off by the FX button, each effect ready at a middling setting. */
export const DEFAULT_FX: FxSettings = {
  on: false, distortionOn: true, drive: 0.5, tone: 0.5, reverbOn: true, reverb: 0.3, decay: DECAY_SECONDS.start,
};

/** A saved number in a range, else its default. */
const numberIn = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && value >= min && value <= max ? value : fallback;

/** A saved switch, else its default. */
const switchOr = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Saved or linked FX, each field checked on its own; anything missing or wrong takes its default. */
export function parseEffects(saved: unknown): FxSettings {
  const fields = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  return {
    on: switchOr(fields.on, DEFAULT_FX.on),
    distortionOn: switchOr(fields.distortionOn, DEFAULT_FX.distortionOn),
    drive: numberIn(fields.drive, 0, 1, DEFAULT_FX.drive),
    tone: numberIn(fields.tone, 0, 1, DEFAULT_FX.tone),
    reverbOn: switchOr(fields.reverbOn, DEFAULT_FX.reverbOn),
    reverb: numberIn(fields.reverb, 0, 1, DEFAULT_FX.reverb),
    decay: numberIn(fields.decay, DECAY_SECONDS.min, DECAY_SECONDS.max, DEFAULT_FX.decay),
  };
}

/** What is heard from the FX: an effect switched off, or every one by the FX button, is at 0. */
export function heardEffects(fx: FxSettings): EffectSettings {
  return {
    drive: fx.on && fx.distortionOn ? fx.drive : 0,
    tone: fx.tone,
    reverb: fx.on && fx.reverbOn ? fx.reverb : 0,
    decay: fx.decay,
  };
}

/** The plate's tone, 0 (darkest) to 100: fmlab's default. */
const PLATE_TONE = 70;

/** How quickly a knob's change is heard, in seconds (to about two thirds): quick, without a click. */
const GLIDE_SECONDS = 0.02;

/** The gain into the first shaper at the lowest Drive above 0 and at full Drive, in dB. */
const DRIVE_DB = { min: 6, max: 46 };

/**
 * The gain into the distortion's first shaper for a Drive: 6 dB at the lowest, rising evenly in dB
 * to 46 dB at full, so each turn of the knob sounds like the same step.
 */
export function driveGain(drive: number): number {
  return 10 ** ((DRIVE_DB.min + drive * (DRIVE_DB.max - DRIVE_DB.min)) / 20);
}

/**
 * The second stage's drive, in dB: so quiet below halfway that its shaper barely bends the sound,
 * then rising to a hard push at full.
 */
const SECOND_STAGE = { from: 0.5, quietDB: -20, fullDB: 12 };

/**
 * The second stage, as a high-gain amp's next valve (Jeremy, 2026-10-28: "more distortion effect
 * at 100%"): the first shaper's sound goes on into a second one. Below halfway up the knob it goes
 * in so quietly the shaper leaves it alone; from there its drive rises to full. `gain` is the push
 * in, `back` the level out that undoes it while the shaper is still gentle.
 */
export function secondStage(drive: number): { gain: number; back: number } {
  const t = Math.min(1, Math.max(0, (drive - SECOND_STAGE.from) / (1 - SECOND_STAGE.from)));
  const gain = 10 ** ((SECOND_STAGE.quietDB + t * (SECOND_STAGE.fullDB - SECOND_STAGE.quietDB)) / 20);
  // While the push is gentle the shaper is nearly a straight line of slope CURVE_SLOPE; undo it.
  const push = gain * CURVE_SLOPE;
  return { gain, back: push < 1 ? 1 / push : 1 };
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
  for (let i = 0; i < points; i++) curve[i] = shape((i / (points - 1)) * 2 - 1);
  return curve;
}

/** The curve's lean and hardness. */
const BIAS = 0.25;
const HARDNESS = 2.5;
/** Scaled so the curve's ends are at ±1 for the larger side. */
const CURVE_SCALE = Math.max(Math.tanh(HARDNESS + BIAS) - Math.tanh(BIAS), Math.tanh(BIAS) - Math.tanh(-HARDNESS + BIAS));

/** The curve at one point, -1 to 1. */
function shape(x: number): number {
  return (Math.tanh(HARDNESS * x + BIAS) - Math.tanh(BIAS)) / CURVE_SCALE;
}

/** How steep the curve is at silence: how much it boosts a quiet sound. */
export const CURVE_SLOPE = (HARDNESS * (1 - Math.tanh(BIAS) ** 2)) / CURVE_SCALE;

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
 *          └ drive → tighten → shaper → shaper → tone → cab ┘ └ plate → wet ┘
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
  /** The second stage's push in and level out. */
  private readonly secondDrive: GainNode;
  private readonly secondBack: GainNode;
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
    this.secondDrive = gain(secondStage(0).gain);
    this.secondBack = gain(secondStage(0).back);
    this.tone = filter('lowpass', toneFrequency(NO_EFFECTS.tone));
    this.wet = gain(0);
    this.ring = context.createConvolver();

    // Distortion: lows thinned before the shaper so chords don't turn to mud, and a push in the
    // mids, as an overdrive pedal has; after it, the tone and a speaker cabinet's shape (no deep
    // lows, a bump at 110 Hz, a dip at 400 Hz, presence at 2.2 kHz, little past 6.5 kHz).
    const shaper = () => {
      const node = context.createWaveShaper();
      node.curve = distortionCurve();
      node.oversample = '4x';
      return node;
    };
    const distorted = chain([
      this.drive,
      filter('highpass', 140),
      filter('peaking', 900, 0.8, 5),
      shaper(),
      // The second stage, the lows thinned a little again between the two, as amps do.
      filter('highpass', 100),
      this.secondDrive,
      shaper(),
      this.secondBack,
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
    const second = secondStage(settings.drive);
    glide(this.secondDrive.gain, second.gain);
    glide(this.secondBack.gain, second.back);
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
