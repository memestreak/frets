---
date: 2026-10-01T13:31
summary: >
  Replace the Interval trainer's String pairs setting and fixed reach with
  user-set vertical and horizontal ranges, an enumerating generator, a dimmed
  Find-it board, a box-limited hint and a reveal of other correct frets.
---

# Interval Ranges Implementation Plan

> **Superseded.** This plan was executed, and the design then changed in
> review: the Find-it dimming and box-limited hint were removed, the ranges
> became one-based, Same string was dropped and direction moved into the
> settings dialog. It is kept as a record of the first pass only. The
> current behaviour is in `docs/specs/2026-10-01-interval-ranges-design.md`.

> **For agentic workers:** REQUIRED: Use subagent-driven-development (if
> subagents available) or executing-plans to implement this plan. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set how far (in strings and frets) the target may sit
from the root in the Interval trainer, and make the board, hint and judging
all follow that box.

**Architecture:** One pure predicate, `inBox`, in `src/lib/intervals.ts`
defines the box. Judging (`isCorrectFret`), the generator (now an
enumeration, not a rejection loop), Find-it dimming and the hint all call it.
`Fretboard` gains a generic `isCellDimmed` prop; the trainer supplies it.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript strict,
Tailwind 4, Vitest + Testing Library (globals on: `vi`, `describe`, `it`,
`expect` need no import).

**Spec:** `docs/specs/2026-10-01-interval-ranges-design.md`. Read it first.

**Branch:** `interval-ranges` (already created, rebased on `origin/main`).

---

## Ground rules for this repo

- Read `CLAUDE.md` and `AGENTS.md` first. This Next.js version differs from
  what you know; you will not need Next APIs for this work.
- Commands: `npm test` (Vitest, all), `npx vitest run <file>` (one file),
  `npm run lint` (zero errors allowed, including pre-existing ones),
  `npx tsc --noEmit` (type check).
- `npm run build` and `npm run dev` must run **unsandboxed** (Turbopack binds
  a local port).
- Commits: write the message to a temp file with the Write tool (use
  `$TMPDIR`), then `git commit -F <file>`. First line imperative, no period,
  at most 50 characters; blank line; body wrapped at 72 columns. Never use
  heredocs. Never commit to `main`.
- When a test exposes a bug in production code, fix the code. Never weaken a
  test to make it pass.
- Strings are numbered 0 (low E) to 5 (high e). `midi(s, f)` gives the pitch.
  `intervalClass(d)` names a signed semitone distance as 1–12 against the
  root (0 only for unison).

## File map

| File | Change |
|------|--------|
| `src/components/fretboard/theme.ts` | add `dim` colour |
| `src/components/fretboard/Fretboard.tsx` | add `isCellDimmed` prop |
| `src/__tests__/Fretboard.test.tsx` | dimming tests |
| `src/lib/intervals.ts` | rewrite: settings, `inBox`, judging, generator, parser |
| `src/__tests__/intervals.test.ts` | rewrite against the new API |
| `src/components/intervals/intervalState.ts` | pass `set` to `isCorrectFret` |
| `src/components/controls.tsx` | `Segmented` accepts number values |
| `src/components/intervals/IntervalTrainer.tsx` | range controls; dimming, hint, reveal, repeat avoidance, message |
| `src/__tests__/IntervalTrainer.test.tsx` | update and add tests |
| `CLAUDE.md` | note the deliberate departures from the prototype |

`src/__tests__/intervalState.test.ts` needs no change: its Find-it taps are
inside the default box.

---

### Task 1: Fretboard dimming prop

**Files:**
- Modify: `src/components/fretboard/theme.ts`
- Modify: `src/components/fretboard/Fretboard.tsx`
- Test: `src/__tests__/Fretboard.test.tsx`

Dimmed cells get a translucent overlay and stop accepting taps. The overlay
is drawn whether or not the board is tappable, because the trainer keeps the
box visible after the question is solved. The open-string column (fret 0)
sits left of the fingerboard fill on the page background, so it has nothing
to dim: a dimmed open cell is disabled but draws no overlay.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/Fretboard.test.tsx`, change the first import to add
`fireEvent`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
```

Append inside the `describe('Fretboard', ...)` block:

