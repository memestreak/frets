/**
 * The clicks kept out of the effects (Jeremy, 2026-10-30): alphaTab's real synthesizer, with its
 * mixing step replaced (`dryChannels.ts`), renders a dry channel's voices into samples of their own
 * and every other channel's into the samples it hands the output. Played through alphaTab's own
 * code, so an upgrade that changes the internals it reaches into fails here.
 */
import * as alphaTab from '@coderline/alphatab';
import { CLICK_BANK, CLICK_PROGRAM, ACCENT_KEY, clickSoundFont } from '@/features/tab/click';
import { DrySamples, keepDry } from '@/features/tab/dryChannels';

const RATE = 44100;
/** A quarter note at 120 bpm, in ticks: half a second. */
const Q = 960;
const DRY_CHANNEL = 10;

/** An output that keeps every block of samples the synthesizer hands it, and the dry ones beside each. */
function keepingOutput() {
  const listeners = { ready: [] as (() => void)[], sampleRequest: [] as (() => void)[] };
  const emitter = (list: (() => void)[]) => ({ on: (l: () => void) => list.push(l), off() {} });
  const dry = new DrySamples();
  const blocks: { main: Float32Array; dry: Float32Array | null }[] = [];
  const output = {
    sampleRate: RATE,
    ready: emitter(listeners.ready),
    sampleRequest: emitter(listeners.sampleRequest),
    samplesPlayed: { on() {}, off() {} },
    open() { listeners.ready.forEach(l => l()); },
    activate() {}, play() {}, pause() {}, destroy() {}, resetSamples() {},
    addSamples(samples: Float32Array) { blocks.push({ main: samples, dry: dry.take(samples) }); },
    enumerateOutputDevices: () => Promise.resolve([]),
    setOutputDevice: () => Promise.resolve(),
    getOutputDevice: () => Promise.resolve(null),
  };
  const request = () => listeners.sampleRequest.forEach(l => l());
  return { output: output as unknown as alphaTab.synth.ISynthOutput, dry, blocks, request };
}

/** A click on a channel at a tick, in the click's own sound. */
function click(midi: alphaTab.midi.MidiFile, channel: number, tick: number) {
  midi.addEvent(new alphaTab.midi.ControlChangeEvent(0, 0, channel, alphaTab.midi.ControllerType.BankSelectCoarse, CLICK_BANK));
  midi.addEvent(new alphaTab.midi.ProgramChangeEvent(0, 0, channel, CLICK_PROGRAM));
  midi.addEvent(new alphaTab.midi.NoteOnEvent(0, tick, channel, ACCENT_KEY, 100));
  midi.addEvent(new alphaTab.midi.NoteOffEvent(0, tick + Q / 4, channel, ACCENT_KEY, 0));
}

/** The loudest sample in each stretch of `seconds`, from the start. */
function peaks(samples: Float32Array, seconds: number, count: number): number[] {
  const size = Math.round(seconds * RATE) * 2;
  return Array.from({ length: count }, (_, i) => samples.subarray(i * size, (i + 1) * size).reduce((p, x) => Math.max(p, Math.abs(x)), 0));
}

describe('dry channels', () => {
  it('renders a dry channel\'s notes beside the main samples, and every other channel\'s in them', () => {
    const { output, blocks, request, dry } = keepingOutput();
    const synth = new alphaTab.synth.AlphaSynth(output, 500);
    synth.loadSoundFont(clickSoundFont(), false);
    keepDry(synth, [DRY_CHANNEL], dry);
    const midi = new alphaTab.midi.MidiFile();
    // A click on channel 0 at the start, and one on the dry channel a second later.
    click(midi, 0, 0);
    click(midi, DRY_CHANNEL, 2 * Q);
    midi.addEvent(new alphaTab.midi.EndOfTrackEvent(0, 4 * Q));
    synth.loadMidiFile(midi);
    synth.play();
    while (blocks.reduce((n, b) => n + b.main.length, 0) < RATE * 2 * 2) request();

    const join = (pick: (b: (typeof blocks)[number]) => Float32Array) => {
      const parts = blocks.map(pick);
      const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
      parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
      return out;
    };
    // Each click in its own second (the synthesizer starts a note a few blocks early).
    const [mainFirst, mainSecond] = peaks(join(b => b.main), 0.75, 2);
    const [dryFirst, drySecond] = peaks(join(b => b.dry ?? new Float32Array(b.main.length)), 0.75, 2);
    // Channel 0's click is in the main samples only; the dry channel's in the dry ones only.
    expect(mainFirst).toBeGreaterThan(0.05);
    expect(dryFirst).toBe(0);
    expect(drySecond).toBeGreaterThan(0.05);
    expect(mainSecond).toBe(0);
    // Dry samples are made only for a block a dry voice sounds in, and are as long as it.
    expect(blocks.some(b => b.dry === null)).toBe(true);
    expect(blocks.every(b => b.dry === null || b.dry.length === b.main.length)).toBe(true);
    synth.destroy();
  });

  it('gives no dry samples for a block it never made any beside', () => {
    expect(new DrySamples().take(new Float32Array(8))).toBeNull();
  });
});
