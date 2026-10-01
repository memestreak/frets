import { pitchClass } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, parseNoteSettings, rangeTargets,
  resetNoteSettings, targetRange, type NoteSettings,
} from '@/lib/notes';
import { seededRng } from './helpers/rng';

const settings = (patch: Partial<NoteSettings> = {}) =>
  ({ ...defaultNoteSettings(), ...patch });

describe('resetNoteSettings', () => {
  it('resets every dialog field but keeps mode and pause', () => {
    const changed = settings({
      mode: 'range', pause: true, rFrom: 9, rTo: 14,
      strings: [false, true, false, true, false, true],
    });
    expect(resetNoteSettings(changed)).toEqual(settings({ mode: 'range', pause: true }));
  });
});

describe('targetRange', () => {
  it('orders the range', () => {
    expect(targetRange(settings({ rFrom: 7, rTo: 3 }))).toEqual([3, 7]);
  });
});

describe('defaults', () => {
  it('targets frets 1 to 12 and has no board window', () => {
    expect(defaultNoteSettings()).toMatchObject({ rFrom: 1, rTo: 12 });
    expect(defaultNoteSettings()).not.toHaveProperty('minFret');
    expect(defaultNoteSettings()).not.toHaveProperty('maxFret');
  });
});

describe('rangeTargets', () => {
  it('finds every in-scope occurrence in the range', () => {
    // E in frets 3–7: A string fret 7 and B string fret 5.
    const set = settings({ rFrom: 3, rTo: 7 });
    expect(rangeTargets(set, 4)).toEqual([{ s: 1, f: 7 }, { s: 4, f: 5 }]);
    const noB = { ...set, strings: [true, true, true, true, false, true] };
    expect(rangeTargets(noB, 4)).toEqual([{ s: 1, f: 7 }]);
  });
});

describe('generateNoteQuestion', () => {
  it('Name it: dot on an in-scope string within the target range', () => {
    const set = settings({
      strings: [false, true, false, true, false, false], rFrom: 3, rTo: 7,
    });
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

  it('Find on string: uses the whole board, whatever the target range', () => {
    const set = settings({ mode: 'string', rFrom: 5, rTo: 5 });
    const rng = seededRng(3);
    const asked = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const q = generateNoteQuestion(set, null, rng);
      if (q?.mode !== 'string') throw new Error('expected a string question');
      asked.add(q.pc);
    }
    expect(asked.size).toBe(12);
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

  it('returns null with no strings in scope', () => {
    expect(generateNoteQuestion(settings({ strings: Array(6).fill(false) }), null)).toBeNull();
  });
});

describe('parseNoteSettings', () => {
  it('falls back to defaults for invalid fields', () => {
    expect(parseNoteSettings({ mode: 'bogus', strings: [true], rFrom: 40, pause: true }))
      .toEqual({ ...defaultNoteSettings(), rFrom: 15, pause: true });
  });

  it('drops a stored board window', () => {
    expect(parseNoteSettings({ minFret: 5, maxFret: 20 })).toEqual(defaultNoteSettings());
  });
});
