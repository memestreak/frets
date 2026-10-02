---
date: 2026-10-02
summary: >
  Reduce the Note trainer to two modes, Name it and Find it, with Strings in
  scope and Fret range applying to both. Find it names one string; the right
  note outside the range is explained, not scored.
---

# Note Trainer Two Modes Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development (if
> subagents available) or executing-plans to implement this plan. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Note trainer has two modes, Name it and Find it, and both
settings (Strings in scope, Fret range) apply to both modes.

**Architecture:** `src/lib/notes.ts` owns the mode type, the judging
predicates and an enumerating question generator. `noteState.ts` mirrors
`intervalState.ts` (`picked`, `far`, `farLast`). `NoteTrainer.tsx` loses the
range band; `Fretboard` loses its now-unused `band` prop.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript strict,
Vitest + Testing Library.

**Spec:** `docs/specs/2026-10-01-notes-modes-design.md`

**Branch:** `notes-two-modes` (already created, rebased on `origin/main`).

**Notes for the implementer:**

- Vitest does not typecheck. Tasks 1 and 2 leave type errors in files that
  later tasks fix; `npm run lint` and `npm run build` are only expected to
  pass from Task 3 on.
- Run one test file with `npm test -- src/__tests__/<file>`.
- `npm run build` must run unsandboxed (Turbopack binds a local port).
- Commit messages: write the message to a temp file with the Write tool and
  use `git commit -F <file>`. First line imperative, at most 50 characters.
- String indices: 0 = low E, 1 = A, 2 = D, 3 = G, 4 = B, 5 = high e.
  `pitchClass(s, f)`: 0 = C … 11 = B.

---

### Task 1: Modes, judging and generation in `lib/notes.ts`

**Files:**
- Modify: `src/lib/notes.ts`
- Test: `src/__tests__/notes.test.ts`

- [ ] **Step 1: Replace the tests**

Replace the whole of `src/__tests__/notes.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npm test -- src/__tests__/notes.test.ts`
Expected: FAIL (`isCorrectNoteFret is not a function`, and the generator
tests fail on the old argument order).

- [ ] **Step 3: Rewrite `src/lib/notes.ts`**

Replace the whole file with:

