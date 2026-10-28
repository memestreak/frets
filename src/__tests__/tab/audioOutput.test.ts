/**
 * The playback output's volume: set on its gain node, so a turn of the Volume knob is heard at once
 * rather than after the half second the synthesizer renders ahead (Jeremy, 2026-10-28).
 */
import { WebAudioOutput } from '@/features/tab/audioOutput';

/** A stand-in AudioContext with just what the output uses, keeping the gain nodes it makes. */
function fakeAudio() {
  const gains: { gain: { value: number; target: number | null; setTargetAtTime(v: number): void } }[] = [];
  class FakeContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    resume() { return Promise.resolve(); }
    createScriptProcessor() { return { connect: (next: unknown) => next, disconnect() {}, onaudioprocess: null }; }
    createGain() {
      const node = {
        gain: { value: 1, target: null as number | null, setTargetAtTime(v: number) { this.target = v; } },
        connect: (next: unknown) => next,
        disconnect() {},
      };
      gains.push(node);
      return node;
    }
  }
  return { FakeContext, gains };
}

describe('playback output volume', () => {
  it('turns the sound playing at once, and starts the next Play at it', () => {
    const { FakeContext, gains } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    try {
      const output = new WebAudioOutput();
      output.open(500);
      output.setVolume(0.4);
      output.play();
      expect(gains.at(-1)!.gain.value).toBe(0.4);
      // Turned while playing: the gain moves toward the new volume straight away.
      output.setVolume(0.1);
      expect(gains.at(-1)!.gain.target).toBe(0.1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
