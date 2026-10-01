# Soft UI: rounded cards, pill controls, maple fingerboard

Date: 2026-10-01
Status: approved design, awaiting implementation plan

## Problem

The app ships the "blueprint" look from the design handoff: square corners,
transparent boxes with hairline borders, `+` registration marks on every
frame, and a line-drawn fretboard. It reads as a wireframe rather than a
finished app.

## Goal

Replace the blueprint look with a soft one: filled rounded cards, pill-shaped
buttons and segmented controls, and a light maple fingerboard. This is a
visual change only, with one exception: the placeholder nav entries for
unbuilt sections are removed. Quiz rules, copy, controls, keyboard handling,
storage and layout structure stay as they are.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| How far from wireframe | Soft filled cards with pill controls (option C) |
| Fretboard treatment | Filled, rounded fingerboard |
| Fingerboard colour | Light maple `#f2e8d5` |
| Inlay (fret marker) colour | Brown `#a48658` |
| Where the look lives | Retheme the design system in place; no theme switch |
| Chords / Scales / Ear training nav placeholders | Removed |

## Approach

The soft look becomes the design system. `src/styles/industry.css` is edited
directly, the blueprint corner marks are deleted from the markup, and the
`line` fretboard theme is replaced by a `maple` theme. There is one look and
no toggle. `design_handoff/` is left untouched as the historical reference.

Rejected: an override stylesheet on top of an untouched `industry.css`
(specificity fights, hidden dead markup) and a switchable theme (double the
visual surface for a look we are leaving).

## Design

### 1. Tokens (`src/styles/industry.css`, `:root`)

Changed:

| Token | Old | New |
|---|---|---|
| `--radius-sm` | 2px | 10px |
| `--radius-md` | 4px | 14px |
| `--radius-lg` | 7px | 20px |

Added:

| Token | Value | Use |
|---|---|---|
| `--radius-pill` | 999px | buttons, chips, segmented controls, bars |
| `--color-card` | `#fbfbfc` | card and secondary-button fill |
| `--color-track` | `var(--color-neutral-200)` | segmented track, stat bar track |
| `--color-board` | `#f2e8d5` | fingerboard fill |
| `--color-board-inlay` | `#a48658` | inlay dots |
| `--color-board-fret` | `rgb(60 45 20 / 0.22)` | fret lines |

Status colours (`--color-success`, `--color-success-deep`, `--color-danger`)
and the accent and neutral ramps are unchanged.

### 2. Component styles

Delete from `industry.css`: the `.blueprint` rules, the `.corner` rules, and
the closing "blueprint frame" override block (the one that forces
`border-radius: 0`, transparent cards and hairline borders).

- **Cards** (`.card`: answer card, board frame, settings drawer):
  `background: var(--color-card)`, `border-radius: var(--radius-lg)`,
  `box-shadow: var(--shadow-md)`, no border.
- **Buttons** (`.btn`): `border-radius: var(--radius-pill)`.
  - `.btn-secondary`: `--color-card` fill, 1px `--color-divider` border.
  - `.btn-primary`: accent fill, as now.
  - `.btn-ghost`: unchanged apart from the pill radius.
  - `.btn-toggle[aria-pressed='true']`: unchanged colours (accent-100 fill,
    accent-800 text, accent border).
- **Segmented control** (`.seg`, used in the nav and for mode/direction):
  pill track with `--color-track` fill, 3px padding, no border. `.seg-opt` is
  a pill with no divider between options; selected is accent fill with
  `--color-bg` text; hover tint on unselected options stays.
  `overflow: hidden` is removed so focus rings are not clipped; the
  focus-visible outline offset becomes 2px in both rules that set it
  (`.seg-opt:has(input:focus-visible)` in `industry.css` and
  `.seg-opt:focus-visible` in `globals.css`).
- **Answer buttons** (`.answer-btn`): borderless tiles,
  `border-radius: var(--radius-md)`, `--color-bg` fill. `wrong` and `correct`
  states keep their red/green fills. Hover tint stays.
- **Chips** (`.chip`: interval pool, strings in scope): pills, via `.btn`.
- **Inputs** (`.input`): `border-radius: var(--radius-sm)`, `--color-bg`
  fill, hairline border.
- **Keycap** (`.keycap`): `border-radius: 4px`.
- **Stat bars** (settings drawer, per-interval/per-note): track and fill get
  `--radius-pill`; track colour is `--color-track`.
- **Legend swatches** (`BoardFrame`): square swatches get a 3px radius
  (circles unchanged).
- **Nav**: keeps its bottom divider; its segmented control follows the rule
  above.

In `globals.css` the doubled-class rules that outrank DS selectors for
`aria-pressed` / `aria-current` segmented options stay.

### 3. Layout

One change: the answer card and the board frame no longer share an edge. They
are separated by 14px, applied as a top margin on the board frame (not a grid
gap, which would also push the stats line down). The stats line stays
directly under the board frame. Nothing else moves: the board frame, now a
`.card`, sets `gap: 0` so the spacing between board and legend row is
unchanged.

### 4. Fretboard

`src/components/fretboard/theme.ts`: `LINE_THEME` is replaced by
`MAPLE_THEME`, the only theme. Both trainers import it.

| Field | Value |
|---|---|
| `frameBg` | removed from `FretboardTheme` (unused) |
| `board` | `var(--color-board)` |
| `string` | `var(--color-neutral-700)` |
| `fret` | `var(--color-board-fret)` |
| `nut` | `var(--color-neutral-800)` |
| `inlay` | `var(--color-board-inlay)` |
| other fields | unchanged |