```ts
import {
  pick, pitchClass, STRINGS, type Position, type Rng,
} from './music';

export type NoteMode = 'name' | 'find';

export interface NoteSettings {
  mode: NoteMode;
  /** Strings questions are drawn from, low E first. */
  strings: boolean[];
  /** Fret range, in either order. Both modes stay inside it. */
  rFrom: number;
  rTo: number;
  pause: boolean;
}

export type NoteQuestion =
  | { mode: 'name'; pc: number; s: number; f: number }
  | { mode: 'find'; pc: number; s: number };
export type FindQuestion = Extract<NoteQuestion, { mode: 'find' }>;

export const NOTE_STORAGE_KEY = 'eminor.notes.v2';

/** The board always draws the open strings through this fret. */
export const NOTE_MAX_FRET = 15;

/** Clamp an arbitrary fret number to the board. */
export const clampNoteFret = (value: number): number =>
  Math.max(0, Math.min(NOTE_MAX_FRET, Math.round(value)));

export const defaultNoteSettings = (): NoteSettings => ({
  mode: 'name', strings: [true, true, true, true, true, true],
  rFrom: 1, rTo: 12, pause: false,
});

/**
 * The settings dialog's Defaults: every field it shows goes back to its
 * default. Mode and Pause b/w sit in the header, so they are kept.
 */
export const resetNoteSettings = (set: NoteSettings): NoteSettings => ({
  ...defaultNoteSettings(), mode: set.mode, pause: set.pause,
});

export const stringsInScope = (set: NoteSettings): number[] =>
  STRINGS.filter(s => set.strings[s]);

type Range = Pick<NoteSettings, 'rFrom' | 'rTo'>;

/** Fret range, ordered. */
export function targetRange(set: Range): [number, number] {
  return [Math.min(set.rFrom, set.rTo), Math.max(set.rFrom, set.rTo)];
}

const inRange = (set: Range, f: number): boolean => {
  const [a, b] = targetRange(set);
  return f >= a && f <= b;
};
const onTarget = (q: FindQuestion, pos: Position): boolean =>
  pos.s === q.s && pitchClass(pos.s, pos.f) === q.pc;

/** Is `pos` the asked note on the asked string, inside the fret range? */
export const isCorrectNoteFret = (q: FindQuestion, pos: Position, set: Range): boolean =>
  onTarget(q, pos) && inRange(set, pos.f);

/**
 * Is `pos` the asked note on the asked string, but outside the range? The
 * trainer explains such a tap instead of scoring it as a miss.
 */
export const isNoteOutOfRange = (q: FindQuestion, pos: Position, set: Range): boolean =>
  onTarget(q, pos) && !inRange(set, pos.f);

/**
 * Every question the settings allow. Find it lists a note once per string,
 * even when the range holds it at two frets.
 */
function candidates(set: NoteSettings): NoteQuestion[] {
  const [a, b] = targetRange(set);
  const out: NoteQuestion[] = [];
  for (const s of stringsInScope(set)) {
    const seen = new Set<number>();
    for (let f = a; f <= b; f++) {
      const pc = pitchClass(s, f);
      if (set.mode === 'name') out.push({ mode: 'name', pc, s, f });
      else if (!seen.has(pc)) {
        seen.add(pc);
        out.push({ mode: 'find', pc, s });
      }
    }
  }
  return out;
}

/**
 * Random question for the settings, or null when no string is in scope.
 * Every possible question is equally likely, and `prev`'s note is not asked
 * again unless it is the only note the settings allow.
 */
export function generateNoteQuestion(
  set: NoteSettings,
  rng: Rng = Math.random,
  prev: NoteQuestion | null = null,
): NoteQuestion | null {
  const all = candidates(set);
  const fresh = prev ? all.filter(c => c.pc !== prev.pc) : all;
  const from = fresh.length ? fresh : all;
  return from.length ? pick(rng, from) : null;
}

const MODES: NoteMode[] = ['name', 'find'];
/** Modes from before Find it merged them; both load as `find`. */
const OLD_FIND_MODES: unknown[] = ['string', 'range'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseNoteSettings(raw: unknown): NoteSettings {
  const d = defaultNoteSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fb: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clampNoteFret(v) : fb;

  const strings = Array.isArray(r.strings) && r.strings.length === 6
    && r.strings.every(x => typeof x === 'boolean')
    ? (r.strings as boolean[])
    : d.strings;
  const mode = OLD_FIND_MODES.includes(r.mode)
    ? 'find'
    : MODES.includes(r.mode as NoteMode) ? (r.mode as NoteMode) : d.mode;

  return {
    mode,
    strings,
    rFrom: num(r.rFrom, d.rFrom),
    rTo: num(r.rTo, d.rTo),
    pause: typeof r.pause === 'boolean' ? r.pause : d.pause,
  };
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test -- src/__tests__/notes.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

`git add src/lib/notes.ts src/__tests__/notes.test.ts`, message
"Merge note Find modes and enumerate questions".

---

### Task 2: Reducer with `picked`, `far` and `farLast`

**Files:**
- Modify: `src/components/notes/noteState.ts`
- Test: `src/__tests__/noteState.test.ts`

- [ ] **Step 1: Replace the tests**

Replace the whole of `src/__tests__/noteState.test.ts` with:

```ts
import { noteReducer, type NoteState } from '@/components/notes/noteState';
import { defaultNoteSettings, type NoteQuestion } from '@/lib/notes';
import { emptyStats } from '@/lib/stats';