```tsx
  it('dims cells and stops them accepting taps', () => {
    const onCellClick = vi.fn();
    render(
      <Fretboard
        minFret={0} maxFret={5} dots={[]} onCellClick={onCellClick}
        isCellDimmed={p => p.f === 0 || p.f > 2}
      />,
    );
    expect(screen.getByTestId('dim-0-3')).toBeInTheDocument();
    expect(screen.queryByTestId('dim-0-2')).not.toBeInTheDocument();
    // The open column has no fingerboard under it to dim.
    expect(screen.queryByTestId('dim-0-0')).not.toBeInTheDocument();

    for (const id of ['cell-0-3', 'cell-0-0']) {
      const cell = screen.getByTestId(id);
      expect(cell).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cell);
      fireEvent.keyDown(cell, { key: 'Enter' });
    }
    expect(onCellClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cell-0-2'));
    expect(onCellClick).toHaveBeenCalledWith({ s: 0, f: 2 });
  });

  it('keeps the dimming when the board is not tappable', () => {
    render(
      <Fretboard minFret={0} maxFret={5} dots={[]} isCellDimmed={p => p.f > 2} />,
    );
    expect(screen.getByTestId('dim-5-4')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-5-4')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/__tests__/Fretboard.test.tsx`
Expected: the two new tests FAIL (`Unable to find an element by:
[data-testid="dim-0-3"]`); the four existing tests pass.

- [ ] **Step 3: Add the theme colour**

In `src/components/fretboard/theme.ts`, add `dim: string;` to
`FretboardTheme` after `muted: string;`, and to `MAPLE_THEME` after the
`muted:` line:

```ts
  dim: 'color-mix(in srgb, var(--color-bg) 62%, transparent)',
```

- [ ] **Step 4: Implement the prop**

In `src/components/fretboard/Fretboard.tsx`:

Add to `FretboardProps`, after `isCellDisabled`:

```ts
  /** Cells shown dimmed; they never accept taps. */
  isCellDimmed?: (pos: Position) => boolean;
```

Add `isCellDimmed` to the destructured props. Directly above `moveFocus`,
add one helper and use it everywhere a cell's disabled state is read:

```ts
  const cellOff = (pos: Position) =>
    (isCellDimmed?.(pos) ?? false) || (isCellDisabled?.(pos) ?? false);
```

In `moveFocus`, replace `if (!isCellDisabled?.(pos)) onCellClick?.(pos);`
with `if (!cellOff(pos)) onCellClick?.(pos);`.

In the cell loop, replace
`const disabled = isCellDisabled?.(pos) ?? false;` with
`const disabled = cellOff(pos);`.

Draw the overlays after the fret lines and before the strings (so strings
and dots stay crisp). Insert between the `g.fretLines.map(...)` block and
the `STRINGS.map(s => { const st = ...` block:

```tsx
      {isCellDimmed && (
        <g
          clipPath={`url(#${clipId})`} shapeRendering="crispEdges"
          style={{ fill: theme.dim, pointerEvents: 'none' }}
        >
          {STRINGS.map(s => {
            const rects = [];
            for (let f = g.firstFret; f <= maxFret; f++) {
              if (!isCellDimmed({ s, f })) continue;
              rects.push(
                <rect
                  key={`${s}:${f}`} data-testid={`dim-${s}-${f}`}
                  x={g.cellX(f)} y={g.cy(s) - SG / 2}
                  width={g.cellW(f)} height={SG}
                />,
              );
            }
            return rects;
          })}
        </g>
      )}
```

`g.firstFret` is 1 when the window starts at the nut, which is what skips
the open column.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/__tests__/Fretboard.test.tsx`
Expected: 6 passed.

- [ ] **Step 6: Type check, lint, commit**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both clean.

```bash
git add src/components/fretboard src/__tests__/Fretboard.test.tsx
git commit -F <msg file>
```

Message:

```
Add dimmed cells to the fretboard

Dimmed cells draw a translucent overlay and stop accepting taps.
The open-string column has no fingerboard fill, so it is disabled
without an overlay.
```

---

### Task 2: Range settings, the box, judging and the generator

**Files:**
- Modify: `src/lib/intervals.ts` (whole file replaced)
- Modify: `src/components/intervals/intervalState.ts:62`
- Modify: `src/components/controls.tsx:8-17`
- Modify: `src/components/intervals/IntervalTrainer.tsx` (imports, options,
  String pairs field)
