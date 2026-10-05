import {
  clampHRange, correctFrets, defaultIntervalSettings,
  generateIntervalQuestion, inBox, isCorrectFret, isOutOfRange,
  parseIntervalSettings, resetIntervalSettings, withHRange, withVRange,
  type IntervalQuestion, type IntervalSettings,
} from '@/features/practice/intervals/intervals';
import { intervalClass, midi, samePos } from '@/lib/music';
import { seededRng } from '../helpers/rng';

const settings = (patch: Partial<IntervalSettings> = {}) =>
  ({ ...defaultIntervalSettings(), ...patch });

function sample(set: IntervalSettings, n = 400) {
  const rng = seededRng(42);
  return Array.from({ length: n }, () => generateIntervalQuestion(set, rng));
}

const span = (q: IntervalQuestion) =>
  midi(q.tgt.s, q.tgt.f) - midi(q.root.s, q.root.f);

describe('defaults', () => {
  it('uses both directions, every string, a four-fret span and compound spans', () => {
    expect(defaultIntervalSettings()).toMatchObject({
      dir: 'rand', vRange: 6, hRange: 4, compound: true,
    });
    expect(defaultIntervalSettings()).not.toHaveProperty('pairs');
  });

  it('resets every dialog field but keeps mode and pause', () => {
    const changed = settings({
      mode: 'fret', pause: true, dir: 'rand', vRange: 2, hRange: 9, minFret: 3,
      maxFret: 20, pool: [7], compound: false, noteNames: true,
    });
    expect(resetIntervalSettings(changed)).toEqual(
      settings({ mode: 'fret', pause: true }),
    );
  });
});

describe('inBox', () => {
  const root = { s: 2, f: 5 };
  // Three strings and four frets, counting the root's own.
  const box = { vRange: 3, hRange: 4 };

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
    expect(isCorrectFret(q, { s: 2, f: 3 }, settings({ hRange: 3 }))).toBe(true);
    expect(isCorrectFret(q, { s: 2, f: 3 }, settings({ hRange: 2 }))).toBe(false);
  });

  it('applies the vertical range at its edge', () => {
    // B string is three strings from the root.
    expect(isCorrectFret(q, { s: 4, f: 6 }, settings({ vRange: 4 }))).toBe(true);
    expect(isCorrectFret(q, { s: 4, f: 6 }, settings({ vRange: 3 }))).toBe(false);
  });

  it('rejects a right-named note on a lower string for an ascending question', () => {
    // Root: A string fret 3 (C3). Low E fret 11 is D#3, a minor third above,
    // but ascending questions only go to higher strings.
    const up = { root: { s: 1, f: 3 }, tgt: { s: 2, f: 1 }, semis: 3, up: true };
    expect(isCorrectFret(up, { s: 0, f: 11 }, settings({ hRange: 12 }))).toBe(false);
    expect(isCorrectFret(up, { s: 2, f: 1 }, settings({ hRange: 12 }))).toBe(true);
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
    expect(correctFrets(q, settings({ hRange: 5 }))).toEqual([
      { s: 1, f: 8 }, { s: 2, f: 3 }, { s: 4, f: 6 }, { s: 5, f: 1 },
    ]);
    // High e fret 1 falls outside a window that starts at fret 2, and
    // outside a four-fret range.
    expect(correctFrets(q, settings({ hRange: 5, minFret: 2 }))).toEqual([
      { s: 1, f: 8 }, { s: 2, f: 3 }, { s: 4, f: 6 },
    ]);
    expect(correctFrets(q, settings({ hRange: 4 }))).toEqual([
      { s: 1, f: 8 }, { s: 2, f: 3 }, { s: 4, f: 6 },
    ]);
  });
});