const base = (q: NoteQuestion, patch: Partial<NoteState['set']> = {}): NoteState => ({
  set: { ...defaultNoteSettings(), mode: q.mode, ...patch },
  stats: emptyStats(),
  q,
  picked: null,
  far: [],
  farLast: false,
  answered: false,
  wrong: [],
  advanceMs: null,
});

// A on the A string: open (out of the default 1–12 range) or fret 12.
const findA = { mode: 'find', pc: 9, s: 1 } as const;

describe('noteReducer', () => {
  it('Name it: wrong then right scores one miss', () => {
    let s = base({ mode: 'name', pc: 0, s: 1, f: 3 });
    s = noteReducer(s, { type: 'answerName', pc: 2 });
    s = noteReducer(s, { type: 'answerName', pc: 0 });
    expect(s.answered).toBe(true);
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
    expect(s.stats.per[0]).toEqual({ c: 0, t: 1 });
  });

  it('Find it: one in-range tap on the target string solves it', () => {
    const s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.answered).toBe(true);
    expect(s.picked).toEqual({ s: 1, f: 12 });
    expect(s.stats).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: the right note outside the range is marked, not scored', () => {
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 0 } });
    expect(s.answered).toBe(false);
    expect(s.far).toEqual([{ s: 1, f: 0 }]);
    expect(s.farLast).toBe(true);
    expect(s.wrong).toEqual([]);
    expect(s.stats).toEqual(emptyStats());
    // Tapping it again is ignored.
    expect(noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 0 } })).toBe(s);
    // Solving afterwards still scores a clean correct answer.
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.farLast).toBe(false);
    expect(s.stats).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: the right note on another string is a miss', () => {
    // A on the G string, fret 2.
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 3, f: 2 } });
    expect(s.wrong).toEqual([{ s: 3, f: 2 }]);
    expect(s.far).toEqual([]);
    expect(noteReducer(s, { type: 'answerFret', pos: { s: 3, f: 2 } })).toBe(s);
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
  });

  it('Find it: a miss after an out-of-range tap clears farLast', () => {
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 0 } });
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 5 } });
    expect(s.farLast).toBe(false);
    expect(s.far).toHaveLength(1);
    expect(s.wrong).toEqual([{ s: 1, f: 5 }]);
  });

  it('a new question clears picked, far and farLast', () => {
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 0 } });
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    s = noteReducer(s, { type: 'next', q: { mode: 'find', pc: 0, s: 2 } });
    expect(s).toMatchObject({ picked: null, far: [], farLast: false, answered: false });
  });
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npm test -- src/__tests__/noteState.test.ts`
Expected: FAIL (the Find-it tests; `picked` is undefined, the out-of-range
tap solves or misses).

- [ ] **Step 3: Rewrite `src/components/notes/noteState.ts`**

Replace the whole file with:

```ts
import { samePos, type Position, type Rng } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, isCorrectNoteFret,
  isNoteOutOfRange, NOTE_STORAGE_KEY, parseNoteSettings, type NoteQuestion,
  type NoteSettings,
} from '@/lib/notes';
import {
  applyMiss, applyPause, applySolve, freshAttempt, type QuizCore,
} from '@/lib/quizFlow';
import { emptyStats, parseStats } from '@/lib/stats';
import { loadJson } from '@/lib/storage';

/** A wrong try: a pitch class (Name it) or a board position (Find it). */
export type NoteWrong = number | Position;

export interface NoteState extends QuizCore<NoteWrong> {
  set: NoteSettings;
  q: NoteQuestion | null;
  /** Where the correct Find-it answer was tapped. */
  picked: Position | null;
  /** Find-it taps on the right note outside the fret range; not scored. */
  far: Position[];
  /** True while the latest tap was one of those. */
  farLast: boolean;
}

export type NoteAction =
  | { type: 'answerName'; pc: number }
  | { type: 'answerFret'; pos: Position }
  | { type: 'next'; q: NoteQuestion | null }
  | { type: 'settings'; set: NoteSettings; q?: NoteQuestion | null }
  | { type: 'togglePause' }
  | { type: 'resetStats' };