- Test: `src/__tests__/intervals.test.ts` (whole file replaced)
- Test: `src/__tests__/IntervalTrainer.test.tsx` (two dialog tests)

Removing `pairs` from the settings type breaks the dialog's String pairs
field, so the dialog swap happens in this task to keep the commit type-clean.

- [ ] **Step 1: Replace the lib tests**

Replace all of `src/__tests__/intervals.test.ts` with:

```ts
import {
  clampHRange, correctFrets, defaultIntervalSettings,
  generateIntervalQuestion, inBox, isCorrectFret, parseIntervalSettings,
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/intervals.test.ts`
Expected: FAIL. The file imports `inBox`, `correctFrets` and `clampHRange`,
which do not exist yet, so most tests error with "is not a function".

- [ ] **Step 3: Replace the lib**

Replace all of `src/lib/intervals.ts` with:

```ts
import { clampFret, MIN_WINDOW_SPAN } from './fretWindow';
import {
  intervalClass, midi, pick, samePos, SIMPLE_INTERVALS, STRINGS,
  type Position, type Rng,
} from './music';

export type IntervalMode = 'name' | 'fret';
export type Direction = 'asc' | 'desc' | 'rand' | 'same';

export interface IntervalSettings {
  mode: IntervalMode;
  dir: Direction;
  /** Max strings between root and target, 1–5. Ignored for Same string. */
  vRange: number;
  /** Max frets between root and target, 1–12. */
  hRange: number;
  minFret: number;
  maxFret: number;
  /** Interval classes (1–12) that questions may ask for. */
  pool: number[];
  /** Allow spans over an octave (they still name as the simple class). */
  compound: boolean;
  noteNames: boolean;
  pause: boolean;
}

export interface IntervalQuestion {
  root: Position;
  tgt: Position;
  /** Interval class, 1–12, named from the root even when the target is below. */
  semis: number;
  /** True when the target is above the root. */
  up: boolean;
}

export const INTERVAL_STORAGE_KEY = 'eminor.intervals.v2';

export const V_RANGE_MAX = 5;
export const H_RANGE_MAX = 12;

export const clampHRange = (n: number): number =>
  Math.min(H_RANGE_MAX, Math.max(1, Math.round(n)));

export const defaultIntervalSettings = (): IntervalSettings => ({
  mode: 'name', dir: 'asc', vRange: V_RANGE_MAX, hRange: 4, minFret: 0, maxFret: 15,
  pool: [...SIMPLE_INTERVALS], compound: true, noteNames: false, pause: false,
});

/** Pool restricted to valid simple intervals. */
export const activePool = (set: IntervalSettings): number[] =>
  set.pool.filter(x => SIMPLE_INTERVALS.includes(x));

type Box = Pick<IntervalSettings, 'dir' | 'vRange' | 'hRange'>;
type Judging = Box & Pick<IntervalSettings, 'compound'>;

/**
 * Is `pos` in the box around `root` for a question in direction `up`? The
 * box reaches `hRange` frets either way. On other strings it follows the
 * string direction (higher strings when `up`) for `vRange` strings; on the
 * root's own string it follows the fret direction. Same string questions
 * stay on the root's string. The root itself is never in the box.
 */
export function inBox(root: Position, up: boolean, pos: Position, set: Box): boolean {
  const ds = pos.s - root.s;
  const df = pos.f - root.f;
  if (Math.abs(df) > set.hRange) return false;
  if (ds === 0) return up ? df > 0 : df < 0;
  if (set.dir === 'same') return false;
  return (up ? ds > 0 : ds < 0) && Math.abs(ds) <= set.vRange;
}

/**
 * Is `tgt` a correct answer for a Find-it question? It must be in the box,
 * lie in the question's pitch direction, name as the same interval class,
 * and stay within an octave unless compound spans are allowed.
 */
export function isCorrectFret(q: IntervalQuestion, tgt: Position, set: Judging): boolean {
  if (!inBox(q.root, q.up, tgt, set)) return false;
  const d = midi(tgt.s, tgt.f) - midi(q.root.s, q.root.f);
  return (q.up ? d > 0 : d < 0)
    && intervalClass(d) === q.semis
    && (Math.abs(d) <= 12 || set.compound);
}

/** Every correct fret for the question inside the fret window. */
export function correctFrets(q: IntervalQuestion, set: IntervalSettings): Position[] {
  const out: Position[] = [];
  for (const s of STRINGS) {
    for (let f = set.minFret; f <= set.maxFret; f++) {
      if (isCorrectFret(q, { s, f }, set)) out.push({ s, f });
    }
  }
  return out;
}

/** Every question the settings allow. Targets on the root's string are only
 * asked in Same string direction. */
function candidates(set: IntervalSettings, pool: number[]): IntervalQuestion[] {
  const same = set.dir === 'same';
  const ups = set.dir === 'rand' ? [true, false] : [set.dir !== 'desc'];
  const out: IntervalQuestion[] = [];
  for (const s of STRINGS) {
    for (let f = set.minFret; f <= set.maxFret; f++) {
      const root = { s, f };
      const lo = Math.max(set.minFret, f - set.hRange);
      const hi = Math.min(set.maxFret, f + set.hRange);
      for (const up of ups) {
        for (const ts of STRINGS) {
          if ((ts === s) !== same) continue;
          for (let tf = lo; tf <= hi; tf++) {
            const tgt = { s: ts, f: tf };
            const semis = intervalClass(midi(ts, tf) - midi(s, f));
            if (!pool.includes(semis)) continue;
            const q = { root, tgt, semis, up };
            if (isCorrectFret(q, tgt, set)) out.push(q);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Random question for the settings, or null when none exists. Each interval
 * class that is possible comes up equally often, and `prev` is not repeated
 * unless it is the only question.
 */
export function generateIntervalQuestion(
  set: IntervalSettings,
  rng: Rng = Math.random,
  prev: IntervalQuestion | null = null,
): IntervalQuestion | null {
  const pool = activePool(set);
  if (!pool.length) return null;
  let all = candidates(set, pool);
  if (prev && all.length > 1) {
    all = all.filter(c => !(samePos(c.root, prev.root) && samePos(c.tgt, prev.tgt)));
  }
  if (!all.length) return null;
  const semis = pick(rng, pool.filter(c => all.some(q => q.semis === c)));
  return pick(rng, all.filter(q => q.semis === semis));
}

const MODES: IntervalMode[] = ['name', 'fret'];
const DIRS: Direction[] = ['asc', 'desc', 'rand', 'same'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseIntervalSettings(raw: unknown): IntervalSettings {
  const d = defaultIntervalSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const oneOf = <T>(v: unknown, opts: T[], fb: T) =>
    opts.includes(v as T) ? (v as T) : fb;
  const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
  const num = (v: unknown, fb: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clampFret(v) : fb;
  // Ranges are rejected, not clamped, when out of bounds.
  const intRange = (v: unknown, min: number, max: number, fb: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fb;

  let minFret = num(r.minFret, d.minFret);
  let maxFret = num(r.maxFret, d.maxFret);
  if (maxFret - minFret < MIN_WINDOW_SPAN) {
    minFret = d.minFret;
    maxFret = d.maxFret;
  }
  const pool = Array.isArray(r.pool)
    ? [...new Set(r.pool.filter(
      (x): x is number => SIMPLE_INTERVALS.includes(x as number),
    ))].sort((a, b) => a - b)
    : d.pool;

  return {
    mode: oneOf(r.mode, MODES, d.mode),
    dir: oneOf(r.dir, DIRS, d.dir),
    vRange: intRange(r.vRange, 1, V_RANGE_MAX, d.vRange),
    hRange: intRange(r.hRange, 1, H_RANGE_MAX, d.hRange),
    minFret,
    maxFret,
    pool,
    compound: bool(r.compound, d.compound),
    noteNames: bool(r.noteNames, d.noteNames),
    pause: bool(r.pause, d.pause),
  };
}
```

