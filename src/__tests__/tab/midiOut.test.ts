/**
 * Tab's playback out over MIDI (issue #457; `docs/specs/2026-11-09-tab-midi-out-design.md`): the
 * saved section, an event as the bytes sent, the tap's timing and note ends, and the tap on alphaTab's
 * real synthesizer.
 */
import * as alphaTab from '@coderline/alphatab';
import {
  BEND_RANGE, DEFAULT_MIDI, MidiTap, channelOf, messageOf, parseMidiSettings, setupMessages, tapSynth, type SampleClock,
} from '@/features/tab/midiOut';
import { clickSoundFont } from '@/features/tab/click';

const RATE = 44100;
const NOTE_ON = 128;
const NOTE_OFF = 144;
const CONTROL_CHANGE = 176;
const PROGRAM_CHANGE = 192;
const PITCH_BEND = 224;
const LOCAL = new Set([10, 11]);
const routing = (channel = 2, transpose = 0) => ({ channel, transpose, local: LOCAL });

describe('the MIDI output section', () => {
  it('defaults to no port, the built-in sound quiet, and Track N on channel N', () => {
    const settings = parseMidiSettings(undefined);
    expect(settings).toEqual(DEFAULT_MIDI);
    expect(settings).toEqual({ port: '', builtIn: false, channels: [] });
    expect(channelOf(settings, 0)).toBe(1);
    expect(channelOf(settings, 2)).toBe(3);
    expect(channelOf(settings, 19)).toBe(16);
  });

  it('takes its default for a bad port, flag or channel, and keeps a good one', () => {
    expect(parseMidiSettings({ port: 3, builtIn: 'yes', channels: 'x' })).toEqual(DEFAULT_MIDI);
    const settings = parseMidiSettings({ port: 'IAC Driver Bus 1', builtIn: true, channels: [5, 0, 17, 1.5, '4', 9] });
    expect(settings.port).toBe('IAC Driver Bus 1');
    expect(settings.builtIn).toBe(true);
    // Each bad one is its own track's default, so the tracks after it keep their place.
    expect(settings.channels).toEqual([5, 2, 3, 4, 5, 9]);
    expect(channelOf(settings, 0)).toBe(5);
    expect(channelOf(settings, 5)).toBe(9);
  });
});

describe('an event as the bytes sent', () => {
  it('sends notes on the track\'s channel, from both of alphaTab\'s', () => {
    expect(messageOf({ type: NOTE_ON, channel: 0, noteKey: 60, noteVelocity: 100 }, routing())).toEqual([0x92, 60, 100]);
    expect(messageOf({ type: NOTE_OFF, channel: 0, noteKey: 60, noteVelocity: 0 }, routing())).toEqual([0x82, 60, 0]);
    expect(messageOf({ type: NOTE_ON, channel: 1, noteKey: 64, noteVelocity: 90 }, routing())).toEqual([0x92, 64, 90]);
  });

  it('sends pitch bends and controllers, but no program or bank changes', () => {
    expect(messageOf({ type: PITCH_BEND, channel: 1, value: 8192 + 4096 }, routing())).toEqual([0xe2, 0, 96]);
    expect(messageOf({ type: CONTROL_CHANGE, channel: 0, controller: 7, value: 100 }, routing())).toEqual([0xb2, 7, 100]);
    expect(messageOf({ type: PROGRAM_CHANGE, channel: 0, value: 25 }, routing())).toBeNull();
    expect(messageOf({ type: CONTROL_CHANGE, channel: 0, controller: 0, value: 1 }, routing())).toBeNull();
    expect(messageOf({ type: CONTROL_CHANGE, channel: 0, controller: 32, value: 1 }, routing())).toBeNull();
  });

  it('keeps the metronome and count-in clicks in Tab', () => {
    expect(messageOf({ type: NOTE_ON, channel: 10, noteKey: 76, noteVelocity: 110 }, routing())).toBeNull();
    expect(messageOf({ type: NOTE_ON, channel: 11, noteKey: 77, noteVelocity: 80 }, routing())).toBeNull();
  });

  it('moves notes by the transposition, and sends none pushed out of range', () => {
    expect(messageOf({ type: NOTE_ON, channel: 0, noteKey: 60, noteVelocity: 100 }, routing(2, 2))).toEqual([0x92, 62, 100]);
    expect(messageOf({ type: NOTE_ON, channel: 0, noteKey: 126, noteVelocity: 100 }, routing(2, 2))).toBeNull();
    expect(messageOf({ type: NOTE_ON, channel: 0, noteKey: 1, noteVelocity: 100 }, routing(2, -2))).toBeNull();
  });

  it('sets the pitch bend range alphaTab writes for, and centres the bend', () => {
    expect(setupMessages(3)).toEqual([
      [0xb3, 101, 0], [0xb3, 100, 0], [0xb3, 6, BEND_RANGE], [0xb3, 38, 0], [0xb3, 101, 127], [0xb3, 100, 127], [0xe3, 0, 64],
    ]);
    expect(BEND_RANGE).toBe(16);
  });
});

