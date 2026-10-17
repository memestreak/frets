import {
  detectPitch, freqToMidi, levelOf, pitchLabel, rms,
} from '@/features/practice/mic/pitch';
import { seededRng } from '../../helpers/rng';

const WINDOW = 4096;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * A plucked-string stand-in: the fundamental with strong overtones (the
 * second as loud as the first, as on a wound string), at `amp`.
 */
function tone(f: number, sampleRate: number, amp = 0.3): Float32Array {
  const harmonics = [1, 1, 0.6, 0.4, 0.25];
  const buf = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) {
    let v = 0;
    harmonics.forEach((a, k) => {
      v += a * Math.sin((2 * Math.PI * f * (k + 1) * i) / sampleRate);
    });
    buf[i] = (amp * v) / 3;
  }
  return buf;
}

describe('detectPitch', () => {
  it('names every note from the low E open to fret 15 on the high e', () => {
    for (const sampleRate of [44100, 48000]) {
      for (let midi = 40; midi <= 79; midi++) {
        const pitch = detectPitch(tone(hz(midi), sampleRate), sampleRate);
        expect(pitch && Math.round(freqToMidi(pitch.hz))).toBe(midi);
      }
    }
  });

  it('is accurate to a few cents', () => {
    const pitch = detectPitch(tone(110, 48000), 48000);
    expect(Math.abs(freqToMidi(pitch!.hz) - 45)).toBeLessThan(0.05);
  });

  it('hears a slightly flat note as the nearest one', () => {
    const pitch = detectPitch(tone(hz(45) * 2 ** (-30 / 1200), 48000), 48000);
    expect(Math.round(freqToMidi(pitch!.hz))).toBe(45);
  });

  it('is silent for silence, a whisper and noise', () => {
    expect(detectPitch(new Float32Array(WINDOW), 48000)).toBeNull();
    expect(detectPitch(tone(110, 48000, 0.005), 48000)).toBeNull();
    const rng = seededRng(7);
    const noise = Float32Array.from({ length: WINDOW }, () => rng() - 0.5);
    expect(detectPitch(noise, 48000)).toBeNull();
  });

  it('ignores pitches below the guitar', () => {
    expect(detectPitch(tone(50, 48000), 48000)).toBeNull();
  });
});

describe('helpers', () => {
  it('rms of a full-scale square wave is 1', () => {
    expect(rms(Float32Array.from({ length: 64 }, (_, i) => (i % 2 ? 1 : -1)))).toBe(1);
  });

  it('levelOf spans −60 to 0 dBFS', () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(0.001)).toBe(0);
    expect(levelOf(1)).toBe(1);
    expect(levelOf(0.0316)).toBeCloseTo(0.5, 2);
  });

  it('pitchLabel names the note with its octave', () => {
    expect(pitchLabel(40)).toBe('E₂');
    expect(pitchLabel(45)).toBe('A₂');
    expect(pitchLabel(61)).toBe('C♯₄');
    expect(pitchLabel(72)).toBe('C₅');
  });
});