- [ ] **Step 4: Run to verify the lib tests pass**

Run: `npx vitest run src/__tests__/intervals.test.ts`
Expected: all pass. If the "about equally often" or "rare question" test
fails, the generator is wrong; do not widen the tolerance.

- [ ] **Step 5: Update the reducer call site**

In `src/components/intervals/intervalState.ts`, change

```ts
      return isCorrectFret(q, pos, set.compound)
```

to

```ts
      return isCorrectFret(q, pos, set)
```

Run: `npx vitest run src/__tests__/intervalState.test.ts`
Expected: 6 passed, with no change to that test file.

- [ ] **Step 6: Update the two dialog tests**

In `src/__tests__/IntervalTrainer.test.tsx`, in the test
`'opens settings in a modal dialog and closes it'`, replace

```tsx
    // Not the "String pairs" group: Field and Segmented both carry that name.
    expect(within(dialog).getByRole('button', { name: 'Skip one' }))
      .toBeInTheDocument();
```

with

```tsx
    expect(within(dialog).getByRole('spinbutton', { name: 'Horizontal range' }))
      .toBeInTheDocument();
```

Replace the whole test `'applies a setting from the dialog live, without
closing'` with:

```tsx
  it('applies the range settings from the dialog live, without closing', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    const saved = () =>
      JSON.parse(localStorage.getItem(INTERVAL_STORAGE_KEY) ?? '{}').set;
    expect(saved()).toMatchObject({ vRange: 5, hRange: 4 });

    // Pool chips are named "m3, minor third", so "3" is the range option.
    fireEvent.click(within(dialog).getByRole('button', { name: '3' }));
    expect(saved().vRange).toBe(3);

    const reach = within(dialog).getByRole('spinbutton', { name: 'Horizontal range' });
    fireEvent.change(reach, { target: { value: '7' } });
    expect(saved().hRange).toBe(7);
    // Out-of-range input is clamped, not stored as typed.
    fireEvent.change(reach, { target: { value: '40' } });
    expect(saved().hRange).toBe(12);

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });
```