`src/lib/fretboardGeometry.ts` gains the fingerboard fill rectangle, so the
component does not compute it:

- `fillY = boardY - SG / 2`, `fillH = boardH + SG` (half a string gap above
  and below the outer strings).
- `fillX = boardX` when the window starts above fret 0; when it starts at
  the nut, `fillX = boardX - 4` so the nut sits inside the fill, clear of
  the rounded corners. `fillW = boardRight - fillX`.
- `BOARD_RADIUS = 12` (exported constant).
- New field `fretNumberY = boardBottom + SG / 2 + 18`: fret-number baseline,
  moved down to clear the fill (replaces the hard-coded `boardBottom + 24`
  in `Fretboard.tsx`). `height` grows to `boardBottom + SG / 2 + 28`.
- `TOP` stays 16, so the fill's top edge sits at y = 1.

`Fretboard.tsx` rendering:

- The board `rect` uses the fill rectangle with `rx = BOARD_RADIUS`.
- Fret lines run the full fill height (`fillY` to `fillY + fillH`).
- A line that coincides with a rounded end of the fill is not drawn: the
  last line always, and the first line when the window does not start at the
  nut.
- The nut (window starts at fret 0) is drawn at `boardX`, 5px wide, with
  `stroke-linecap: round`; its line endpoints are 8 units inside the top and
  bottom of the fill.
- The open-string column stays left of the nut, outside the fill apart from
  the 4-unit strip beside the nut. Strings
  run from `boardX` to `boardRight` as today; open-string dots sit in the
  column left of the nut, on the card surface.
- The "Find in range" band is drawn in up to two segments, both with the
  fill's y and height:
  - Fretted part (frets ≥ 1 in the range): clipped to the rounded fill with
    a `clipPath`, so it no longer overhangs the board. Keeps
    `data-testid="range-band"`.
  - Open part (only when the range includes fret 0): a separate, unclipped
    rect over the open-string column (`cellX(0)`, width `OPENW`) with
    `rx = 8`, `data-testid="range-band-open"`. A 0–0 range shows only this
    segment.
- Dots, ✕ markers, hint dots, string labels, target-string highlight,
  out-of-scope opacity, tap cells, roving focus and arrow keys: unchanged.

The band opacity changes from 0.22 to 0.26 (both segments) so the green reads
clearly on the maple fill.

### 5. Markup cleanup

- Delete `src/components/Blueprint.tsx`.
- Remove `<Corners />` and the `blueprint` class from `AnswerCard` (card and
  Next button), `BoardFrame` (frame and hint button) and `SettingsParts`
  (drawer). `BoardFrame`'s section becomes `card board-frame`.

### 6. Nav: remove placeholder sections

`src/components/AppNav.tsx` renders "Chords", "Scales" and "Ear training" as
dimmed, non-interactive labels (the `LATER` array). They are removed: delete
the `LATER` constant and the block that renders it. The nav then contains
only the "E MINOR" brand and the Intervals / Notes segmented control. No
"coming soon" replacement is added.

### 7. Docs

- `CLAUDE.md`: update the Layout line about `theme.ts` (maple, not line) and
  the Styling section (soft look, new tokens, no blueprint).
- `design_handoff/README.md`: add a short note at the top that the shipped
  look has diverged from the handoff and pointing at this spec.

## Out of scope

Dark mode, behaviour or copy changes (other than section 6), mobile layout changes, new themes or a
theme switch, changes to quiz dots or status colours.

## Testing

- Existing Vitest suites must pass. They assert logic and `data-testid`s;
  any assertion that depends on removed markup or old geometry values is
  updated to the new specification, not weakened.
- New geometry tests in `fretboardGeometry.test.ts`: fill rectangle position
  and size for a window starting at 0 and one starting above 0;
  `fretNumberY` and total height (the existing `height` assertion changes
  to the new value).
- New component assertions: the fretted range band carries the clip path;
  a range including fret 0 renders `range-band-open`, and a 0–0 range
  renders only that segment; no element
  with class `corner` renders in either trainer; the nav does not contain
  the text "Chords", "Scales" or "Ear training".
- Browser pass with Playwright on the dev server, both trainers and every
  mode, at desktop width and at phone width (~390px): cards, pills, maple
  board, inlays, range band visibility, target-string highlight, horizontal
  board scroll, focus rings on pill controls and segmented options, the nut
  against the fill's rounded corners, open-string dots and the open band
  segment against the fill's left edge, the hint button's label change while
  held (it has no separate pressed style).
- `npm run lint` (zero errors), `npm test`, `npm run build`.

## Acceptance criteria

1. No square-cornered boxes, hairline card outlines or `+` corner marks
   remain anywhere in the app.
2. Answer card, board frame and settings drawer are filled rounded cards
   with a soft shadow; answer card and board frame are visibly separate.
3. All buttons and chips are pills; segmented controls are pill tracks with
   a pill selection.
4. The fingerboard is a rounded light maple panel with brown inlays; quiz
   dots and feedback colours are as before.
5. The Notes range band is clearly visible, stays inside the fingerboard for
   fretted positions, and still highlights the open-string column when the
   range includes fret 0.
6. Keyboard focus is visible on every interactive control.
7. The nav shows only the brand and the Intervals / Notes switch; "Chords",
   "Scales" and "Ear training" appear nowhere in the UI.
8. Lint, tests and build pass.
