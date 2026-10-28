/**
 * The playback output's volume: set on a gain after the effects (issue #199), so a turn of the
 * Volume knob is heard at once rather than after the half second the synthesizer renders ahead
 * (Jeremy, 2026-10-28), and turning it down doesn't change how distorted the sound is.
 */
import { WebAudioOutput } from '@/features/tab/audioOutput';

/** An AudioParam stand-in: its value and the last target it was sent towards. */
function param(value = 0) {
  return { value, target: null as number | null, setTargetAtTime(v: number) { this.target = v; } };
}

/** A stand-in AudioContext with just what the output and its effects use, keeping what each node is connected to. */
function fakeAudio() {
  type Node = { kind: string; next: Node[]; gain: ReturnType<typeof param>; [key: string]: unknown };
  const nodes: Node[] = [];
  const make = (kind: string, extra: Record<string, unknown> = {}): Node => {
    const node: Node = {
      kind, next: [], gain: param(1),
      connect(to: Node) { node.next.push(to); return to; },
      disconnect() {},
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
    createBiquadFilter() { return make('filter', { frequency: param(), Q: param() }); }
    createWaveShaper() { return make('shaper'); }
    createConvolver() { return make('convolver'); }
    createDynamicsCompressor() {
      return make('limiter', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
    }
  }
  /** The gain that feeds the limiter just before the speakers: the volume. */
  const volume = () => nodes.find(n => n.kind === 'gain' && n.next.some(m => m.kind === 'limiter'))!;
  return { FakeContext, volume };
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
});