const newQuestion = (state: NoteState, q: NoteQuestion | null): NoteState => ({
  ...state, ...freshAttempt(), q, picked: null, far: [], farLast: false,
});

export function initNoteState(rng: Rng = Math.random): NoteState {
  const saved = (loadJson(NOTE_STORAGE_KEY) ?? {}) as Record<string, unknown>;
  const set = saved.set ? parseNoteSettings(saved.set) : defaultNoteSettings();
  return {
    set,
    stats: saved.stats ? parseStats(saved.stats) : emptyStats(),
    q: generateNoteQuestion(set, rng),
    picked: null,
    far: [],
    farLast: false,
    ...freshAttempt(),
  };
}

export function noteReducer(state: NoteState, action: NoteAction): NoteState {
  const { q, set } = state;
  switch (action.type) {
    case 'answerName': {
      if (!q || q.mode !== 'name' || state.answered) return state;
      if (state.wrong.includes(action.pc)) return state;
      return action.pc === q.pc
        ? applySolve(state, q.pc, set.pause)
        : applyMiss(state, action.pc, q.pc);
    }
    case 'answerFret': {
      if (!q || q.mode !== 'find' || state.answered) return state;
      const { pos } = action;
      if (state.wrong.some(w => typeof w !== 'number' && samePos(w, pos))) return state;
      if (state.far.some(p => samePos(p, pos))) return state;
      if (isCorrectNoteFret(q, pos, set)) {
        return { ...applySolve(state, q.pc, set.pause), picked: pos, farLast: false };
      }
      // The right note beyond the user's own range is not a miss.
      if (isNoteOutOfRange(q, pos, set)) {
        return { ...state, far: [...state.far, pos], farLast: true };
      }
      return { ...applyMiss(state, pos, q.pc), farLast: false };
    }
    case 'next':
      return newQuestion(state, action.q);
    case 'settings': {
      const next = { ...state, set: action.set };
      return action.q === undefined ? next : newQuestion(next, action.q);
    }
    case 'togglePause': {
      const pause = !set.pause;
      return applyPause({ ...state, set: { ...set, pause } }, pause);
    }
    case 'resetStats':
      return { ...state, stats: emptyStats() };
  }
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test -- src/__tests__/noteState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/components/notes/noteState.ts src/__tests__/noteState.test.ts`,
message "Track out-of-range taps in the note reducer".

---

### Task 3: Trainer UI

**Files:**
- Modify: `src/components/notes/NoteTrainer.tsx`
- Test: `src/__tests__/NoteTrainer.test.tsx`

- [ ] **Step 1: Update the tests**

In `src/__tests__/NoteTrainer.test.tsx`:

a. Replace the imports and add a helper above `describe`:

```ts
import { fireEvent, render, screen, within } from '@testing-library/react';
import NoteTrainer from '@/components/notes/NoteTrainer';
import { pitchClass } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, NOTE_STORAGE_KEY,
  type NoteSettings,
} from '@/lib/notes';
import { seededRng } from './helpers/rng';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/**
 * Render in Find it with stored settings. The trainer draws its first
 * question from the seeded rng, so the same seed reproduces it here. Pause
 * is on so a solved question stays on screen.
 */
function renderFindIt(seed: number, patch: Partial<NoteSettings> = {}) {
  const set = {
    ...defaultNoteSettings(), mode: 'find' as const, pause: true, ...patch,
  };
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({ set }));
  render(<NoteTrainer rng={seededRng(seed)} />);
  const q = generateNoteQuestion(set, seededRng(seed));
  if (q?.mode !== 'find') throw new Error('expected a find question');
  return { set, q };
}

const cell = (s: number, f: number) => screen.getByTestId(`cell-${s}-${f}`);
const savedStats = () =>
  JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}').stats;
