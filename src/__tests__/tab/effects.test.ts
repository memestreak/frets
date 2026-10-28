import {
  CURVE_SLOPE, DEFAULT_FX, heardEffects, DECAY_SECONDS, distortionCurve, driveGain, driveMakeup, NO_EFFECTS, plateImpulse, reverbWet, secondStage, toneFrequency,
} from '@/features/tab/effects';

// The playback effects' numbers (issue #199): what each knob does, and the plate's ring.

const RATE = 44100;

/** The -60 dB time of a ring, by Schroeder's backward integration: twice the time from -5 to -35 dB. */
function rt60(left: Float32Array, right: Float32Array): number {
  const n = left.length;
  const energy = new Float64Array(n + 1);
  for (let i = n - 1; i >= 0; i--) energy[i] = energy[i + 1] + left[i] ** 2 + right[i] ** 2;
  const db = (i: number) => 10 * Math.log10(energy[i] / energy[0]);
  let from = 0;
  while (db(from) > -5) from++;
  let to = from;
  while (to < n - 1 && db(to) > -35) to++;
  return ((to - from) / RATE) * 2;
}

describe('the playback effects', () => {
  it('start with both effects off', () => {
    expect(NO_EFFECTS.drive).toBe(0);
    expect(NO_EFFECTS.reverb).toBe(0);
    expect(reverbWet(0)).toBe(0);
  });

  it('shape the sound with a soft clip that rises all the way and stays within ±1', () => {
    const curve = distortionCurve();
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]);
    expect(Math.max(...curve.map(Math.abs))).toBeCloseTo(1, 5);
    // Silence stays silent.
    expect(curve[(curve.length - 1) / 2]).toBeCloseTo(0, 6);
    // It leans: one side clips sooner, for the even harmonics.
    expect(curve[0]).not.toBeCloseTo(-curve[curve.length - 1], 2);
  });

  it('drive the shaper from 6 dB to 46 dB, evenly in dB, and bring the level back down', () => {
    expect(20 * Math.log10(driveGain(0))).toBeCloseTo(6);
    expect(20 * Math.log10(driveGain(0.5))).toBeCloseTo(26);
    expect(20 * Math.log10(driveGain(1))).toBeCloseTo(46);
    expect(driveMakeup(1)).toBeLessThan(driveMakeup(0.1));
  });

  it('add a second stage from halfway up Drive, left alone below that', () => {
    // Below halfway its push and its level out undo each other where the curve is a straight line.
    for (const drive of [0, 0.25, 0.5]) {
      const { gain, back } = secondStage(drive);
      expect(gain * CURVE_SLOPE * back).toBeCloseTo(1);
      expect(gain * CURVE_SLOPE).toBeLessThan(0.3);
    }
    // At full it pushes hard into the second shaper, 12 dB.
    expect(20 * Math.log10(secondStage(1).gain)).toBeCloseTo(12);
    expect(secondStage(1).back).toBe(1);
    expect(secondStage(0.75).gain).toBeGreaterThan(secondStage(0.5).gain);
    // The curve's slope at silence, measured.
    const curve = distortionCurve();
    const mid = (curve.length - 1) / 2;
    expect((curve[mid + 1] - curve[mid - 1]) / (4 / (curve.length - 1))).toBeCloseTo(CURVE_SLOPE, 2);
  });

  it('are heard only with their own switch and the FX button both on', () => {
    const fx = { ...DEFAULT_FX, on: true, drive: 0.7, reverb: 0.4 };
    expect(heardEffects(fx)).toEqual({ drive: 0.7, tone: fx.tone, reverb: 0.4, decay: fx.decay });
    expect(heardEffects({ ...fx, on: false })).toMatchObject({ drive: 0, reverb: 0 });
    expect(heardEffects({ ...fx, distortionOn: false })).toMatchObject({ drive: 0, reverb: 0.4 });
    expect(heardEffects({ ...fx, reverbOn: false })).toMatchObject({ drive: 0.7, reverb: 0 });
    // At first the FX button has them all off.
    expect(heardEffects(DEFAULT_FX)).toMatchObject({ drive: 0, reverb: 0 });
  });

  it('turn the tone from dark to bright, evenly in pitch', () => {
    expect(toneFrequency(0)).toBeCloseTo(1200);
    expect(toneFrequency(1)).toBeCloseTo(6000);
    expect(toneFrequency(0.5)).toBeCloseTo(Math.sqrt(1200 * 6000));
  });

  it('ring with the plate for the decay asked, within 15% (0.3 s within 25%: the plate\'s diffusers ring that long themselves)', () => {
    for (const [seconds, within] of [[DECAY_SECONDS.min, 0.25], [DECAY_SECONDS.start, 0.15], [DECAY_SECONDS.max, 0.15]]) {
      const [left, right] = plateImpulse(RATE, seconds);
      expect(Math.abs(rt60(left, right) / seconds - 1)).toBeLessThan(within);
    }
  }, 60_000);

  it('ring on both sides, differently, and die away before the end', () => {
    const [left, right] = plateImpulse(RATE, DECAY_SECONDS.start);
    let same = true;
    for (let i = 0; i < left.length && same; i++) same = left[i] === right[i];
    expect(same).toBe(false);
    const peak = Math.max(...left.map(Math.abs));
    const end = Math.max(...left.subarray(left.length - 1000).map(Math.abs));
    expect(end / peak).toBeLessThan(0.002);
  });
});

