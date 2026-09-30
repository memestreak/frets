import { pitchClass } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, parseNoteSettings, rangeTargets,
  targetRange, type NoteSettings,
} from '@/lib/notes';
import { seededRng } from './helpers/rng';

const settings = (patch: Partial<NoteSettings> = {}) =>
  ({ ...defaultNoteSettings(), ...patch });

describe('targetRange', () => {
  it('orders the range and clamps it to the window', () => {
    expect(targetRange(settings({ rFrom: 7, rTo: 3 }))).toEqual([3, 7]);
    expect(targetRange(settings({ minFret: 5, maxFret: 12, rFrom: 3, rTo: 20 })))
      .toEqual([5, 12]);
  });
});

describe('rangeTargets', () => {
  it('finds every in-scope occurrence in the range', () => {
    // E in frets 3–7: A string fret 7 and B string fret 5.
    expect(rangeTargets(settings(), 4)).toEqual([{ s: 1, f: 7 }, { s: 4, f: 5 }]);
    const noB = settings({ strings: [true, true, true, true, false, true] });
    expect(rangeTargets(noB, 4)).toEqual([{ s: 1, f: 7 }]);
  });
});

describe('generateNoteQuestion', () => {
  it('Name it: dot on an in-scope string within the target range', () => {
    const set = settings({ strings: [false, true, false, true, false, false] });
    const rng = seededRng(7);
    let last: number | null = null;
    for (let i = 0; i < 300; i++) {
      const q = generateNoteQuestion(set, last, rng);
      if (q?.mode !== 'name') throw new Error('expected a name question');
      expect([1, 3]).toContain(q.s);
      expect(q.f).toBeGreaterThanOrEqual(3);
      expect(q.f).toBeLessThanOrEqual(7);
      expect(q.pc).toBe(pitchClass(q.s, q.f));
      expect(q.pc).not.toBe(last);
      last = q.pc;
    }
  });

  it('Find on string: the note exists on the target string in the window', () => {
    const set = settings({ mode: 'string', minFret: 5, maxFret: 8 });
    const rng = seededRng(3);
    for (let i = 0; i < 300; i++) {
      const q = generateNoteQuestion(set, null, rng);
      if (q?.mode !== 'string') throw new Error('expected a string question');
      const frets = [5, 6, 7, 8].filter(f => pitchClass(q.s, f) === q.pc);
      expect(frets.length).toBeGreaterThan(0);
    }
  });

  it('Find in range: targets are every occurrence', () => {
    const set = settings({ mode: 'range' });
    const rng = seededRng(9);
    for (let i = 0; i < 100; i++) {
      const q = generateNoteQuestion(set, null, rng);
      if (q?.mode !== 'range') throw new Error('expected a range question');
      expect(q.targets).toEqual(rangeTargets(set, q.pc));
      expect(q.targets.length).toBeGreaterThan(0);
    }
  });

  it('returns null with no strings in scope or an empty range', () => {
    expect(generateNoteQuestion(settings({ strings: Array(6).fill(false) }), null)).toBeNull();
    expect(generateNoteQuestion(settings({ minFret: 10, maxFret: 15, rFrom: 3, rTo: 7 }), null))
      .toBeNull();
  });
});

describe('parseNoteSettings', () => {
  it('falls back to defaults for invalid fields', () => {
    expect(parseNoteSettings({ mode: 'bogus', strings: [true], rFrom: 40, pause: true }))
      .toEqual({ ...defaultNoteSettings(), rFrom: 24, pause: true });
  });
});