```

b. Delete the tests "Find in range: counts found targets until all are
found" and "Find on string: highlights the target string", and put these in
their place:

```ts
  it('offers two modes', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const mode = screen.getByRole('group', { name: 'Mode' });
    expect(within(mode).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Name it', 'Find it']);
    fireEvent.click(within(mode).getByRole('button', { name: 'Find it' }));
    expect(screen.getByRole('heading', { name: 'Find the note' })).toBeInTheDocument();
    expect(screen.getByTestId('find-label')).toBeInTheDocument();
  });

  it('Find it: names and highlights the target string, with no range band', () => {
    const { q } = renderFindIt(1);
    const name = ['E', 'A', 'D', 'G', 'B', 'e'][q.s];
    expect(screen.getByTestId('find-label').nextSibling)
      .toHaveTextContent(`on the ${name} string`);
    expect(screen.getByTestId(`string-${q.s}`)).toHaveAttribute('stroke-width', '3.5');
    expect(screen.queryByTestId('range-band')).not.toBeInTheDocument();
    expect(screen.getByText('Target string')).toBeInTheDocument();
  });

  it('Find it: one in-range tap solves the question', () => {
    const { q } = renderFindIt(4, { rFrom: 12, rTo: 15 });
    const f = [12, 13, 14, 15].find(x => pitchClass(q.s, x) === q.pc) ?? -1;
    fireEvent.click(cell(q.s, f));
    expect(screen.getByTestId('feedback')).toHaveTextContent(/^Correct — /);
    expect(screen.getAllByTestId('dot-found')).toHaveLength(1);
    expect(savedStats()).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: explains the right note outside the range without scoring', () => {
    const { q } = renderFindIt(4, { rFrom: 12, rTo: 15 });
    const f = [12, 13, 14, 15].find(x => pitchClass(q.s, x) === q.pc) ?? -1;
    // The same note an octave lower is below the range.
    fireEvent.click(cell(q.s, f - 12));
    expect(screen.getByTestId('feedback')).toHaveTextContent(
      'Right note, but outside your range — look in frets 12–15',
    );
    expect(screen.getAllByTestId('dot-far')).toHaveLength(1);
    expect(cell(q.s, f - 12)).toHaveAttribute('aria-disabled', 'true');
    expect(savedStats()).toMatchObject({ correct: 0, total: 0 });

    // A wrong note replaces the message and is scored.
    const miss = f === 12 ? 13 : f - 1;
    fireEvent.click(cell(q.s, miss));
    expect(screen.getByTestId('feedback')).toHaveTextContent('Not that fret — try again');
    expect(screen.getAllByTestId('dot-wrong')).toHaveLength(1);
  });

  it('Find it: a single-fret range reads "look at fret N"', () => {
    const { q } = renderFindIt(4, { rFrom: 14, rTo: 14 });
    // The only in-range fret is 14, so fret 2 holds the same note.
    fireEvent.click(cell(q.s, 2));
    expect(screen.getByTestId('feedback')).toHaveTextContent(
      'Right note, but outside your range — look at fret 14',
    );
  });
```

c. In "opens settings in a modal dialog and closes it", add after the
Strings in scope assertion:

```ts
    expect(within(dialog).getByRole('group', { name: 'Fret range' }))
      .toBeInTheDocument();
```

d. In "Defaults resets the dialog fields, keeping mode and pause", change
both `mode: 'string'` to `mode: 'find'`.

e. In "has no Board window setting and always draws frets 0 to 15", change
`mode: 'string'` to `mode: 'find'`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npm test -- src/__tests__/NoteTrainer.test.tsx`
Expected: FAIL (the five new tests and the Fret range assertion).

- [ ] **Step 3: Update `src/components/notes/NoteTrainer.tsx`**

a. Imports: add `samePos` to the `@/lib/music` import; drop `BAND_FILL`.

b. Replace `MODE_OPTS`, `TITLES` and `BAND_FILL` with:

