import { act, renderHook } from '@testing-library/react';
import { defaultRhythm } from '@/features/metronome/rhythm';
import { useMetronomeCore } from '@/features/metronome/useMetronomeCore';

/** Enough of Web Audio for the core: every click it schedules is counted, and Close is seen. */
let started = 0;
let closed = 0;
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume() { return Promise.resolve(); }
  close() { closed += 1; return Promise.resolve(); }
  createGain() { return { gain: { value: 1 }, connect: (n: unknown) => n }; }
  createBuffer(_c: number, length: number) { return { length, copyToChannel() {} }; }
  createBufferSource() { return { buffer: null, connect: (n: unknown) => n, start: () => { started += 1; } }; }
}

beforeEach(() => {
  started = 0;
  closed = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const start = () => ({ rhythm: { ...defaultRhythm(), bpm: 92 }, volume: 0.5 });

describe('useMetronomeCore', () => {
  it('starts from the rhythm and volume it is given, and saves nothing', () => {
    const { result } = renderHook(() => useMetronomeCore(start));
    expect(result.current.rhythm.bpm).toBe(92);
    expect(result.current.volume).toBe(0.5);
    act(() => result.current.setRhythm(r => ({ ...r, bpm: 100 })));
    expect(result.current.rhythm.bpm).toBe(100);
    expect(localStorage.length).toBe(0);
  });

  it('takes a whole new rhythm from outside', () => {
    const { result } = renderHook(() => useMetronomeCore(start));
    act(() => result.current.setRhythm({ ...defaultRhythm(), bpm: 60, beats: 3, subs: [1, 1, 1], steps: [[0], [1], [1]] }));
    expect(result.current.rhythm).toMatchObject({ bpm: 60, beats: 3 });
  });

  it('leaves Space alone: that is the page’s', () => {
    const { result } = renderHook(() => useMetronomeCore(start));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    expect(result.current.playing).toBe(false);
  });

  it('close stops the clicks and lets the audio go', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMetronomeCore(start));
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    expect(started).toBeGreaterThan(0);
    act(() => result.current.close());
    expect(result.current.playing).toBe(false);
    expect(closed).toBe(1);
    const before = started;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(started).toBe(before);
  });
});
