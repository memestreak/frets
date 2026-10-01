import {
  clampHRange, correctFrets, defaultIntervalSettings,
  generateIntervalQuestion, inBox, isCorrectFret, isOutOfRange,
  parseIntervalSettings,
  type IntervalQuestion, type IntervalSettings,
} from '@/lib/intervals';
import { intervalClass, midi, samePos } from '@/lib/music';
import { seededRng } from './helpers/rng';

const settings = (patch: Partial<IntervalSettings> = {}) =>
  ({ ...defaultIntervalSettings(), ...patch });

function sample(set: IntervalSettings, n = 400) {
  const rng = seededRng(42);
  return Array.from({ length: n }, () => generateIntervalQuestion(set, rng));
}

const span = (q: IntervalQuestion) =>
  midi(q.tgt.s, q.tgt.f) - midi(q.root.s, q.root.f);

describe('defaults', () => {
  it('uses the whole board height, a four-fret reach and compound spans', () => {
    expect(defaultIntervalSettings()).toMatchObject({
      vRange: 5, hRange: 4, compound: true,
    });
    expect(defaultIntervalSettings()).not.toHaveProperty('pairs');
  });
});

describe('inBox', () => {
  const root = { s: 2, f: 5 };
  const box = { dir: 'asc', vRange: 2, hRange: 3 } as const;

  it('lights strings in the direction, up to both ranges', () => {
    expect(inBox(root, true, { s: 3, f: 5 }, box)).toBe(true);
    expect(inBox(root, true, { s: 4, f: 8 }, box)).toBe(true);
    expect(inBox(root, true, { s: 4, f: 2 }, box)).toBe(true);
    expect(inBox(root, true, { s: 5, f: 5 }, box)).toBe(false); // 3 strings
    expect(inBox(root, true, { s: 4, f: 9 }, box)).toBe(false); // 4 frets
    expect(inBox(root, true, { s: 1, f: 5 }, box)).toBe(false); // lower string

    expect(inBox(root, false, { s: 1, f: 5 }, box)).toBe(true);
    expect(inBox(root, false, { s: 0, f: 2 }, box)).toBe(true);
    expect(inBox(root, false, { s: 3, f: 5 }, box)).toBe(false);
  });

  it("lights the root's string only on the direction's side", () => {
    expect(inBox(root, true, { s: 2, f: 8 }, box)).toBe(true);
    expect(inBox(root, true, { s: 2, f: 9 }, box)).toBe(false);
    expect(inBox(root, true, { s: 2, f: 3 }, box)).toBe(false);
    expect(inBox(root, false, { s: 2, f: 3 }, box)).toBe(true);
    expect(inBox(root, false, { s: 2, f: 7 }, box)).toBe(false);
  });

  it('never includes the root itself', () => {
    expect(inBox(root, true, root, box)).toBe(false);
    expect(inBox(root, false, root, box)).toBe(false);
  });

  it("is only the root's string in Same string direction", () => {
    const same = { ...box, dir: 'same' } as const;
    expect(inBox(root, true, { s: 2, f: 8 }, same)).toBe(true);
    expect(inBox(root, true, { s: 3, f: 5 }, same)).toBe(false);
  });
});