(`fireEvent.change` carries no `inputType`, which `FretInput` treats as a
spinner click and commits at once.)

Run: `npx vitest run src/__tests__/IntervalTrainer.test.tsx`
Expected: those two tests FAIL (no "Horizontal range" spinbutton).

- [ ] **Step 7: Let `Segmented` take numbers**

In `src/components/controls.tsx`, change both generic constraints from
`T extends string` to `T extends string | number`:

```tsx
interface SegmentedProps<T extends string | number> {
```

```tsx
export function Segmented<T extends string | number>(
```

- [ ] **Step 8: Swap the dialog field**

In `src/components/intervals/IntervalTrainer.tsx`:

Replace the `@/lib/intervals` import with:

```tsx
import {
  activePool, clampHRange, generateIntervalQuestion, H_RANGE_MAX,
  INTERVAL_STORAGE_KEY, V_RANGE_MAX,
  type Direction, type IntervalMode, type IntervalSettings,
} from '@/lib/intervals';
```

Replace the `PAIR_OPTS` constant with:

```tsx
const V_RANGE_OPTS = Array.from(
  { length: V_RANGE_MAX }, (_, i) => [i + 1, String(i + 1)] as const,
);
```

Replace the whole `<Field label="String pairs" ...>...</Field>` element
with:

```tsx
          <Field label="Vertical range" note="Same string questions ignore this.">
            <Segmented<number>
              label="Vertical range" options={V_RANGE_OPTS} value={set.vRange}
              onChange={v => update({ vRange: v })}
            />
          </Field>
          <Field label="Horizontal range">
            <FretPair>
              <FretInput
                label="Horizontal range" min={1} max={H_RANGE_MAX} value={set.hRange}
                onCommit={v => update({ hRange: clampHRange(v) })}
              />
              <span className="text-muted">frets</span>
            </FretPair>
          </Field>
```

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: all pass except possibly
`'shows the hint overlay while H is held'` and
`'Find it: a wrong cell gets an ✕ and stops accepting taps'`, which Task 3
rewrites. Both should in fact still pass at this point (the hint is not yet
limited, and a root tap is still a scored miss); if either fails, note the
failure and carry on, since Task 3 replaces them.

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/intervals.ts src/components src/__tests__
git commit -F <msg file>
```

Message:

```
Replace string pairs with range settings

Vertical and horizontal ranges define a box around the root that
bounds generated questions and correct Find-it answers. The
generator now enumerates every valid question, so each possible
interval is asked equally often, "no question fits" is exact and
the same question is not asked twice running.