```ts
const MODE_OPTS = [['name', 'Name it'], ['find', 'Find it']] as const;
const TITLES: Record<NoteMode, string> = {
  name: 'Name the note',
  find: 'Find the note',
};
```

c. Replace the state destructuring and range text:

```ts
  const { set, stats, q, answered, wrong, picked, far, farLast } = state;
  const { mode } = set;
  const [rA, rB] = targetRange(set);
  // The board does not draw the range, so the out-of-range message names it.
  const rangeHint = rA === rB ? `look at fret ${rA}` : `look in frets ${rA}–${rB}`;
  const inScope = (s: number) => set.strings[s];
```

d. Replace `next` and `update` (new generator argument order; pass the
current question as `prev`):

```ts
  const next = () => dispatch({ type: 'next', q: generateNoteQuestion(set, rng, q) });
  const update = (patch: Partial<NoteSettings>, regen = true) => {
    const s = { ...set, ...patch };
    dispatch({
      type: 'settings', set: s,
      q: regen ? generateNoteQuestion(s, rng, q) : undefined,
    });
  };
```

e. In the dots block, replace the `for (const p of found)` loop and the
`if (q.mode !== 'name')` block with:

```ts
    if (picked) {
      dots.push({
        ...picked, kind: 'found', fill: STATUS.green, stroke: STATUS.green,
        fg: T.tgtFg, label: SHARP_NAMES[q.pc], fontSize: 11,
      });
    }
    if (q.mode === 'find') {
      for (const w of wrong) {
        if (typeof w === 'number') continue;
        dots.push({
          ...w, kind: 'wrong', fill: 'transparent', stroke: STATUS.red, fg: STATUS.red,
          label: '✕', fontSize: 12, opacity: 0.9,
        });
      }
      // Right note, beyond the range: marked, but not as a miss.
      for (const p of far) {
        dots.push({
          ...p, kind: 'far', fill: 'transparent', stroke: T.muted, fg: T.muted,
          label: SHARP_NAMES[q.pc], fontSize: 10,
        });
      }
    }
```

