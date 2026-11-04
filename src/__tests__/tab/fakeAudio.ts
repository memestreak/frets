/**
 * A stand-in for Web Audio, for tests of the Tab page's playback output (`audioOutput.ts`) and of
 * the player built on it.
 */

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
export function fakeAudio() {
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
    close() { return Promise.resolve(); }
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

/** A buffer of the node's four channels, `frames` long, for a call of its `onaudioprocess`. */
export function outputBuffer(frames: number) {
  const channels = [0, 1, 2, 3].map(() => new Float32Array(frames));
  return { channels, buffer: { getChannelData: (c: number) => channels[c] } };
}
