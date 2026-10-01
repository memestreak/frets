---
date: 2026-10-01T09:17
summary: >
  Replace the blueprint wireframe look of the Frets trainers with soft
  rounded cards, pill controls and a light maple fingerboard, and remove
  the placeholder nav sections.
---

# Soft UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development (if
> subagents available) or executing-plans to implement this plan. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blueprint wireframe look with filled rounded cards, pill
controls and a light maple fingerboard, and remove the Chords / Scales / Ear
training nav placeholders.

**Architecture:** The soft look is rethemed in place: tokens and component
rules in `src/styles/industry.css` change, the blueprint corner marks are
deleted from the markup, and the fretboard's `line` theme becomes `maple`.
The fingerboard fill rectangle is computed in the pure geometry module and
drawn by the SVG `Fretboard` component. No behaviour changes apart from the
nav.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript strict,
Tailwind 4 (layout utilities only), plain CSS design system, Vitest +
Testing Library (jsdom).

**Spec:** `docs/specs/2026-10-01-soft-ui-design.md` — read it first.

**Branch:** `soft-ui` (already created, spec committed). Never commit to
`main`.

---

## Conventions for every task

- **Read `AGENTS.md` and `CLAUDE.md` first.** This Next.js version differs
  from older ones; nothing in this plan touches Next APIs, but do not
  "modernise" anything outside the plan.
- **Colours come from DS tokens** (`var(--color-*)`). Tailwind's default
  palette is disabled; `bg-(--color-track)` is the Tailwind 4 syntax for a
  token.
- **Tests:** `npx vitest run <file>` for one file, `npm test` for all.
  Vitest globals (`describe`, `it`, `expect`, `vi`) are enabled; do not
  import them.
- **If a test exposes a bug in production code, fix the production code.**
  Never weaken a test to make it pass.
- **Lint:** `npm run lint` must report zero errors (jsx-a11y is at error
  severity). Fix pre-existing errors too.
- **Commits:** write the message to a unique temp file with the Write tool
  and run `git commit -F <file>`. First line imperative, ≤ 50 chars, no
  period; blank line; body wrapped at 72. No heredocs. Each task below gives
  the subject line.
- **Shell:** no `grep`/`cat`/`sed`/`find` via Bash; no compound `cd x && y`
  commands.
- In the Claude Code sandbox, `next build` and `next dev` must run
  unsandboxed (Turbopack binds a local port).

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/components/AppNav.tsx` | modify | drop placeholder sections |
| `src/__tests__/AppNav.test.tsx` | create | nav shows only real sections |
| `src/components/Blueprint.tsx` | delete | corner marks (gone) |
| `src/components/quiz/AnswerCard.tsx` | modify | no corners / blueprint class |
| `src/components/quiz/BoardFrame.tsx` | modify | card frame, rounded legend swatch |
| `src/components/quiz/SettingsParts.tsx` | modify | no corners, rounded stat bars |
| `src/styles/industry.css` | modify | tokens, soft component rules |
| `src/app/globals.css` | modify | app component rules for the soft look |
| `src/lib/fretboardGeometry.ts` | modify | fill rect, fret-number baseline |
| `src/components/fretboard/theme.ts` | modify | `MAPLE_THEME` |
| `src/components/fretboard/Fretboard.tsx` | modify | rounded fill, nut, band segments |
| `src/components/intervals/IntervalTrainer.tsx` | modify | theme import |
| `src/components/notes/NoteTrainer.tsx` | modify | theme import |
| `src/__tests__/fretboardGeometry.test.ts` | modify | new geometry spec |
| `src/__tests__/Fretboard.test.tsx` | create | fill, band segments |
| `src/__tests__/IntervalTrainer.test.tsx`, `NoteTrainer.test.tsx` | modify | no `.corner` |
| `CLAUDE.md`, `design_handoff/README.md` | modify | docs |

---

### Task 1: Remove placeholder nav sections

**Files:**
- Create: `src/__tests__/AppNav.test.tsx`
- Modify: `src/components/AppNav.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/AppNav.test.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { AppNav } from '@/components/AppNav';

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: ComponentProps<'a'>) => (
    <a {...rest}>{children}</a>
  ),
}));