describe('generateIntervalQuestion', () => {
  it.each(['asc', 'desc', 'rand'] as const)(
    'obeys the rules for direction %s',
    dir => {
      for (const vRange of [2, 4, 6]) {
        for (const hRange of [2, 5, 12]) {
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
            expect(Math.abs(q.tgt.f - q.root.f)).toBeLessThan(hRange);
            expect(intervalClass(d)).toBe(q.semis);
            expect(isCorrectFret(q, q.tgt, set)).toBe(true);
            for (const p of [q.root, q.tgt]) {
              expect(p.f).toBeGreaterThanOrEqual(2);
              expect(p.f).toBeLessThanOrEqual(14);
            }
            const gap = Math.abs(q.tgt.s - q.root.s);
            // Ranges count the root's own string and fret.
            expect(gap).toBeLessThan(vRange);
            if (dir === 'asc') expect(q.root.s).toBeLessThanOrEqual(q.tgt.s);
            if (dir === 'desc') expect(q.root.s).toBeGreaterThanOrEqual(q.tgt.s);
          }
        }
      }
    },
  );

  it('mixes both directions for Ascending and Descending', () => {
    const ups = sample(settings({ dir: 'rand' })).map(q => q?.up);
    expect(ups).toContain(true);
    expect(ups).toContain(false);
  });

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
    const set = settings({ pool: [1], vRange: 6, hRange: 4, compound: false });
    expect(sample(set, 300).every(q => q !== null)).toBe(true);
  });

  it('does not ask the same question twice running', () => {
    const set = settings({ pool: [7], vRange: 2, hRange: 3 });
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

  it('returns null when nothing fits', () => {
    expect(generateIntervalQuestion(settings({ pool: [] }))).toBeNull();
    // Two strings and two frets never span an octave.
    expect(generateIntervalQuestion(
      settings({ vRange: 2, hRange: 2, pool: [12] }), seededRng(1),
    )).toBeNull();
    // A range of one string and one fret is the root alone.
    expect(generateIntervalQuestion(
      settings({ vRange: 1, hRange: 1 }), seededRng(1),
    )).toBeNull();
  });

  it('stays on one string at vertical 1 and on one fret at horizontal 1', () => {
    for (const q of sample(settings({ dir: 'asc', vRange: 1 }), 100)) {
      expect(q && q.tgt.s === q.root.s && q.tgt.f > q.root.f).toBe(true);
    }
    for (const q of sample(settings({ dir: 'asc', hRange: 1 }), 100)) {
      expect(q && q.tgt.f === q.root.f && q.tgt.s > q.root.s).toBe(true);
    }
    expect(sample(settings()).some(q => q && q.tgt.s === q.root.s)).toBe(true);
  });
});

describe('clampHRange', () => {
  it('rounds and clamps to 1–12', () => {
    expect(clampHRange(0)).toBe(1);
    expect(clampHRange(40)).toBe(12);
    expect(clampHRange(6.4)).toBe(6);
  });
});

describe('withVRange / withHRange', () => {
  it('set one range and leave the other alone', () => {
    expect(withVRange({ vRange: 6, hRange: 4 }, 3)).toEqual({ vRange: 3, hRange: 4 });
    expect(withVRange({ vRange: 6, hRange: 4 }, 1)).toEqual({ vRange: 1, hRange: 4 });
    expect(withHRange({ vRange: 6, hRange: 4 }, 1)).toEqual({ vRange: 6, hRange: 1 });
    expect(withHRange({ vRange: 6, hRange: 4 }, 40)).toEqual({ vRange: 6, hRange: 12 });
  });

  it('bump the other range to 2 rather than leave both at 1', () => {
    // One string by one fret is the root alone: no question can fit.
    expect(withVRange({ vRange: 3, hRange: 1 }, 1)).toEqual({ vRange: 1, hRange: 2 });
    expect(withHRange({ vRange: 1, hRange: 5 }, 1)).toEqual({ vRange: 2, hRange: 1 });
    expect(withHRange({ vRange: 1, hRange: 5 }, 0)).toEqual({ vRange: 2, hRange: 1 });
  });
});

describe('parseIntervalSettings', () => {
  it('never loads both ranges at 1', () => {
    expect(parseIntervalSettings({ vRange: 1, hRange: 1 }))
      .toMatchObject({ vRange: 1, hRange: 2 });
    expect(parseIntervalSettings({ vRange: 1, hRange: 2 }))
      .toMatchObject({ vRange: 1, hRange: 2 });
    expect(parseIntervalSettings({ vRange: 2, hRange: 1 }))
      .toMatchObject({ vRange: 2, hRange: 1 });
  });

  it('falls back to defaults for missing or invalid fields', () => {
    expect(parseIntervalSettings(null)).toEqual(defaultIntervalSettings());
    expect(parseIntervalSettings({
      mode: 'fret', dir: 'sideways', pool: [3, 3, 99, 1], minFret: 10, maxFret: 11,
      compound: 'yes', pause: true,
    })).toEqual({
      ...defaultIntervalSettings(), mode: 'fret', pool: [1, 3], pause: true,
    });
  });

  it('falls back to the default for the removed Same string direction', () => {
    expect(parseIntervalSettings({ dir: 'same' }).dir).toBe('rand');
    expect(parseIntervalSettings({ dir: 'asc' }).dir).toBe('asc');
  });

  it('accepts in-range integer ranges and ignores a stored pairs value', () => {
    expect(parseIntervalSettings({ vRange: 2, hRange: 12, pairs: 'skip1' }))
      .toEqual({ ...defaultIntervalSettings(), vRange: 2, hRange: 12 });
  });

  it('rejects out-of-range, non-integer and non-number ranges', () => {
    for (const bad of [0, 7, 2.5, '3', null]) {
      expect(parseIntervalSettings({ vRange: bad }).vRange).toBe(6);
    }
    for (const bad of [0, 13, 4.5, '4', null]) {
      expect(parseIntervalSettings({ hRange: bad }).hRange).toBe(4);
    }
  });
});