Compound spans default to on so the default vertical range uses
all six strings.
```

---

### Task 3: Trainer board: dimming, hint, reveal, repeats, message

**Files:**
- Modify: `src/components/intervals/IntervalTrainer.tsx`
- Test: `src/__tests__/IntervalTrainer.test.tsx`

- [ ] **Step 1: Add a Find-it test helper and rewrite the affected tests**

In `src/__tests__/IntervalTrainer.test.tsx`, replace the
`@/lib/intervals` import with:

```tsx
import {
  correctFrets, defaultIntervalSettings, generateIntervalQuestion, inBox,
  INTERVAL_STORAGE_KEY, isCorrectFret, type IntervalSettings,
} from '@/lib/intervals';
import { intervalClass, midi, samePos, STRINGS, type Position } from '@/lib/music';
```

(and delete the old `import { intervalClass, midi } from '@/lib/music';`).

Below the `KEYS` constant add:

```tsx
/**
 * Render in Find it with stored settings. The trainer draws its first
 * question from the seeded rng, so the same seed reproduces it here.
 */
function renderFindIt(seed: number, patch: Partial<IntervalSettings> = {}) {
  const set = { ...defaultIntervalSettings(), mode: 'fret' as const, ...patch };
  localStorage.setItem(INTERVAL_STORAGE_KEY, JSON.stringify({ set }));
  render(<IntervalTrainer rng={seededRng(seed)} />);
  const q = generateIntervalQuestion(set, seededRng(seed));
  if (!q) throw new Error('no question for these settings');
  return { set, q };
}

/** Every cell of the fret window. */
const cells = (set: IntervalSettings): Position[] => STRINGS.flatMap(s =>
  Array.from({ length: set.maxFret - set.minFret + 1 }, (_, i) => ({ s, f: set.minFret + i })));

const cellEl = (p: Position) => screen.getByTestId(`cell-${p.s}-${p.f}`);
```

Replace the test `'shows the hint overlay while H is held'` with:

```tsx
  it('shows the hint overlay, limited to the box, while H is held', () => {
    render(<IntervalTrainer rng={seededRng(3)} />);
    expect(screen.queryAllByTestId('dot-hint')).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'h' });

    const rootEl = screen.getByTestId('dot-root');
    const root = { s: Number(rootEl.dataset.s), f: Number(rootEl.dataset.f) };
    const set = defaultIntervalSettings();
    // The default direction is ascending.
    const expected = cells(set).filter(p => inBox(root, true, p, set));
    const hints = screen.getAllByTestId('dot-hint');
    expect(hints).toHaveLength(expected.length);
    for (const h of hints) {
      const p = { s: Number(h.dataset.s), f: Number(h.dataset.f) };
      expect(inBox(root, true, p, set)).toBe(true);
    }

    expect(screen.getByRole('button', { name: /Intervals from root/ })).toBeInTheDocument();
    fireEvent.keyUp(window, { key: 'h' });
    expect(screen.queryAllByTestId('dot-hint')).toHaveLength(0);
  });
```

Replace the test `'Find it: a wrong cell gets an ✕ and stops accepting
taps'` with these four:

```tsx
  it('Find it: a wrong cell in the box gets an ✕ and stops accepting taps', () => {
    const { set, q } = renderFindIt(8);
    const miss = cells(set).find(
      p => inBox(q.root, q.up, p, set) && !isCorrectFret(q, p, set),
    );
    if (!miss) throw new Error('no wrong cell in the box');
    fireEvent.click(cellEl(miss));
    expect(screen.getByTestId('dot-wrong')).toBeInTheDocument();
    expect(cellEl(miss)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('feedback')).toHaveTextContent('Not that fret — try again');
  });

  it('Find it: cells outside the box are dimmed and ignore taps', () => {
    const { set, q } = renderFindIt(8, { vRange: 1, hRange: 2 });
    const outside = cells(set).filter(p => !inBox(q.root, q.up, p, set));
    const inside = cells(set).filter(p => inBox(q.root, q.up, p, set));
    expect(outside).toContainEqual(q.root);

    for (const p of outside) {
      expect(cellEl(p)).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cellEl(p));
    }
    for (const p of inside) expect(cellEl(p)).not.toHaveAttribute('aria-disabled');
    // Open-string cells have no overlay; every other outside cell has one.
    expect(screen.getAllByTestId(/^dim-/)).toHaveLength(outside.filter(p => p.f > 0).length);

    expect(screen.queryByTestId('dot-wrong')).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback')).toBeEmptyDOMElement();
    expect(screen.getByTestId('stats-line')).toHaveTextContent('No answers yet this session');
  });

  it('Name it: the board is not dimmed', () => {
    render(<IntervalTrainer rng={seededRng(8)} />);
    expect(screen.queryAllByTestId(/^dim-/)).toHaveLength(0);
  });

  it('Find it: solving reveals the other correct frets and keeps the box', () => {
    const { set, q } = renderFindIt(8, { pause: true });
    const all = correctFrets(q, set);
    fireEvent.click(cellEl(q.tgt));

    const target = screen.getByTestId('dot-target');
    expect({ s: Number(target.dataset.s), f: Number(target.dataset.f) }).toEqual(q.tgt);
    const also = screen.queryAllByTestId('dot-also')
      .map(el => ({ s: Number(el.dataset.s), f: Number(el.dataset.f) }));
    expect(also).toHaveLength(all.length - 1);
    for (const p of also) {
      expect(samePos(p, q.tgt)).toBe(false);
      expect(isCorrectFret(q, p, set)).toBe(true);
    }
    expect(screen.getAllByTestId(/^dim-/).length).toBeGreaterThan(0);
  });
```