describe('AppNav', () => {
  it('links the two trainers and marks the active one', () => {
    render(<AppNav active="notes" />);
    expect(screen.getByRole('link', { name: 'Intervals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notes' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('shows no placeholders for unbuilt sections', () => {
    render(<AppNav active="intervals" />);
    for (const label of ['Chords', 'Scales', 'Ear training']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run it and confirm the second test fails**

Run: `npx vitest run src/__tests__/AppNav.test.tsx`
Expected: first test PASS, second FAIL (`Chords` is found in the document).

- [ ] **Step 3: Remove the placeholders**

In `src/components/AppNav.tsx` delete this line:

```tsx
const LATER = ['Chords', 'Scales', 'Ear training'];
```

and delete this block (the last child of `<nav>`):

```tsx
      {LATER.map(label => (
        <span
          key={label}
          className="text-[14px] opacity-45"
          title="Coming later"
          aria-disabled="true"
        >
          {label}
        </span>
      ))}
```

Leave everything else in the file as it is.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/__tests__/AppNav.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

Stage `src/components/AppNav.tsx src/__tests__/AppNav.test.tsx`.
Subject: `Remove placeholder sections from the nav`

---

### Task 2: Remove blueprint corner marks from the markup

**Files:**
- Modify: `src/__tests__/IntervalTrainer.test.tsx`,
  `src/__tests__/NoteTrainer.test.tsx`
- Modify: `src/components/quiz/AnswerCard.tsx`,
  `src/components/quiz/BoardFrame.tsx`,
  `src/components/quiz/SettingsParts.tsx`
- Delete: `src/components/Blueprint.tsx`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('NoteTrainer', …)` block in
`src/__tests__/NoteTrainer.test.tsx`:

```tsx
  it('renders no blueprint corner marks', () => {
    const { container } = render(<NoteTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(container.querySelector('.corner')).toBeNull();
    expect(container.querySelector('.blueprint')).toBeNull();
  });
```

Append the same test inside `describe('IntervalTrainer', …)` in
`src/__tests__/IntervalTrainer.test.tsx`, with `IntervalTrainer` in place of
`NoteTrainer`. (The click opens the settings drawer so it is covered too. If
`getByRole('button', { name: /settings/i })` matches more than one button,
read `src/components/quiz/TrainerHeader.tsx` and use the Settings toggle's
exact accessible name.)

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/__tests__/NoteTrainer.test.tsx src/__tests__/IntervalTrainer.test.tsx`
Expected: the two new tests FAIL (`.corner` element found); all others pass.

- [ ] **Step 3: Edit `AnswerCard.tsx`**

- Delete `import { Corners } from '../Blueprint';`.
- Change the section opening and remove its `<Corners />`:

```tsx
    <section className="card gap-2 px-[18px] pt-2.5 pb-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
```

- Next button: class becomes `btn btn-primary`, and its `<Corners />` child
  is removed:

```tsx
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNext}
            >
              Next <Keycap>{pause ? 'any key' : '↵'}</Keycap>
            </button>
```

- [ ] **Step 4: Edit `BoardFrame.tsx`**

- Delete `import { Corners } from '../Blueprint';`.
- Change the doc comment to
  `/** Card around the fretboard, with legend and hold-for-hint. */`.
- Section: `<section className="card board-frame">`, and delete the
  `<Corners />` line under it.
- Hint button: `className="btn btn-primary hint-btn"`, and delete the
  `<Corners />` line inside it.
- Legend swatch radius (square swatches get 3px):

```tsx
                  borderRadius: item.shape === 'circle' ? '50%' : 3,
```

- [ ] **Step 5: Edit `SettingsParts.tsx`**

- Delete `import { Corners } from '../Blueprint';`.
- Drawer section and its `<Corners />`:

```tsx
    <section id={id} className="card gap-4 px-[18px] py-4" aria-label="Quiz settings">
      {children}
```

- Stat bar track and fill (in `PerItemStats`) become rounded and use the
  track token:

```tsx
          <span
            className="relative block h-[5px] overflow-hidden rounded-full bg-(--color-track)"
            role="meter"
            aria-label={`${r.label} accuracy`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={r.pct ?? 0}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-(--color-accent)"
              style={{ width: `${r.pct ?? 0}%` }}
            />
          </span>
```

(`--color-track` is defined in Task 3.)

- [ ] **Step 6: Delete `Blueprint.tsx`**

Run: `git rm src/components/Blueprint.tsx`

- [ ] **Step 7: Run tests, types and lint**

Run: `npm test` — expected: all pass.
Run: `npx tsc --noEmit` — expected: no errors (no dangling `Corners`
imports).
Run: `npm run lint` — expected: zero errors.

- [ ] **Step 8: Commit**

Stage the three components, the two test files and the deletion.
Subject: `Remove blueprint corner marks from the markup`

---

### Task 3: Retheme the design system (cards, pills, tokens)

CSS only; jsdom does not evaluate it, so there is no unit test. It is
verified in the browser pass (Task 7). Keep the edits exactly as written.

**Files:**
- Modify: `src/styles/industry.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Tokens in `industry.css` `:root`**

Replace the three radius lines with:

```css
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-pill: 999px;
```

Add after the `--color-divider` line:

```css
  --color-card: #fbfbfc;
  --color-track: var(--color-neutral-200);

  /* Fretboard: light maple fingerboard. */
  --color-board: #f2e8d5;
  --color-board-inlay: #a48658;
  --color-board-fret: rgb(60 45 20 / 0.22);
```

`--color-neutral-200` is declared further down the same `:root` block; custom
properties resolve at use time, so the order is fine.

- [ ] **Step 2: Delete the blueprint rules in `industry.css`**

Delete everything from the line `.blueprint {` through the line
`.blueprint > .corner.br { bottom: -6px; right: -6px; }` inclusive (the
`.blueprint` rule, the comment and rule about `.blueprint.halftone`, and all
`.blueprint > .corner…` rules). The `.duotone` rules that follow stay.

At the end of the file, delete the whole final block:

```css
/* — blueprint frame: components are wireframe objects (see .blueprint
     and .corner above) — square, transparent, hairline-bordered — */
.card, .btn, .input, .tag, .seg, .dialog { border-radius: 0; }
.card, .dialog { background: transparent; border: 1px solid var(--color-divider); }
.btn { border: 1px solid var(--color-divider); }
.btn-primary { border-color: var(--color-accent); }
.btn-ghost { border-color: transparent; }
```

- [ ] **Step 3: Buttons in `industry.css`**

In the `.btn` rule change `border-radius: var(--radius-md);` to
`border-radius: var(--radius-pill);`.

Replace the three `.btn-secondary` rules with:

```css
.btn-secondary { background: var(--color-card); border-color: var(--color-divider); }
.btn-secondary:hover { background: color-mix(in srgb, var(--color-text) 7%, var(--color-card)); }
.btn-secondary:active { background: color-mix(in srgb, var(--color-text) 14%, var(--color-card)); }
```

`.btn-primary` and `.btn-ghost` rules are unchanged.

- [ ] **Step 4: Inputs in `industry.css`**

In the `.input` rule change `background: var(--color-surface);` to
`background: var(--color-bg);` and `border-radius: var(--radius-md);` to
`border-radius: var(--radius-sm);`.

- [ ] **Step 5: Segmented control in `industry.css`**

Replace the `.seg`, `.seg-opt` and `.seg-opt + .seg-opt` rules with:

```css
.seg {
  display: inline-flex; padding: 3px;
  background: var(--color-track); border-radius: var(--radius-pill);
}
.seg-opt {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 13px; font-size: 13px; cursor: pointer;
  border-radius: var(--radius-pill);
}
```

(The `overflow: hidden`, the border and the divider rule
`.seg-opt + .seg-opt { border-left: … }` are gone.)

In `.seg-opt:has(input:focus-visible)` change `outline-offset: -2px` to
`outline-offset: 2px`. The `:has(input:checked)` and hover rules are
unchanged.

- [ ] **Step 6: Cards in `industry.css`**

Replace the `.card` rule with:

```css
.card {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-3); border-radius: var(--radius-lg);
  background: var(--color-card); box-shadow: var(--shadow-md);
}
```

- [ ] **Step 7: Update the header comment in `industry.css`**

Replace the first comment in the file with:

```css
/* Industry design system — started as a copy of
   design_handoff/design-system/styles.css and since rethemed in place:
   soft filled cards, pill controls, maple fretboard tokens (see
   docs/specs/2026-10-01-soft-ui-design.md). Fonts are loaded with next/font
   in layout.tsx instead of the Google Fonts @import; --font-heading /
   --font-body are re-pointed in globals.css. */
```

- [ ] **Step 8: App component rules in `globals.css`**

Delete this rule (the global 2px focus offset now applies):

```css
  .seg-opt:focus-visible { outline-offset: -2px; }
```

In `.keycap` add `border-radius: 4px;`.

In `.answer-btn` add two declarations:

```css
    background: var(--color-bg);
    border-radius: var(--radius-md);
```

Replace the idle hover rule with:

```css
  .answer-btn[data-state='idle']:hover {
    background: color-mix(in srgb, var(--color-text) 7%, var(--color-bg));
  }
```

Replace the `.board-frame` rule with:

```css
  /* A .card: separate from the answer card above; no flex gap so the
     board-to-legend spacing stays as it was. */
  .board-frame { padding: 10px 22px 14px; margin-top: 14px; gap: 0; }
```

Leave the doubled-class `.seg .seg-opt.seg-opt[aria-pressed='true']` rule,
the `.seg-opt` reset, the hover rule and `.btn-toggle` rule untouched.

- [ ] **Step 9: Check nothing else references removed things**

Run: `git grep -n -e "blueprint" -e "corner" -- src ':!src/__tests__'`
Expected: no output. (The two trainer tests from Task 2 mention these names
on purpose; do not touch them.)

Run: `npm test` and `npm run lint` — expected: all pass, zero errors.

- [ ] **Step 10: Commit**

Stage `src/styles/industry.css src/app/globals.css`.
Subject: `Retheme design system with soft cards and pills`

---

### Task 4: Fingerboard fill geometry

**Files:**
- Modify: `src/__tests__/fretboardGeometry.test.ts`
- Modify: `src/lib/fretboardGeometry.ts`

Background: the board used to be only the area between the outer strings.
It now has a filled, rounded "fingerboard" that extends half a string gap
(`SG / 2`) above and below. A fret line that would sit exactly on a rounded
end of that fill is not drawn. When the window starts at the nut, the fill
starts 4 units left of the nut so the nut sits inside it.

- [ ] **Step 1: Update and add tests**

In `src/__tests__/fretboardGeometry.test.ts`:

In the first test, replace

```ts
    expect(g.fretLines).toHaveLength(16);
```

with

```ts
    // Nut + frets 1–14; the line at the fill's rounded right end is omitted.
    expect(g.fretLines).toHaveLength(15);
```

and replace

```ts
    expect(g.height).toBe(TOP + 5 * SG + 34);
```

with

```ts
    expect(g.fretNumberY).toBe(TOP + 5 * SG + SG / 2 + 18);
    expect(g.height).toBe(TOP + 5 * SG + SG / 2 + 28);
```

Add these tests inside the `describe`:

```ts
  it('extends the fingerboard fill half a string gap past the outer strings', () => {
    const g = fretboardGeometry(0, 15);
    expect(g.fillY).toBe(TOP - SG / 2);
    expect(g.fillH).toBe(5 * SG + SG);
    // Starts 4 units left of the nut so the nut sits inside the fill.
    expect(g.fillX).toBe(g.boardX - 4);
    expect(g.fillX + g.fillW).toBe(g.boardRight);
  });

  it('starts the fill at the board edge when there is no nut', () => {
    const g = fretboardGeometry(5, 12);
    expect(g.fillX).toBe(g.boardX);
    expect(g.fillW).toBe(g.boardW);
    // 8 columns have 9 edges; both rounded ends are omitted.
    expect(g.fretLines).toHaveLength(7);
    expect(g.fretLines[0].x).toBe(g.boardX + FW);
  });
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/__tests__/fretboardGeometry.test.ts`
Expected: FAIL (`fillY` undefined, length 16 ≠ 15, …).

- [ ] **Step 3: Implement**

In `src/lib/fretboardGeometry.ts`:

Add below `export const TOP = 16;`:

```ts
/** Corner radius of the fingerboard fill. */
export const BOARD_RADIUS = 12;
/** How far the fill extends left of the nut, so the nut sits inside it. */
const NUT_INSET = 4;
```

Add to the `FretboardGeometry` interface, after `boardBottom: number;`:

```ts
  /** Fingerboard fill: half a string gap beyond the outer strings. */
  fillX: number;
  fillY: number;
  fillW: number;
  fillH: number;
  /** Baseline of the fret-number labels, below the fill. */
  fretNumberY: number;
```

and change the `fretLines` doc/field to:

```ts
  /** Fret lines inside the fill; lines on its rounded ends are omitted. */
  fretLines: { x: number; nut: boolean }[];
```

In the function, after `const boardBottom = boardY + boardH;` add:

```ts
  const fillX = open ? boardX - NUT_INSET : boardX;
  const fillY = boardY - SG / 2;
  const fillW = boardRight - fillX;
  const fillH = boardH + SG;
  const fretNumberY = boardBottom + SG / 2 + 18;
```

Replace the `fretLines` constant with:

```ts
  // Column edges, minus the last one (the fill's rounded right end) and,
  // without a nut, the first one (its rounded left end).
  const fretLines = Array.from({ length: n + 1 }, (_, c) => ({
    x: boardX + c * FW,
    nut: open && c === 0,
  })).filter((l, c) => c < n && (l.nut || c > 0));
```

Replace the returned object with:

```ts
  return {
    minFret, maxFret, open, firstFret,
    boardX, boardY, boardW, boardH, boardRight, boardBottom,
    fillX, fillY, fillW, fillH, fretNumberY,
    width: boardRight + 12,
    height: fretNumberY + 10,
    cellX, cellW, cx, cy, fretLines, fretNumbers, inlays,
  };
```

(`fretNumberY + 10` equals `boardBottom + SG / 2 + 28`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/__tests__/fretboardGeometry.test.ts`
Expected: all pass (6 tests).

- [ ] **Step 5: Commit**

Stage both files. Subject: `Add fingerboard fill to fretboard geometry`

---

### Task 5: Maple theme and fretboard rendering

**Files:**
- Create: `src/__tests__/Fretboard.test.tsx`
- Modify: `src/components/fretboard/theme.ts`
- Modify: `src/components/fretboard/Fretboard.tsx`
- Modify: `src/components/intervals/IntervalTrainer.tsx` (line 6)
- Modify: `src/components/notes/NoteTrainer.tsx` (line 6)

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/Fretboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { BOARD_RADIUS, fretboardGeometry, OPENW } from '@/lib/fretboardGeometry';

const band = (from: number, to: number) => ({ from, to, color: 'green' });

describe('Fretboard', () => {
  it('draws the fingerboard as a rounded fill', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} />);
    const g = fretboardGeometry(0, 12);
    const fill = screen.getByTestId('board-fill');
    expect(fill).toHaveAttribute('x', String(g.fillX));
    expect(fill).toHaveAttribute('y', String(g.fillY));
    expect(fill).toHaveAttribute('width', String(g.fillW));
    expect(fill).toHaveAttribute('height', String(g.fillH));
    expect(fill).toHaveAttribute('rx', String(BOARD_RADIUS));
  });

  it('clips the fretted range band to the fingerboard', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} band={band(3, 7)} />);
    const g = fretboardGeometry(0, 12);
    const rect = screen.getByTestId('range-band');
    expect(rect).toHaveAttribute('clip-path', expect.stringMatching(/^url\(#.+\)$/));
    expect(rect).toHaveAttribute('x', String(g.cellX(3)));
    expect(rect).toHaveAttribute('y', String(g.fillY));
    expect(rect).toHaveAttribute('height', String(g.fillH));
    expect(screen.queryByTestId('range-band-open')).not.toBeInTheDocument();
  });

  it('adds an open-string segment when the range includes fret 0', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} band={band(0, 3)} />);
    const g = fretboardGeometry(0, 12);
    const open = screen.getByTestId('range-band-open');
    expect(open).toHaveAttribute('x', String(g.cellX(0)));
    expect(open).toHaveAttribute('width', String(OPENW));
    expect(open).not.toHaveAttribute('clip-path');
    // The fretted part starts at fret 1, not at the open column.
    expect(screen.getByTestId('range-band')).toHaveAttribute('x', String(g.cellX(1)));
  });

  it('shows only the open segment for a 0–0 range', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} band={band(0, 0)} />);
    expect(screen.getByTestId('range-band-open')).toBeInTheDocument();
    expect(screen.queryByTestId('range-band')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/__tests__/Fretboard.test.tsx`
Expected: FAIL — `board-fill` and `range-band-open` not found, no
`clip-path` attribute.

- [ ] **Step 3: Replace the theme**

Replace the top of `src/components/fretboard/theme.ts` (everything above
`export const STATUS`) with:

```ts
/** Fretboard colors. Only the `maple` theme ships. */
export interface FretboardTheme {
  board: string;
  string: string;
  fret: string;
  nut: string;
  inlay: string;
  muted: string;
  rootFill: string;
  rootFg: string;
  tgtFill: string;
  tgtFg: string;
  hintFill: string;
  hintStroke: string;
  hintFg: string;
  legend: string;
}

export const MAPLE_THEME: FretboardTheme = {
  board: 'var(--color-board)',
  string: 'var(--color-neutral-700)',
  fret: 'var(--color-board-fret)',
  nut: 'var(--color-neutral-800)',
  inlay: 'var(--color-board-inlay)',
  muted: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
  rootFill: 'var(--color-accent)',
  rootFg: 'var(--color-bg)',
  tgtFill: 'var(--color-text)',
  tgtFg: 'var(--color-bg)',
  hintFill: 'var(--color-accent-200)',
  hintStroke: 'var(--color-accent)',
  hintFg: 'var(--color-accent-800)',
  legend: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
};
```

`STATUS` below it is unchanged. (`frameBg` is removed; nothing reads it.)

In both `IntervalTrainer.tsx` and `NoteTrainer.tsx` change line 6 to:

```ts
import { MAPLE_THEME as T, STATUS } from '@/components/fretboard/theme';
```

- [ ] **Step 4: Update `Fretboard.tsx` imports and hooks**

Replace the four import statements at the top of the file (keep the
`'use client';` line above them) with:

```tsx
import {
  useEffect, useId, useMemo, useRef, useState, type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  BOARD_RADIUS, fretboardGeometry, OPENW, PAD, SG,
} from '@/lib/fretboardGeometry';
import { STRING_NAMES, STRINGS, type Position } from '@/lib/music';
import { MAPLE_THEME, type FretboardTheme } from './theme';
```

In the props destructuring change `theme = LINE_THEME` to
`theme = MAPLE_THEME`.

Add directly under the `svgRef` declaration:

```tsx
  const clipId = useId();
```

Add next to `const svgStyle = …` (before `return`):

```tsx
  const fillBottom = g.fillY + g.fillH;
  // The band over fretted positions starts at fret 1; fret 0 is the open
  // column left of the nut and gets its own segment.
  const bandFrom = band ? Math.max(band.from, g.firstFret) : 0;
```

- [ ] **Step 5: Replace the board, band and fret-line JSX**

Replace everything from the board `<rect … style={{ fill: theme.board }} />`
through the end of the `{g.fretLines.map(…)}` block (i.e. the board rect,
the band block, the inlays map and the fret-lines map) with:

```tsx
      <defs>
        <clipPath id={clipId}>
          <rect
            x={g.fillX} y={g.fillY} width={g.fillW} height={g.fillH}
            rx={BOARD_RADIUS}
          />
        </clipPath>
      </defs>
      <rect
        data-testid="board-fill"
        x={g.fillX} y={g.fillY} width={g.fillW} height={g.fillH}
        rx={BOARD_RADIUS}
        style={{ fill: theme.board }}
      />
      {band && g.open && band.from === 0 && band.to >= 0 && (
        <rect
          data-testid="range-band-open"
          x={g.cellX(0)} y={g.fillY} width={OPENW} height={g.fillH} rx={8}
          style={{ fill: band.color }}
          opacity={0.26}
        />
      )}
      {band && bandFrom <= band.to && (
        <rect
          data-testid="range-band"
          clipPath={`url(#${clipId})`}
          x={g.cellX(bandFrom)}
          y={g.fillY}
          width={g.cellX(band.to) + g.cellW(band.to) - g.cellX(bandFrom)}
          height={g.fillH}
          style={{ fill: band.color }}
          opacity={0.26}
        />
      )}
      {g.inlays.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={6} style={{ fill: theme.inlay }} />
      ))}
      {g.fretLines.map((l, i) => (
        <line
          key={i} x1={l.x} x2={l.x}
          y1={l.nut ? g.fillY + 8 : g.fillY}
          y2={l.nut ? fillBottom - 8 : fillBottom}
          style={{ stroke: l.nut ? theme.nut : theme.fret }}
          strokeWidth={l.nut ? 5 : 1.2}
          strokeLinecap={l.nut ? 'round' : undefined}
        />
      ))}
```

Notes for the implementer:
- React renders `clipPath={…}` on an SVG element as the `clip-path`
  attribute, which is what the test reads.
- `SG` is still used by the tap-cell rects further down; `PAD` by the string
  labels. If lint reports an unused import, remove only that import.

- [ ] **Step 6: Move the fret numbers**

In the fret-number `<text>` change `y={g.boardBottom + 24}` to
`y={g.fretNumberY}`.

Update the component's doc comment to:

```tsx
/**
 * SVG fretboard, low E at the bottom, drawn as a rounded fingerboard fill.
 * The viewBox tracks the fret window; the frame scrolls horizontally on
 * narrow screens instead of shrinking.
 */
```

- [ ] **Step 7: Run tests, types, lint**

Run: `npm test` — expected: all pass, including the 4 new `Fretboard`
tests and the existing `NoteTrainer` "Find in range" test (default range
3–7 still renders `range-band`).
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run lint` — expected: zero errors.
Run: `git grep -n "LINE_THEME" -- src` — expected: no output.

- [ ] **Step 8: Commit**

Stage the five source files and the new test.
Subject: `Draw the fretboard as a rounded maple fingerboard`

---

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `design_handoff/README.md`

- [ ] **Step 1: `CLAUDE.md`**

In the Layout section replace the `src/components/fretboard/` bullet with:

```markdown
- `src/components/fretboard/` — shared SVG `Fretboard` (rounded fingerboard
  fill, roving-focus tap cells, arrow keys) and `theme.ts` (only the `maple`
  theme ships).
```

In the Styling section replace the first bullet with:

```markdown
- `src/styles/industry.css` is the Industry design system, rethemed in place
  to the soft look (filled rounded cards, pill buttons and segmented
  controls); it no longer matches `design_handoff/`. It is imported into
  Tailwind's `components` layer; app component CSS is in the same layer in
  `globals.css`. Use DS tokens (`var(--color-*)`), e.g.
  `text-(--color-accent)`; Tailwind's default palette is disabled.
- Surfaces: `--color-card` (cards, secondary buttons), `--color-track`
  (segmented track, stat bars). Radii: `--radius-sm|md|lg|pill`. Fretboard:
  `--color-board`, `--color-board-inlay`, `--color-board-fret`.
```

In the intro paragraph, after the sentence about the spec and prototypes,
add:

```markdown
The prototypes remain the reference for quiz rules, not for the look: the
shipped styling follows `docs/specs/2026-10-01-soft-ui-design.md`.
```

- [ ] **Step 2: `design_handoff/README.md`**

Insert directly under the `# Handoff: Frets — guitar fretboard trainers`
heading:

```markdown
> **Note (2026-10-01):** the shipped app has diverged from this handoff's
> look. The blueprint styling (square corners, hairline frames, corner
> marks, line-drawn fretboard) was replaced by soft cards, pill controls and
> a maple fingerboard, and the Chords / Scales / Ear training nav
> placeholders were removed. See `docs/specs/2026-10-01-soft-ui-design.md`.
> This document remains the reference for quiz rules and behaviour.
```

- [ ] **Step 3: Commit**

Stage both files. Subject: `Document the soft UI restyle`

---

### Task 7: Verify in the browser and finish

No code is planned here; fix anything the checks find, with a test where
the defect is testable, and commit each fix separately.

- [ ] **Step 1: Static checks**

Run: `npm run lint` — zero errors.
Run: `npm test` — all pass.
Run: `npm run build` (unsandboxed) — static export succeeds.

- [ ] **Step 2: Start the dev server**

Use the `local-server` skill. Run `npm run dev` in the background
(unsandboxed), read its output to confirm the real port (Next auto-increments
if 3000 is busy), and use that host and port below.

- [ ] **Step 3: Desktop pass (1280×800) with Playwright**

Visit `/intervals` and `/notes`. Take screenshots and check each item:

1. Nav shows only "E MINOR" and the Intervals / Notes pill switch.
2. No square boxes, hairline card outlines or `+` corner marks anywhere.
3. Answer card, board frame and (after clicking Settings) the settings
   drawer are filled rounded cards with a soft shadow; answer card and board
   frame are separated; the stats line sits tight under the board frame.
4. Every button and chip is a pill; segmented controls are pill tracks with
   a pill selection; secondary buttons are readable on the page background.
5. Answer buttons are borderless rounded tiles; click a wrong then the right
   answer (Name it) and confirm red and green states.
6. Fingerboard is a rounded light maple panel with brown inlays; the nut
   sits inside the rounded left end; fret numbers clear the panel; no line
   on either rounded end.
7. Intervals → Find it: tap a wrong fret (red ✕) and the right one (green
   dot).
8. Notes → Find on string: target string is green and thicker.
9. Notes → Find in range: green band inside the fingerboard and clearly
   visible. In Settings set Target range to `0` to `3`: the open-string
   column gets its own rounded green segment and open-string dots read
   correctly against the fill's left edge. Set it to `0` to `0`: only the
   open segment shows. Restore `3` to `7`.
10. In Settings set Board window to `5` to `12`: both ends of the
    fingerboard are rounded, no nut. Restore `0` to `15`.
11. Hold the hint button: label changes while held, hint dots appear.
12. Tab through the page: a visible focus ring on nav options, mode options,
    toggles, answer buttons, inputs, hint button, and fret cells (Find it).
    Rings on segmented options are not clipped by the track.

- [ ] **Step 4: Phone pass (390×844)**

Resize and repeat on both trainers: header controls wrap without overflow;
segmented pills do not overflow the viewport; the board scrolls horizontally
inside its card and the card's rounded corners are intact; answer buttons
stay on one row and are legible.

- [ ] **Step 5: Shut the dev server down**

Stop the background process and confirm the port is free with
`ss -tlnp` (look for the port).

- [ ] **Step 6: Final state**

Run: `git status` — clean. Run: `git log --oneline main..soft-ui` — the
spec and plan commits (already made before Task 1) plus one commit per
task.

Then use the `finishing-a-development-branch` skill. Before any PR:
`git fetch origin main`, `git rebase origin/main`, re-run
`npm run lint`, `npm test`, `npm run build`.