f. Replace the feedback chain's middle branch. The `q.mode === 'range' &&
found.length` branch goes; `farLast` takes its place:

```ts
  } else if (answered) {
    feedback = `Correct — ${noteName}${missSuffix(wrong.length)}`;
    tone = 'success';
  } else if (farLast) {
    feedback = `Right note, but outside your range — ${rangeHint}`;
  } else if (wrong.length) {
```

g. Replace the legend and `findSub`:

```ts
  const legend: LegendItem[] = mode === 'name'
    ? [{ label: 'Note to name', color: T.tgtFill, shape: 'circle' }]
    : [{ label: 'Target string', color: STATUS.green, shape: 'square' }];

  const findSub = q?.mode === 'find' ? `on the ${STRING_NAMES[q.s]} string` : '';
```

h. In the dialog, change `<Field label="Target range">` to
`<Field label="Fret range">`.

i. Replace the `<Fretboard …/>` element:

```tsx
          <Fretboard
            minFret={0}
            maxFret={NOTE_MAX_FRET}
            dots={dots}
            scrollToFret={q?.mode === 'name' ? q.f : q ? rA : null}
            stringStyle={s => {
              const target = q?.mode === 'find' && q.s === s;
              return {
                color: target ? STATUS.green : undefined,
                width: target ? 3.5 : undefined,
                opacity: inScope(s) ? 1 : 0.3,
              };
            }}
            onCellClick={mode === 'find' && !answered && q
              ? pos => dispatch({ type: 'answerFret', pos })
              : undefined}
            isCellDisabled={pos => far.some(p => samePos(p, pos)) || wrong.some(
              w => typeof w !== 'number' && samePos(w, pos),
            )}
          />
```

j. The `AnswerCard` children keep their `mode === 'name'` / `mode !==
'name'` conditions; no change needed.

- [ ] **Step 4: Run the whole suite, then lint**

Run: `npm test`
Expected: PASS, every file.

Run: `npm run lint`
Expected: no errors. Fix any unused import it reports (`pitchClass` is
still used by the hint overlay; `STRINGS` by the hint and the dialog).

- [ ] **Step 5: Commit**

`git add src/components/notes/NoteTrainer.tsx src/__tests__/NoteTrainer.test.tsx`,
message "Give the Note trainer Name it and Find it".

---

### Task 4: Remove the unused `band` prop from `Fretboard`

**Files:**
- Modify: `src/components/fretboard/Fretboard.tsx`
- Test: `src/__tests__/Fretboard.test.tsx`

- [ ] **Step 1: Trim the tests**

In `src/__tests__/Fretboard.test.tsx`: delete the `band` helper and the
three band tests ("clips the fretted range band…", "adds an open-string
segment…", "shows only the open segment…"). Change the import to
`import { BOARD_RADIUS, fretboardGeometry } from '@/lib/fretboardGeometry';`.
The "draws the fingerboard as a rounded fill" test stays.

- [ ] **Step 2: Remove the prop**

In `src/components/fretboard/Fretboard.tsx`:

- Remove `band` (and its doc comment) from `FretboardProps` and from the
  destructured parameters.
- Remove the `bandFrom` constant and its comment.
- Remove both `{band && …}` `<rect>` blocks (`range-band-open`,
  `range-band`).
- The clip path existed only for the band: remove the `<defs>` block, the
  `clipId` constant, and `useId` from the React import.
- Remove `OPENW` from the `@/lib/fretboardGeometry` import (keep
  `BOARD_RADIUS`, `fretboardGeometry`, `PAD`, `SG`).
- Change the `isCellDisabled` comment to "Cells that no longer accept taps
  (already tapped)."

- [ ] **Step 3: Run tests, lint and build**

Run: `npm test` — expected PASS.
Run: `npm run lint` — expected no errors. If `OPENW` is now unused
anywhere else, leave its export in `fretboardGeometry.ts` (the geometry
itself uses it).
Run: `npm run build` (unsandboxed) — expected a successful static export.

- [ ] **Step 4: Commit**

`git add src/components/fretboard/Fretboard.tsx src/__tests__/Fretboard.test.tsx`,
message "Remove the unused Fretboard range band".

---

### Task 5: Project notes

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the Notes rule**

After the paragraph that begins "The Interval trainer also departs from the
prototype's String pairs setting", add:

```markdown
The Note trainer departs from the prototype's three modes: it has Name it
and Find it, and both settings (Strings in scope, Fret range) apply to both.
Find it names one string; the right note on that string outside the range is
explained, not scored, and the board never draws the range. Its generator
also enumerates every valid question. See
`docs/specs/2026-10-01-notes-modes-design.md`.
```

- [ ] **Step 2: Commit**

`git add CLAUDE.md plans/2026-10-02T08-19-notes-two-modes.md`, message
"Document the two-mode Note trainer".

---

### Task 6: Browser check

- [ ] **Step 1:** Start `npm run dev` (unsandboxed, in the background) and
  read its output for the real port.
- [ ] **Step 2:** Open the Notes trainer with Playwright and check:
  - the header shows `Name it | Find it` and nothing else;
  - Name it: a `?` dot inside frets 1–12; answering works;
  - Find it: the prompt reads "on the X string", that string is bold green,
    there is no shaded band, the legend reads "Target string";
  - a correct in-range tap turns green and advances;
  - set Fret range to 12–15 in Settings, tap the asked note below fret 12
    on the target string: muted marker and the "outside your range — look
    in frets 12–15" message, stats unchanged;
  - a wrong fret shows the red ✕ and "Not that fret — try again";
  - the settings dialog shows "Strings in scope" and "Fret range";
  - no console errors.
- [ ] **Step 3:** Stop the dev server and confirm the port is free
  (`ss -tlnp`).