In the test `'explains when no question fits'`, change the last expectation
to the full new message:

```tsx
    expect(screen.getByTestId('feedback')).toHaveTextContent(
      'No question fits these settings — widen the ranges or interval pool.',
    );
```

Add one more test at the end of the `describe`:

```tsx
  it('does not repeat the same question when another exists', () => {
    // P5 up on adjacent strings within two frets: several fingerings.
    renderFindIt(21, { mode: 'name', pool: [7], vRange: 1, hRange: 2 });
    const where = () => ['dot-root', 'dot-target'].map(id => {
      const el = screen.getByTestId(id);
      return `${el.dataset.s}:${el.dataset.f}`;
    }).join(' ');
    let prev = where();
    for (let i = 0; i < 40; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
      expect(where()).not.toBe(prev);
      prev = where();
    }
  });
```

Before relying on that last test, check the Skip button's accessible name
in `src/components/quiz/AnswerCard.tsx` and adjust the `/Skip/` matcher if
it differs.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/__tests__/IntervalTrainer.test.tsx`
Expected FAIL: the hint test (too many hints), the dimming test (no `dim-`
elements, cells not disabled), the reveal test (no `dot-also`), the message
test (old wording). The repeat test may pass or fail by chance; the wrong
cell and Name-it tests may already pass. That is fine: note which.

- [ ] **Step 3: Implement the board behaviour**

In `src/components/intervals/IntervalTrainer.tsx`:

Add `correctFrets` and `inBox` to the `@/lib/intervals` import, and
`samePos` and `type Position` to the `@/lib/music` import.

Pass the current question so it is not repeated. Replace `next` and
`update`:

```tsx
  const next = () => dispatch({ type: 'next', q: generateIntervalQuestion(set, rng, q) });
  const update = (patch: Partial<IntervalSettings>, regen = true) => {
    const s = { ...set, ...patch };
    dispatch({
      type: 'settings', set: s,
      q: regen ? generateIntervalQuestion(s, rng, q) : undefined,
    });
  };
```

Below the `useQuizKeyboard` call, add:

```tsx
  // The box around the root: what the ranges allow for this question.
  const lit = (pos: Position) => !!q && inBox(q.root, q.up, pos, set);
```

Limit the hint to the box. In the hint loop replace

```tsx
          if (s === q.root.s && f === q.root.f) continue;
```

with

```tsx
          if (!lit({ s, f })) continue;
```

Reveal the other correct frets. Replace the
`if (mode === 'name' || answered) { ... }` block with:

```tsx
    if (mode === 'name' || answered) {
      const at = picked ?? q.tgt;
      if (mode === 'fret') {
        // Other fingerings of the interval inside the box.
        for (const p of correctFrets(q, set)) {
          if (samePos(p, at)) continue;
          dots.push({
            ...p, kind: 'also', fill: 'transparent', stroke: STATUS.green,
            fg: STATUS.greenDeep, label: INTERVAL_NAMES[q.semis], fontSize: 10,
          });
        }
      }
      const fill = answered ? STATUS.green : T.tgtFill;
      dots.push({
        ...at, kind: 'target', fill, stroke: fill, fg: T.tgtFg,
        label: answered
          ? INTERVAL_NAMES[q.semis]
          : set.noteNames ? noteName(at.s, at.f) : '?',
        fontSize: answered ? 10 : 12,
      });
    }