/** A clock where frame f sounds at `start + f / RATE` seconds, and a port that keeps what it is sent. */
function harness() {
  let now = 1000;
  let handed = 0;
  let requesting = false;
  const clock: SampleClock = { soundsAt: f => 1000 + (f / RATE) * 1000, handedOver: () => handed, requesting: () => requesting };
  const sent: { bytes: number[]; at: number | undefined }[] = [];
  const tap = new MidiTap(clock, LOCAL, () => now, () => false);
  tap.port = { send: (bytes, at) => sent.push({ bytes, at }) };
  tap.channel = 0;
  tap.on = true;
  return {
    tap, sent,
    advance(ms: number) {
      now += ms;
      tap.pump();
    },
    handOver(frames: number) {
      handed += frames;
    },
    request(fn: () => void) {
      requesting = true;
      fn();
      requesting = false;
    },
  };
}

const on = (key: number, channel = 0) => ({ type: NOTE_ON, channel, noteKey: key, noteVelocity: 100 });
const off = (key: number, channel = 0) => ({ type: NOTE_OFF, channel, noteKey: key, noteVelocity: 0 });

describe('the tap', () => {
  afterEach(() => vi.useRealTimers());

  it('times each event by the sample it was rendered at', () => {
    const h = harness();
    h.tap.rendered([on(60)], 4410);
    h.tap.rendered([on(64)], 4410);
    h.advance(1000);
    expect(h.sent.map(s => [s.bytes[1], s.at])).toEqual([[60, 1000], [64, 1100]]);
    h.tap.destroy();
  });

  it('waits to send what is due later, so Stop can drop it', () => {
    const h = harness();
    h.tap.rendered([on(60)], 44100);
    h.tap.rendered([on(64)], 44100);
    h.advance(0);
    // Due a second on: not sent yet.
    expect(h.sent.map(s => s.bytes[1])).toEqual([60]);
    h.tap.release();
    h.advance(2000);
    // The note sent on ends, once; the one not sent never goes.
    expect(h.sent.map(s => s.bytes)).toEqual([[0x90, 60, 100], [0x80, 60, 0]]);
    h.tap.release();
    expect(h.sent).toHaveLength(2);
    h.tap.destroy();
  });

  it('ends a note on the key it started on when Transpose changes under it', () => {
    const h = harness();
    h.tap.rendered([on(60)], 441);
    h.tap.transpose = 3;
    h.tap.rendered([off(60)], 441);
    h.advance(100);
    expect(h.sent.map(s => s.bytes)).toEqual([[0x90, 60, 100], [0x80, 60, 0]]);
    h.tap.destroy();
  });

  it('starts by setting the channel\'s bend range and centring it', () => {
    const h = harness();
    h.tap.channel = 4;
    h.tap.start();
    expect(h.sent.map(s => s.bytes)).toEqual(setupMessages(4));
    h.tap.destroy();
  });

  it('sends nothing until the speakers have taken their first block, then each at its time', () => {
    let anchored = false;
    const sent: number[] = [];
    const clock: SampleClock = { soundsAt: f => (anchored ? 1000 + (f / RATE) * 1000 : null), handedOver: () => 0, requesting: () => false };
    const tap = new MidiTap(clock, LOCAL, () => 2000, () => false);
    tap.port = { send: (_bytes, at) => sent.push(at!) };
    tap.on = true;
    tap.rendered([on(60)], 4410);
    tap.pump();
    expect(sent).toEqual([]);
    anchored = true;
    tap.pump();
    expect(sent).toEqual([1000]);
    tap.destroy();
  });

  it('takes nothing while it is off, as for a note heard on its own', () => {
    const h = harness();
    h.tap.on = false;
    h.tap.rendered([on(60)], 441);
    h.advance(100);
    expect(h.sent).toEqual([]);
    h.tap.destroy();
  });

  it('ends the notes sounding where the synthesizer lets them all go (a loop going round)', () => {
    const h = harness();
    h.tap.rendered([on(60)], 4410);
    h.tap.rendered([], 4410);
    // The synthesizer lets go 200 ms in, in the middle of a request.
    h.request(() => h.tap.releasing());
    h.advance(1000);
    expect(h.sent.map(s => [s.bytes, s.at])).toEqual([[[0x90, 60, 100], 1000], [[0x80, 60, 0], 1200]]);
    h.tap.destroy();
  });

  it('counts frames afresh from what each request found handed over', () => {
    const h = harness();
    h.tap.rendered([], 4410);
    h.handOver(4410);
    h.tap.rendered([on(60)], 4410);
    h.advance(1000);
    expect(h.sent.map(s => s.at)).toEqual([1100]);
    h.tap.destroy();
  });
});

