/**
 * The playback output's volume: set on a gain after the effects (issue #199), so a turn of the
 * Volume knob is heard at once rather than after the half second the synthesizer renders ahead
 * (Jeremy, 2026-10-28), and turning it down doesn't change how distorted the sound is. And the dry
 * sound (the metronome's clicks, Jeremy, 2026-10-30) goes to the volume past every effect. And a note
 * heard while editing rings on beside the next one (issue #258).
 */
import { WebAudioOutput } from '@/features/tab/audioOutput';

/** An AudioParam stand-in: its value and the last target it was sent towards. */
function param(value = 0) {
  return {
    value, target: null as number | null,
    setTargetAtTime(v: number) { this.target = v; },
    cancelScheduledValues() {},
    setValueAtTime(v: number) { this.value = v; },
    linearRampToValueAtTime(v: number) { this.target = v; },
  };
}

/** A stand-in AudioContext with just what the output and its effects use, keeping what each node is connected to. */
function fakeAudio() {
  type Node = { kind: string; next: { to: Node; output: number }[]; gain: ReturnType<typeof param>; [key: string]: unknown };
  const nodes: Node[] = [];
  const make = (kind: string, extra: Record<string, unknown> = {}): Node => {
    const node: Node = {
      kind, next: [], gain: param(1),
      connect(to: Node, output = 0) { node.next.push({ to, output }); return to; },
      disconnected: false,
      disconnect() { node.disconnected = true; },
      ...extra,
    };
    nodes.push(node);
    return node;
  };
  class FakeContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    destination = make('destination');
    resume() { return Promise.resolve(); }
    createScriptProcessor() { return make('script', { onaudioprocess: null }); }
    createGain() { return make('gain'); }
    createChannelSplitter() { return make('splitter'); }
    createChannelMerger() { return make('merger'); }
    createBiquadFilter() { return make('filter', { frequency: param(), Q: param() }); }
    createWaveShaper() { return make('shaper'); }
    createConvolver() { return make('convolver'); }
    createDynamicsCompressor() {
      return make('limiter', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
    }
  }
  /** The gain that feeds the limiter just before the speakers: the volume. */
  const volume = () => nodes.find(n => n.kind === 'gain' && n.next.some(m => m.to.kind === 'limiter'))!;
  /** Every node a node's output `output` reaches, itself first. */
  const reached = (from: Node, output?: number): Node[] => {
    const seen = new Set<Node>([from]);
    const stack = from.next.filter(e => output === undefined || e.output === output).map(e => e.to);
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (seen.has(node)) continue;
      seen.add(node);
      stack.push(...node.next.map(e => e.to));
    }
    return [...seen];
  };
  return { FakeContext, nodes, volume, reached };
}

describe('playback output volume', () => {
  it('turns the sound at once, after the effects, and starts the next Play at it', () => {
    const { FakeContext, volume } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    try {
      const output = new WebAudioOutput();
      output.open(500);
      output.setVolume(0.4);
      output.play();
      expect(volume().gain.target).toBe(0.4);
      // Turned while playing: the gain moves toward the new volume straight away.
      output.setVolume(0.1);
      expect(volume().gain.target).toBe(0.1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('takes the dry sound to the volume past the effects, and the main sound through them', () => {
    const { FakeContext, nodes, volume, reached } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    try {
      const output = new WebAudioOutput();
      output.open(500);
      output.play();
      const split = nodes.find(n => n.kind === 'splitter')!;
      const effectNodes = ['shaper', 'convolver'];
      // Outputs 0 and 1 (left and right of the main sound) reach the distortion and the reverb.
      for (const channel of [0, 1]) expect(reached(split, channel).some(n => effectNodes.includes(n.kind))).toBe(true);
      // Outputs 2 and 3 (the dry sound) reach the volume and the speakers, and no effect.
      for (const channel of [2, 3]) {
        const dry = reached(split, channel);
        expect(dry).toContain(volume());
        expect(dry.some(n => n.kind === 'destination')).toBe(true);
        expect(dry.some(n => effectNodes.includes(n.kind))).toBe(false);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/** A buffer of the node's four channels, `frames` long, for a call of its `onaudioprocess`. */
function outputBuffer(frames: number) {
  const channels = [0, 1, 2, 3].map(() => new Float32Array(frames));
  return { channels, buffer: { getChannelData: (c: number) => channels[c] } };
}

describe('a sound left to ring on', () => {
  /**
   * An output playing, with a stand-in synthesizer that answers each request with a block of 0.5s
   * until `blocks` have been made, then with nothing; and a way to run a script node once.
   */
  function ringingSetup(blocks: number) {
    const audio = fakeAudio();
    vi.stubGlobal('AudioContext', audio.FakeContext);
    vi.useFakeTimers();
    const output = new WebAudioOutput();
    let made = 0;
    output.sampleRequest.on(() => {
      output.addSamples(made < blocks ? new Float32Array(1000).fill(0.5 + made++) : new Float32Array(0));
    });
    output.open(10);
    output.play();
    const scripts = () => audio.nodes.filter(n => n.kind === 'script');
    const run = (node: { [key: string]: unknown }, frames: number) => {
      const { channels, buffer } = outputBuffer(frames);
      (node.onaudioprocess as ((e: unknown) => void) | null)?.({ outputBuffer: buffer, playbackTime: 0 });
      return channels;
    };
    return { ...audio, output, scripts, run, made: () => made };
  }
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the rest of the sound and plays it to its end on its own node, unfaded', () => {
    const { output, scripts, run, made } = ringingSetup(6);
    const first = scripts()[0];
    output.ringOn();
    // Every block the synthesizer had left was rendered at once.
    expect(made()).toBe(6);
    // A new sound starts on a node of its own; the ringing node plays on.
    output.play();
    expect(scripts()).toHaveLength(2);
    expect(first.disconnected).toBe(false);
    expect(first.gain.target).toBeNull();
    // It plays all 6 blocks (500 frames each), then lets go.
    let frames = 0;
    for (let i = 0; i < 10; i++) frames += run(first, 1000)[0].filter(v => v !== 0).length;
    expect(frames).toBeGreaterThan(2900);
    vi.runAllTimers();
    expect(first.disconnected).toBe(true);
  });

  it('lets each sound ring on beside the next, whichever string it was on', () => {
    const { output, scripts } = ringingSetup(3);
    output.ringOn();
    output.play();
    output.ringOn();
    output.play();
    // Two ringing nodes and the one playing now, none faded.
    expect(scripts()).toHaveLength(3);
    for (const node of scripts()) expect(node.next[0].to.gain.target).toBeNull();
  });

  it('chokes every ringing sound at once, as Play does', () => {
    const { output, scripts } = ringingSetup(3);
    output.ringOn();
    output.play();
    output.ringOn();
    output.chokeAll();
    vi.runAllTimers();
    expect(scripts().every(n => n.disconnected)).toBe(true);
  });
});