describe('isCorrectFret', () => {
  // Root: A string fret 5 (D3); m3 above is F3.
  const q = { root: { s: 1, f: 5 }, tgt: { s: 2, f: 3 }, semis: 3, up: true };
  const simple = settings({ compound: false });

  it('accepts any in-box position a minor third above', () => {
    expect(isCorrectFret(q, { s: 2, f: 3 }, simple)).toBe(true);
    // Same string, three frets up: a real fingering of the interval.
    expect(isCorrectFret(q, { s: 1, f: 8 }, simple)).toBe(true);
  });

  it('rejects wrong direction, wrong class, out of the box, or compound', () => {
    expect(isCorrectFret(q, { s: 0, f: 6 }, simple)).toBe(false); // below the root
    expect(isCorrectFret(q, { s: 2, f: 4 }, simple)).toBe(false); // M3
    // G string fret 10 is an octave plus m3, but five frets away.
    expect(isCorrectFret(q, { s: 3, f: 10 }, settings())).toBe(false);
    // B string fret 6 (F4) is an octave plus m3, inside the box.
    expect(isCorrectFret(q, { s: 4, f: 6 }, simple)).toBe(false);
    expect(isCorrectFret(q, { s: 4, f: 6 }, settings())).toBe(true);
  });

  it('applies the horizontal range at its edge', () => {
    // D string fret 3 is two frets from the root.
    expect(isCorrectFret(q, { s: 2, f: 3 }, settings({ hRange: 2 }))).toBe(true);
    expect(isCorrectFret(q, { s: 2, f: 3 }, settings({ hRange: 1 }))).toBe(false);
  });

  it('applies the vertical range at its edge', () => {
    // B string is three strings from the root.
    expect(isCorrectFret(q, { s: 4, f: 6 }, settings({ vRange: 3 }))).toBe(true);
    expect(isCorrectFret(q, { s: 4, f: 6 }, settings({ vRange: 2 }))).toBe(false);
  });

  it('rejects a right-named note on a lower string for an ascending question', () => {
    // Root: A string fret 3 (C3). Low E fret 11 is D#3, a minor third above,
    // but ascending questions only go to higher strings.
    const up = { root: { s: 1, f: 3 }, tgt: { s: 2, f: 1 }, semis: 3, up: true };
    expect(isCorrectFret(up, { s: 0, f: 11 }, settings({ hRange: 12 }))).toBe(false);
    expect(isCorrectFret(up, { s: 2, f: 1 }, settings({ hRange: 12 }))).toBe(true);
  });

  it("accepts only the root's string in Same string direction", () => {
    const same = settings({ dir: 'same' });
    expect(isCorrectFret(q, { s: 1, f: 8 }, same)).toBe(true);
    expect(isCorrectFret(q, { s: 2, f: 3 }, same)).toBe(false);
  });

  it('names a target below the root from the root, not by distance', () => {
    // Root: A string fret 3 (C3); its P5 played below is G2.
    const down = { root: { s: 1, f: 3 }, tgt: { s: 0, f: 3 }, semis: 7, up: false };
    const desc = settings({ dir: 'desc', compound: false });
    expect(isCorrectFret(down, { s: 0, f: 3 }, desc)).toBe(true);
    // F2 is a fifth down, which is the root's P4.
    expect(isCorrectFret(down, { s: 0, f: 1 }, desc)).toBe(false);
    expect(isCorrectFret(down, { s: 2, f: 5 }, desc)).toBe(false); // G3, above
  });
});

describe('isOutOfRange', () => {
  // Root: A string fret 5 (D3); m3 above is F3.
  const q = { root: { s: 1, f: 5 }, tgt: { s: 2, f: 3 }, semis: 3, up: true };

  it('is the asked interval in the asked direction, outside the box', () => {
    // G string fret 10 (F4): five frets away.
    expect(isOutOfRange(q, { s: 3, f: 10 }, settings())).toBe(true);
    // Low E fret 13 (F3): the right note on a lower string.
    expect(isOutOfRange(q, { s: 0, f: 13 }, settings({ hRange: 12 }))).toBe(true);
  });

  it('is false inside the box, for other intervals, and for the root', () => {
    expect(isOutOfRange(q, { s: 2, f: 3 }, settings())).toBe(false); // correct
    expect(isOutOfRange(q, { s: 2, f: 4 }, settings())).toBe(false); // in box, M3
    expect(isOutOfRange(q, { s: 3, f: 11 }, settings())).toBe(false); // far, M3
    expect(isOutOfRange(q, { s: 0, f: 1 }, settings())).toBe(false); // F2, below
    expect(isOutOfRange(q, q.root, settings())).toBe(false);
  });
});

describe('correctFrets', () => {
  const q = { root: { s: 1, f: 5 }, tgt: { s: 2, f: 3 }, semis: 3, up: true };

  it('lists all and only the correct frets in the window', () => {
    expect(correctFrets(q, settings({ compound: false })))
      .toEqual([{ s: 1, f: 8 }, { s: 2, f: 3 }]);
    expect(correctFrets(q, settings())).toEqual([
      { s: 1, f: 8 }, { s: 2, f: 3 }, { s: 4, f: 6 }, { s: 5, f: 1 },
    ]);
    // High e fret 1 falls outside a window that starts at fret 2.
    expect(correctFrets(q, settings({ minFret: 2 }))).toEqual([
      { s: 1, f: 8 }, { s: 2, f: 3 }, { s: 4, f: 6 },
    ]);
  });
});

