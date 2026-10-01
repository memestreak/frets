import {
  defaultIntervalSettings, generateIntervalQuestion, isCorrectFret,
  parseIntervalSettings, REACH, type IntervalSettings,
} from '@/lib/intervals';
import { intervalClass, midi } from '@/lib/music';
import { seededRng } from './helpers/rng';

const settings = (patch: Partial<IntervalSettings> = {}) =>
  ({ ...defaultIntervalSettings(), ...patch });

function sample(set: IntervalSettings, n = 400) {
  const rng = seededRng(42);
  return Array.from({ length: n }, () => generateIntervalQuestion(set, rng));
}

describe('generateIntervalQuestion', () => {
  it.each(['asc', 'desc', 'rand', 'same'] as const)(
    'obeys the rules for direction %s',
    dir => {
      for (const pairs of ['adj', 'skip1', 'skip2', 'any'] as const) {
        const set = settings({ dir, pairs, minFret: 2, maxFret: 12 });
        for (const q of sample(set, 150)) {
          expect(q).not.toBeNull();
          if (!q) continue;
          const d = midi(q.tgt.s, q.tgt.f) - midi(q.root.s, q.root.f);
          expect(d).not.toBe(0);
          expect(q.up).toBe(d > 0);
          expect(Math.abs(d)).toBeLessThanOrEqual(12);
          expect(Math.abs(q.tgt.f - q.root.f)).toBeLessThanOrEqual(REACH);
          expect(intervalClass(d)).toBe(q.semis);
          for (const p of [q.root, q.tgt]) {
            expect(p.f).toBeGreaterThanOrEqual(2);
            expect(p.f).toBeLessThanOrEqual(12);
          }
          const gap = Math.abs(q.tgt.s - q.root.s);
          if (dir === 'same') {
            expect(gap).toBe(0);
            expect(q.up).toBe(true);
          } else {
            expect(gap).toBe({ adj: 1, skip1: 2, skip2: 3, any: gap }[pairs]);
            expect(gap).toBeGreaterThan(0);
            if (dir === 'asc') expect(q.root.s).toBeLessThan(q.tgt.s);
            if (dir === 'desc') expect(q.root.s).toBeGreaterThan(q.tgt.s);
          }
        }
      }
    },
  );

  it('only asks for intervals in the pool', () => {
    const qs = sample(settings({ pool: [3, 7] }));
    expect(new Set(qs.map(q => q?.semis))).toEqual(new Set([3, 7]));
  });

  it('allows compound spans only when enabled', () => {
    const plain = sample(settings({ pairs: 'any' }));
    expect(plain.every(q => q && Math.abs(midi(q.tgt.s, q.tgt.f) - midi(q.root.s, q.root.f)) <= 12))
      .toBe(true);
    const compound = sample(settings({ pairs: 'any', compound: true }), 1500);
    expect(compound.some(q => q && Math.abs(midi(q.tgt.s, q.tgt.f) - midi(q.root.s, q.root.f)) > 12))
      .toBe(true);
  });

  it('returns null when nothing fits', () => {
    expect(generateIntervalQuestion(settings({ pool: [] }))).toBeNull();
    // An octave on one string needs 12 frets, far beyond reach.
    expect(generateIntervalQuestion(
      settings({ dir: 'same', minFret: 0, maxFret: 3, pool: [12] }),
      seededRng(1),
    )).toBeNull();
  });
});

describe('isCorrectFret', () => {
  // Root: A string fret 5 (D3); m3 above is F3.
  const q = { root: { s: 1, f: 5 }, tgt: { s: 2, f: 3 }, semis: 3, up: true };

  it('accepts any in-reach position a minor third above', () => {
    expect(isCorrectFret(q, { s: 2, f: 3 }, false)).toBe(true);
    expect(isCorrectFret(q, { s: 1, f: 8 }, false)).toBe(true);
  });

  it('rejects wrong direction, wrong class, out of reach, or compound', () => {
    expect(isCorrectFret(q, { s: 0, f: 6 }, false)).toBe(false); // below the root
    expect(isCorrectFret(q, { s: 2, f: 4 }, false)).toBe(false); // M3
    expect(isCorrectFret(q, { s: 0, f: 13 }, false)).toBe(false); // out of reach
    // B string fret 6 (F4) is an octave plus m3, within reach.
    expect(isCorrectFret(q, { s: 4, f: 6 }, false)).toBe(false);
    expect(isCorrectFret(q, { s: 4, f: 6 }, true)).toBe(true);
  });
});

describe('parseIntervalSettings', () => {
  it('falls back to defaults for missing or invalid fields', () => {
    expect(parseIntervalSettings(null)).toEqual(defaultIntervalSettings());
    expect(parseIntervalSettings({
      mode: 'fret', dir: 'sideways', pool: [3, 3, 99, 1], minFret: 10, maxFret: 11,
      compound: 'yes', pause: true,
    })).toEqual({
      ...defaultIntervalSettings(), mode: 'fret', pool: [1, 3], pause: true,
    });
  });
});
