import { pitchClass } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, isCorrectNoteFret,
  isNoteOutOfRange, parseNoteSettings, resetNoteSettings, targetRange,
  type NoteQuestion, type NoteSettings,
} from '@/lib/notes';
import { seededRng } from './helpers/rng';

const settings = (patch: Partial<NoteSettings> = {}) =>
  ({ ...defaultNoteSettings(), ...patch });

describe('resetNoteSettings', () => {
  it('resets every dialog field but keeps mode and pause', () => {
    const changed = settings({
      mode: 'find', pause: true, rFrom: 9, rTo: 14,
      strings: [false, true, false, true, false, true],
    });
    expect(resetNoteSettings(changed)).toEqual(settings({ mode: 'find', pause: true }));
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

describe('Find-it judging', () => {
  // E on the D string: frets 2 and 14.
  const q = { mode: 'find', pc: 4, s: 2 } as const;

  it('accepts the note on the string at either end of the range', () => {
    expect(isCorrectNoteFret(q, { s: 2, f: 2 }, settings({ rFrom: 2, rTo: 5 }))).toBe(true);
    expect(isCorrectNoteFret(q, { s: 2, f: 2 }, settings({ rFrom: 0, rTo: 2 }))).toBe(true);
    expect(isNoteOutOfRange(q, { s: 2, f: 2 }, settings({ rFrom: 2, rTo: 5 }))).toBe(false);
  });

  it('treats the note just outside the range as out of range, not correct', () => {
    for (const set of [settings({ rFrom: 3, rTo: 5 }), settings({ rFrom: 0, rTo: 1 })]) {
      expect(isCorrectNoteFret(q, { s: 2, f: 2 }, set)).toBe(false);
      expect(isNoteOutOfRange(q, { s: 2, f: 2 }, set)).toBe(true);
    }
    expect(isNoteOutOfRange(q, { s: 2, f: 14 }, settings({ rFrom: 1, rTo: 12 }))).toBe(true);
  });

  it('accepts both octaves when the range holds both', () => {
    const set = settings({ rFrom: 0, rTo: 15 });
    expect(isCorrectNoteFret(q, { s: 2, f: 2 }, set)).toBe(true);
    expect(isCorrectNoteFret(q, { s: 2, f: 14 }, set)).toBe(true);
  });

  it('reads a backwards range the same way', () => {
    const set = settings({ rFrom: 5, rTo: 2 });
    expect(isCorrectNoteFret(q, { s: 2, f: 2 }, set)).toBe(true);
    expect(isNoteOutOfRange(q, { s: 2, f: 14 }, set)).toBe(true);
  });

  it('is neither for the right note on another string, or a wrong note', () => {
    const set = settings({ rFrom: 1, rTo: 12 });
    // E on the A string, fret 7; then F on the D string.
    for (const pos of [{ s: 1, f: 7 }, { s: 2, f: 3 }]) {
      expect(isCorrectNoteFret(q, pos, set)).toBe(false);
      expect(isNoteOutOfRange(q, pos, set)).toBe(false);
    }
  });
});

describe('generateNoteQuestion', () => {
  it('Name it: dot on an in-scope string within the range, no repeated note', () => {
    const set = settings({
      strings: [false, true, false, true, false, false], rFrom: 3, rTo: 7,
    });
    const rng = seededRng(7);
    let prev: NoteQuestion | null = null;
    for (let i = 0; i < 300; i++) {
      const q = generateNoteQuestion(set, rng, prev);
      if (q?.mode !== 'name') throw new Error('expected a name question');
      expect([1, 3]).toContain(q.s);
      expect(q.f).toBeGreaterThanOrEqual(3);
      expect(q.f).toBeLessThanOrEqual(7);
      expect(q.pc).toBe(pitchClass(q.s, q.f));
      expect(q.pc).not.toBe(prev?.pc);
      prev = q;
    }
  });

  it('Find it: asks only notes present on an in-scope string in the range', () => {
    const set = settings({
      mode: 'find', strings: [false, true, false, true, false, false],
      rFrom: 7, rTo: 3,
    });
    const rng = seededRng(3);
    const asked = new Set<string>();
    let prev: NoteQuestion | null = null;
    for (let i = 0; i < 400; i++) {
      const q = generateNoteQuestion(set, rng, prev);
      if (q?.mode !== 'find') throw new Error('expected a find question');
      expect([1, 3]).toContain(q.s);
      const frets = [3, 4, 5, 6, 7].filter(f => pitchClass(q.s, f) === q.pc);
      expect(frets).toHaveLength(1);
      expect(q.pc).not.toBe(prev?.pc);
      asked.add(`${q.s}:${q.pc}`);
      prev = q;
    }
    // Two strings, five frets each: every possible question comes up.
    expect(asked.size).toBe(10);
  });

  it('Find it: lists a note once per string when the range holds it twice', () => {
    // One string, all 16 frets: 12 distinct notes, each equally likely.
    const set = settings({
      mode: 'find', strings: [true, false, false, false, false, false],
      rFrom: 0, rTo: 15,
    });
    const rng = seededRng(5);
    const counts = new Array<number>(12).fill(0);
    for (let i = 0; i < 2400; i++) {
      const q = generateNoteQuestion(set, rng);
      if (!q) throw new Error('expected a question');
      counts[q.pc]++;
    }
    // Uniform is 200 each; a doubled note would sit near 300.
    for (const n of counts) {
      expect(n).toBeGreaterThan(140);
      expect(n).toBeLessThan(260);
    }
  });

  it('repeats the sole question when the settings allow only one', () => {
    const set = settings({
      mode: 'find', strings: [false, false, true, false, false, false],
      rFrom: 2, rTo: 2,
    });
    const only = { mode: 'find', pc: 4, s: 2 };
    expect(generateNoteQuestion(set, seededRng(1))).toEqual(only);
    expect(generateNoteQuestion(set, seededRng(1), only as NoteQuestion)).toEqual(only);
  });

  it('returns null with no strings in scope', () => {
    for (const mode of ['name', 'find'] as const) {
      expect(generateNoteQuestion(settings({ mode, strings: Array(6).fill(false) })))
        .toBeNull();
    }
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

  it('keeps find and maps the old find modes to it', () => {
    for (const mode of ['find', 'string', 'range']) {
      expect(parseNoteSettings({ mode }).mode).toBe('find');
    }
    expect(parseNoteSettings({ mode: 'name' }).mode).toBe('name');
  });
});