describe('generateIntervalQuestion', () => {
  it.each(['asc', 'desc', 'rand', 'same'] as const)(
    'obeys the rules for direction %s',
    dir => {
      for (const vRange of [1, 3, 5]) {
        for (const hRange of [1, 4, 12]) {
          const set = settings({
            dir, vRange, hRange, minFret: 2, maxFret: 14, compound: false,
          });
          for (const q of sample(set, 40)) {
            expect(q).not.toBeNull();
            if (!q) continue;
            const d = span(q);
            expect(d).not.toBe(0);
            expect(q.up).toBe(d > 0);
            expect(Math.abs(d)).toBeLessThanOrEqual(12);
            expect(Math.abs(q.tgt.f - q.root.f)).toBeLessThanOrEqual(hRange);
            expect(intervalClass(d)).toBe(q.semis);
            expect(isCorrectFret(q, q.tgt, set)).toBe(true);
            for (const p of [q.root, q.tgt]) {
              expect(p.f).toBeGreaterThanOrEqual(2);
              expect(p.f).toBeLessThanOrEqual(14);
            }
            const gap = Math.abs(q.tgt.s - q.root.s);
            if (dir === 'same') {
              expect(gap).toBe(0);
              expect(q.up).toBe(true);
            } else {
              expect(gap).toBeGreaterThan(0);
              expect(gap).toBeLessThanOrEqual(vRange);
              if (dir === 'asc') expect(q.root.s).toBeLessThan(q.tgt.s);
              if (dir === 'desc') expect(q.root.s).toBeGreaterThan(q.tgt.s);
            }
          }
        }
      }
    },
  );

  it('only asks for intervals in the pool', () => {
    const qs = sample(settings({ pool: [3, 7] }));
    expect(new Set(qs.map(q => q?.semis))).toEqual(new Set([3, 7]));
  });

  it('asks every possible interval about equally often', () => {
    const n = 2400;
    const counts = new Map<number, number>();
    for (const q of sample(settings(), n)) {
      if (q) counts.set(q.semis, (counts.get(q.semis) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(n / 12 - 60);
      expect(c).toBeLessThan(n / 12 + 60);
    }
  });

  it('uses the far strings at the defaults', () => {
    expect(sample(settings()).some(q => q && q.tgt.s - q.root.s >= 4)).toBe(true);
  });

  it('allows compound spans only when enabled', () => {
    const plain = sample(settings({ compound: false }));
    expect(plain.every(q => q && Math.abs(span(q)) <= 12)).toBe(true);
    expect(sample(settings()).some(q => q && Math.abs(span(q)) > 12)).toBe(true);
  });

  it('always finds a rare question in a narrow box', () => {
    // A minor second up within three frets exists on few string pairs.
    const set = settings({ pool: [1], vRange: 5, hRange: 3, compound: false });
    expect(sample(set, 300).every(q => q !== null)).toBe(true);
  });

  it('does not ask the same question twice running', () => {
    const set = settings({ pool: [7], vRange: 1, hRange: 2 });
    const rng = seededRng(7);
    let prev: IntervalQuestion | null = null;
    for (let i = 0; i < 200; i++) {
      const q = generateIntervalQuestion(set, rng, prev);
      expect(q).not.toBeNull();
      if (!q) return;
      if (prev) {
        expect(samePos(q.root, prev.root) && samePos(q.tgt, prev.tgt)).toBe(false);
      }
      prev = q;
    }
  });

  it('reaches an octave on one string at the widest horizontal range', () => {
    const wide = settings({ dir: 'same', hRange: 12, pool: [12] });
    for (const q of sample(wide, 50)) {
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(q.tgt.s).toBe(q.root.s);
      expect(q.tgt.f - q.root.f).toBe(12);
    }
    expect(generateIntervalQuestion({ ...wide, hRange: 11 }, seededRng(1))).toBeNull();
  });

  it('returns null when nothing fits', () => {
    expect(generateIntervalQuestion(settings({ pool: [] }))).toBeNull();
    // An octave on one string needs 12 frets; the window has four.
    expect(generateIntervalQuestion(
      settings({ dir: 'same', hRange: 12, minFret: 0, maxFret: 3, pool: [12] }),
      seededRng(1),
    )).toBeNull();
  });
});

describe('clampHRange', () => {
  it('rounds and clamps to 1–12', () => {
    expect(clampHRange(0)).toBe(1);
    expect(clampHRange(40)).toBe(12);
    expect(clampHRange(6.4)).toBe(6);
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

  it('accepts in-range integer ranges and ignores a stored pairs value', () => {
    expect(parseIntervalSettings({ vRange: 2, hRange: 12, pairs: 'skip1' }))
      .toEqual({ ...defaultIntervalSettings(), vRange: 2, hRange: 12 });
  });

  it('rejects out-of-range, non-integer and non-number ranges', () => {
    for (const bad of [0, 6, 2.5, '3', null]) {
      expect(parseIntervalSettings({ vRange: bad }).vRange).toBe(5);
    }
    for (const bad of [0, 13, 4.5, '4', null]) {
      expect(parseIntervalSettings({ hRange: bad }).hRange).toBe(4);
    }
  });
});