/** An output that answers the synthesizer's requests and counts the frames handed over. */
function countingOutput() {
  const listeners = { ready: [] as (() => void)[], sampleRequest: [] as (() => void)[] };
  const emitter = (list: (() => void)[]) => ({ on: (l: () => void) => list.push(l), off() {} });
  let handed = 0;
  const output = {
    sampleRate: RATE,
    ready: emitter(listeners.ready),
    sampleRequest: emitter(listeners.sampleRequest),
    samplesPlayed: { on() {}, off() {} },
    open() { listeners.ready.forEach(l => l()); },
    activate() {}, play() {}, pause() {}, destroy() {}, resetSamples() {},
    addSamples(samples: Float32Array) { handed += samples.length / 2; },
    enumerateOutputDevices: () => Promise.resolve([]),
    setOutputDevice: () => Promise.resolve(),
    getOutputDevice: () => Promise.resolve(null),
  };
  let requesting = false;
  const request = () => {
    requesting = true;
    listeners.sampleRequest.forEach(l => l());
    requesting = false;
  };
  const clock: SampleClock = { soundsAt: f => (f / RATE) * 1000, handedOver: () => handed, requesting: () => requesting };
  return { output: output as unknown as alphaTab.synth.ISynthOutput, request, clock, handed: () => handed };
}

describe('the tap on alphaTab\'s synthesizer', () => {
  it('sends each note when it sounds, with no program change, and ends what sounds at the end', () => {
    const { output, request, clock, handed } = countingOutput();
    const synth = new alphaTab.synth.AlphaSynth(output, 500);
    synth.loadSoundFont(clickSoundFont(), false);
    const sent: { bytes: number[]; at: number | undefined }[] = [];
    let now = 0;
    const tap = new MidiTap(clock, LOCAL, () => now, () => false);
    tap.port = { send: (bytes, at) => sent.push({ bytes, at }) };
    tap.channel = 0;
    tap.on = true;
    tapSynth(synth, tap);
    const midi = new alphaTab.midi.MidiFile();
    midi.addEvent(new alphaTab.midi.ProgramChangeEvent(0, 0, 0, 25));
    // At 120 bpm: a C at the start for a beat, an E a second in, and a click on the metronome's channel.
    midi.addEvent(new alphaTab.midi.NoteOnEvent(0, 0, 0, 60, 100));
    midi.addEvent(new alphaTab.midi.NoteOffEvent(0, 960, 0, 60, 0));
    midi.addEvent(new alphaTab.midi.NoteOnEvent(0, 1920, 1, 64, 90));
    midi.addEvent(new alphaTab.midi.NoteOnEvent(0, 1920, 10, 76, 110));
    midi.addEvent(new alphaTab.midi.EndOfTrackEvent(0, 2880));
    synth.loadMidiFile(midi);
    synth.play();
    for (let i = 0; i < 200 && handed() < RATE * 2; i++) request();
    // Everything rendered was due by now (the clock's time 0 is the first frame), so pump it all.
    now = 10_000;
    tap.pump();
    const notes = sent.filter(s => (s.bytes[0] & 0xe0) === 0x80);
    expect(notes.map(s => s.bytes)).toEqual([[0x90, 60, 100], [0x80, 60, 0], [0x90, 64, 90], [0x80, 64, 0]]);
    // Each at its own time, to a micro-buffer (64 frames, 1.5 ms): 0 s, half a second, a second.
    expect(notes[0].at).toBeCloseTo(0, -1);
    expect(Math.abs(notes[1].at! - 500)).toBeLessThan(3);
    expect(Math.abs(notes[2].at! - 1000)).toBeLessThan(3);
    // No program change, and nothing from the metronome's channel.
    expect(sent.some(s => (s.bytes[0] & 0xf0) === 0xc0)).toBe(false);
    expect(sent.some(s => s.bytes[1] === 76)).toBe(false);
    tap.destroy();
    synth.destroy();
  });
});