```

(In Find-it this block only runs once `answered` is true, so the reveal
never leaks the answer.)

Change the no-question message:

```tsx
    feedback = 'No question fits these settings — widen the ranges or interval pool.';
```

Dim the board in Find-it. On the `<Fretboard ...>` element add, after
`isCellDisabled`:

```tsx
            isCellDimmed={mode === 'fret' && q ? pos => !lit(pos) : undefined}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/__tests__/IntervalTrainer.test.tsx`
Expected: all pass.

If `renderFindIt`'s question does not match what is on screen (the reveal
test's target position differs), the trainer consumed the rng before
generating its first question. Find out why with the
systematic-debugging skill; do not paper over it in the test.

- [ ] **Step 5: Full suite, types, lint**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/intervals/IntervalTrainer.tsx src/__tests__/IntervalTrainer.test.tsx
git commit -F <msg file>
```

Message:

```
Show the range box on the Find-it board

Cells outside the box are dimmed and not tappable, the hint labels
only cells in the box, and solving reveals the other correct frets.
The trainer passes the current question to the generator so it is
not asked twice running.
```

---

### Task 4: Docs, build and browser verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the opening section, after the sentence that ends "(G below C is a P5).",
add a new paragraph:

```markdown
The Interval trainer also departs from the prototype's String pairs setting,
fixed four-fret reach and "repeats allowed" rule: `vRange` / `hRange` define
a box around the root (`inBox` in `lib/intervals.ts`) that drives question
generation, Find-it judging and dimming, and the hint. The generator
enumerates every valid question, so each possible interval is asked equally
often and the same question never comes up twice running. See
`docs/specs/2026-10-01-interval-ranges-design.md`.
```

In the Layout section's `src/components/fretboard/` bullet, add
"`isCellDimmed` overlay" to the list of what `Fretboard` provides.

- [ ] **Step 2: Build**

Run (unsandboxed): `npm run build`
Expected: static export to `out/` succeeds with no type or lint errors.

- [ ] **Step 3: Browser check**

Use the local-server skill to start `npm run dev` (unsandboxed); read its
output for the real port. Open `/intervals` with Playwright and confirm,
taking a screenshot of each:

1. Settings dialog shows "Vertical range" (1–5, 5 selected) and "Horizontal
   range" (4, "frets"), with no "String pairs". It fits at 400px width
   without the segmented control overflowing.
2. Find it, Asc, vertical 2, horizontal 2: only the two higher strings and
   the root's string to the right are lit, within two frets; the rest is
   visibly dimmed but frets and inlays remain readable. Tune the `dim`
   opacity in `theme.ts` if the contrast is too weak or too heavy. Also look
   at the nut when fret 1 is dimmed: the fill starts 4px left of the nut but
   the fret-1 overlay starts at the nut, so check for an undimmed strip or a
   half-covered nut line and report what you see.
3. Desc lights lower strings and the root's string to the left; Same string
   lights only the root's string to the right.
4. Tapping a dimmed cell does nothing; a wrong lit cell gets an ✕; the
   correct one turns green and other correct frets get a green outline.
5. Hold for hint labels only lit cells, in both modes.
6. Name it has no dimming.
7. Type 40 in Horizontal range and blur: it becomes 12. Reload: both ranges
   persist.
8. Vertical 1, horizontal 1, pool P8 only: the "No question fits these
   settings — widen the ranges or interval pool." message appears.
9. Console has no errors.

Shut the dev server down when finished.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src/components/fretboard/theme.ts
git commit -F <msg file>
```

Message:

```
Document the interval range settings

Note the deliberate departures from the prototype: the range box
replaces String pairs and the fixed reach, and the generator gives
an even interval mix without immediate repeats.
```

(`theme.ts` is included only if the dim opacity was tuned in Step 3.)

---

## Known limitation

Open-string cells sit on the page background, not the fingerboard, so a
dimmed open cell looks the same as a lit one. It is still disabled. Report
this to the user after the browser check rather than inventing a fix.
