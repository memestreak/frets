# Handoff: Frets — guitar fretboard trainers

## Overview

Frets is a guitar-focused music theory practice app. This package covers the first two sections, both quizzes played on a shared fretboard diagram:

1. **Interval Trainer** — name the interval between two shown notes, or find the fret that completes a named interval.
2. **Note Trainer** — name the note at a shown position, find a named note on a highlighted string, or find every occurrence of a note inside a fret range.

Both share one app shell (header with section switch, quiz settings drawer, mode segmented control, "Pause b/w" toggle), one fretboard component, one answer card, and one hold-to-reveal hint mechanic. Later sections (Chords, Scales, Ear training) are placeholders in the nav.

## About the design files

`prototypes/*.dc.html` are **design references built in HTML** — working prototypes that show the intended look and behavior. They are not production code to copy. The task is to **recreate these designs in a proper application codebase**. No environment exists yet: choose the most appropriate stack (a component framework with a small build, e.g. React/Vite or Svelte, is a good fit — one Fretboard component reused by every trainer). Plain web app; no PWA/offline requirement, no accounts. Progress persists in `localStorage`.

The prototypes open directly in a browser (`prototypes/Interval Trainer.dc.html`). Their logic (`<script data-dc-script>` at the bottom of each file) is plain JavaScript and is the authoritative reference for quiz rules, geometry and colors.

## Fidelity

**High-fidelity.** Colors, type, spacing, and states are final. Recreate the UI to match, using the Industry design system tokens in `design-system/styles.css` (guide: `design-system/industry-readme.md`).

---

## App shell

Page background `--color-bg` (#f2f2f3), text `--color-text` (#1d1f20), body font Barlow 15px, headings Barlow Condensed 600.

**Header bar** (`.nav`, 10px 20px padding, 1px bottom divider):
- Brand "E MINOR" — Barlow Condensed 600 18px, letter-spacing 0.04em, pushed left (`margin-right:auto`).
- Section switch: segmented control (`.seg`) with links "Intervals" / "Notes"; the active one is filled `--color-accent` with `--color-bg` text.
- Future sections "Chords", "Scales", "Ear training" as plain links at 45% opacity (not clickable yet).

**Main column**: max-width 1240px, 20px padding, CSS grid rows packed to top (`align-content:start`), 20px row gap between header / drawer / quiz block.

**Page header row** (flex, wrap, `align-items:flex-start`, `justify-content:space-between`):
- Left: kicker `h6` in accent ("Fretboard · Interval trainer" / "Fretboard · Note trainer"), `h2` prompt title (32px), muted 14px sub-line explaining the current mode.
- Right (flex, gap 10px): mode segmented control(s), **Pause b/w** toggle button, **Settings** button (both `.btn.btn-secondary` with a 14px Lucide icon, stroke 1.5: `pause` and `sliders-horizontal`).

**Toggle button style** (used for Pause b/w, Note names, Allow spans, interval pool chips, string chips): off = transparent bg, divider border; on = bg `--color-accent-100` (#eef6ff), text `--color-accent-800` (#2c455d), border `--color-accent`.

**Settings drawer**: collapses/expands below the header (`.card.blueprint` with four `+` corner marks, padding 16px 18px, gap 16px). Contents differ per trainer (below). Ends with a row: muted note "Standard tuning · E A D G B E · low E drawn on the bottom" and a ghost button "Reset session stats".

**Quiz block** (no gap between the two boxes — they share an edge):
1. **Answer card** (`.card.blueprint`, padding 10px 18px 12px, gap 8px)
   - Top row (min-height 36px, space-between): left group = kicker (`.card-kicker`, 10px uppercase accent), muted 12px key-hint, feedback text (15px/500, colored); right group = ghost "Skip" and, once answered, primary blueprint "Next" with a small keycap ("↵", or "any key" when Pause b/w is on).
   - Body: mode-specific (answer buttons or the Find-it target — see per-trainer).
2. **Fretboard frame** (`.blueprint`, padding 10px 22px 14px, background per theme). Contains the SVG board and a footer row: legend (12px circles/squares + 13px labels) on the left, the **hint button** on the right.
3. **Stats line** under the frame: muted 12px — "Streak 3 · best 7 · 85% of 20 · per-interval breakdown in Settings" (or "No answers yet this session").

**Hint button**: `.btn.btn-primary.blueprint`, min-width 150px, eye icon, label "Hold for hint" (changes to "Intervals from root" / "Note names" while held), keycap "H". Momentary: overlay shows on pointerdown / `H` keydown, hides on pointerup/leave/cancel / keyup. No penalty, not recorded.

---

## Fretboard component

Shared by both trainers. SVG, `viewBox` computed from the window; `width:100%; height:auto`. On phones the frame **scrolls horizontally** (board keeps its 62px fret width; the frame gets `overflow-x:auto`), rather than shrinking.

Geometry (SVG units):
- `FW = 62` fret column width, `SG = 30` string gap, `PAD = 20` left gutter for string labels, `OPENW = 28` width of the open-string column, `TOP = 16`.
- Window `minFret..maxFret` (defaults **0–15**). If `minFret === 0`, the board starts at the nut (fret 1's left edge) and open-string positions get a narrow `OPENW` column left of the nut; the board rect starts at the nut. Fret numbers run from `max(minFret,1)` — **no "0" label**.
- Strings drawn low E (bottom) to high e (top); string labels `E A D G B e` right-aligned at `x = PAD-4`, 11px Barlow. Fret numbers centered under each column, 24px below the board, 11px.
- String stroke widths taper 2.2 → 0.7 from low E to high e.
- Nut: 5px line when `minFret === 0`; other frets 1.2px.
- Inlays: r=6 dots at frets 3, 5, 7, 9, 15, 17, 19, 21 (center), double dots at 12 and 24 (one string gap above/below center).
- Marker dots: r=12 circle, 1.5px stroke, label centered (Barlow Condensed 600, 10–12px).
- Tap targets: one invisible rect per (string, fret) cell, full cell size, `cursor:pointer`, `<title>` "E string, fret 5".

Themes (default **`line`**; `surface` and `steel` were explored and kept as options — see `THEMES` in the prototype logic):

| token | line (default) |
|---|---|
| frame / board fill | transparent (page bg) |
| string | #1d1f20 |
| fret line | rgba(29,31,32,0.28) |
| nut | #1d1f20 |
| inlay | #b7b7ba |
| labels (muted) | rgba(29,31,32,0.6) |
| root dot fill / text | #5980a6 / #f2f2f3 |
| target dot fill / text | #1d1f20 / #f2f2f3 |
| hint dot fill / stroke / text | #d6ebff / #5980a6 / #2c455d |

Status colors (not in the design system; chosen to sit with the steel accent): **green** #3b8a5c (fills), deep green #2b6a45 (feedback text), **red** #b5453f.

---

## Interval Trainer

### Header controls
- Mode: `Name it` | `Find it`
- Direction: `Asc from low` | `Desc from high` | `Random` | `Same string`
- Pause b/w, Settings

### Settings drawer
- **String pairs**: `Adjacent` | `Skip one` | `Skip two` | `Any` (ignored for Same string). Note under it.
- **Fret range**: two number inputs (window shown), min 0–23, max 1–24, kept ≥3 apart.
- **Display**: toggles `Note names` (dots show note names instead of R/?) and `Allow spans over an octave`.
- **Intervals in the pool**: 12 chips `m2 M2 m3 M3 P4 TT P5 m6 M6 m7 M7 P8`, min-width 48px.
- **Session · per interval**: for each pooled interval, label + 5px progress bar (accent on neutral-200) + percent (or "—").

### Question generation
- Tuning fixed: E2 A2 D3 G3 B3 E4 (MIDI 40 45 50 55 59 64).
- Pick a string pair per the pairs setting (gap 1/2/3/any 1–5); Same string uses one string.
- Direction: asc → root on lower string; desc → root on higher; random → coin flip; same string → root is the lower-pitched of two frets.
- **Reach rule:** `|targetFret − rootFret| ≤ 4` (four fingers + one stretch).
- Semitone distance `d`; reject 0 or wrong direction; reject `|d| > 12` unless "Allow spans over an octave".
- **Interval class wraps at the octave**: `cls(d) = ((|d|−1) % 12) + 1` (13 → m2, 24 → P8). Must be in the pool.
- Retry up to 600 times; if nothing fits, show "No question fits these settings — widen the fret range or interval pool."
- Avoid nothing else (repeats allowed).

### Name it
- Board: root dot (accent, label `R` or note name), target dot (dark, label `?` or note name).
- Answer body: one row of equal-width buttons, one per pooled interval, label = interval name (17px Barlow Condensed, clamps down on narrow widths), small keycap top-right. Keys: `1–9 0 − =` map to m2…P8.
- Legend: Root · Interval note.

### Find it
- Board: root dot only; all cells tappable (except cells already marked wrong).
- Answer body: centered — interval name 44px Barlow Condensed in accent, then "minor third **above the root**" (long name + direction, direction muted).
- Correct when `direction matches`, `cls(d) === target`, `|d| ≤ 12` (unless spans allowed), and reach ≤ 4. On success the target dot appears with the interval label.
- Legend: Root · Your answer.

### Answer/feedback rules (both modes, both trainers)
- Wrong answer: button turns **red, disabled** (Name it) / cell gets a red hollow **✕** and stops accepting taps (Find it). Feedback "Not m3 — try again" / "Not that fret — try again" in red. Question stays open.
- Correct: matching button turns **green**; target dot turns green; feedback "Correct — m3, minor third" (+ " (after 2 misses)") in deep green.
- Scoring happens once: on first wrong try → miss; on correct with no prior misses → hit. Streak resets on a miss.
- Auto-advance 1100 ms after correct **unless Pause b/w is on**, in which case wait for Next, Enter/Space, or **any non-modifier key**.
- Skip → next question, unscored.
- Keyboard: `H` hold = hint; `Enter`/`Space` = Next when answered; answer keys as above; ignored when focus is in an input.

### State
```
set:   { mode:'name'|'fret', dir:'asc'|'desc'|'rand'|'same', pairs:'adj'|'skip1'|'skip2'|'any',
         minFret:0, maxFret:15, pool:[1..12], compound:false, noteNames:false, pause:false }
stats: { streak, best, correct, total, per:{ [semis]: {c,t} } }
q:     { root:{s,f}, tgt:{s,f}, semis, up }
picked, correct, answered, wrong:[], hint, drawer
```
Persisted to `localStorage["eminor.intervals.v2"]` as `{ set, stats }`.

---

## Note Trainer

### Header controls
- Mode: `Name it` | `Find on string` | `Find in range`
- Pause b/w, Settings

### Settings drawer
- **Strings in scope**: six toggle chips `E A D G B e` (low E left). Out-of-scope strings and labels draw at 30% opacity; hint dots on them at 50%.
- **Board window**: min/max fret inputs (as above).
- **Target range**: two inputs `from`/`to` (0–24), clamped to the window. Used by Name it and Find in range. Defaults 3–7.
- **Session · per note**: 12 rows (C, C♯/D♭, …).

### Notes & spelling
- 12 pitch classes; buttons and labels show both spellings on one button: `C · C♯/D♭ · D · D♯/E♭ · E · F · F♯/G♭ · G · G♯/A♭ · A · A♯/B♭ · B`. Board dots/hint use the sharp name. Both spellings are always accepted (there is only one button per pitch class). Keys `1–9 0 − =` map C…B.

### Name it
- One dark dot with `?` on an in-scope string within the target range. Answer row = 12 chromatic buttons (16px, clamps down). Avoid repeating the previous pitch class when possible.
- On correct, the dot turns green and shows the note name.

### Find on string
- A random in-scope string is the target; it is drawn **green, 3.5px**. Prompt: note name (44px accent) + "on the A string".
- Correct if the tapped fret is on the target string and matches the pitch class — **any octave in the window**. Found dot turns green with the note name.
- Legend: green square "Target string".

### Find in range
- Green translucent band (#3b8a5c at 22%) over the target range columns, extending half a string gap above/below the board. Full board stays visible.
- Targets = every (in-scope string, fret in range) whose pitch class matches. Prompt: note name + "2 occurrences in frets 3–7".
- Each correct tap adds a green dot; feedback "1 of 2 found". Question completes when **all** are found. Wrong tap → red ✕, keep going.
- Legend: translucent green square "Target range · frets 3–7".

### State
```
set:   { mode:'name'|'string'|'range', strings:[bool×6], minFret:0, maxFret:15, rFrom:3, rTo:7, pause:false }
stats: as above, per keyed by pitch class 0–11
q:     name → {pc,s,f} · string → {pc,s} · range → {pc,targets:[{s,f}]}
found:[], wrong:[], answered, hint, drawer
```
Persisted to `localStorage["eminor.notes.v2"]`.

---

## Design tokens (Industry)

From `design-system/styles.css`; use the variables, not literals.

- Colors: bg #f2f2f3, surface #e9e9ea, text #1d1f20, accent #5980a6, divider = text at 16%. Accent ramp 100–900: #eef6ff #d6ebff #b5d9fd #94bce3 #749dc4 #597ea3 #416180 #2c455d #1d2d3d. Neutral ramp 100–900: #f5f5f8 #e7e7ea #d4d4d7 #b7b7ba #98989b #7a7a7d #5d5d60 #424244 #2b2b2d.
- Type: headings "Barlow Condensed" 600 (h2 32px, h6 13px uppercase 0.08em); body "Barlow" 400 15px/1.55. Google Fonts import is in the stylesheet.
- Spacing scale: 3.4 / 6.8 / 10.2 / 13.6 / 20.4 / 27.2 px (`--space-1..8`).
- Radius: components are square (0) per the blueprint rule; inputs/buttons use 0.
- Blueprint frame: 1px divider border + four 11px `+` corner marks at −6px offsets (`.blueprint > .corner.tl/.tr/.bl/.br`).
- Buttons: `.btn` Barlow Condensed 600 14px, padding 6.8px 12.2px, 1px border; `.btn-primary` accent fill / bg text, hover accent-600, active accent-700; `.btn-secondary` divider border, hover text@7%; `.btn-ghost` accent text, no border.
- Segmented: `.seg` 1px divider border; `.seg-opt` 7px 12px, 13px; checked = accent fill.
- Focus: 2px accent outline, offset 2px. Selection: accent at 30%.
- Icons: Lucide, stroke 1.5.

## Responsive
- Layout is fluid to the preview width; header controls wrap. Below ~700px the fretboard frame scrolls horizontally (board does not shrink). Answer buttons stay on one row and shrink their type (`clamp(13px, 1.6vw, 17px)`; 12–16px for notes).
- Touch: hint button uses pointer capture + `touch-action:none`; tap cells are full string-gap height (30 SVG units ≈ 44px+ on a phone at 62px fret width).

## Assets
No images. Icons are inline Lucide SVGs (`pause`, `sliders-horizontal`, `eye`). Fonts from Google Fonts (Barlow, Barlow Condensed).

## Files
- `prototypes/Interval Trainer.dc.html` — interval trainer prototype (template + logic).
- `prototypes/Note Trainer.dc.html` — note trainer prototype.
- `prototypes/support.js`, `prototypes/_ds/…/styles.css` — runtime and stylesheet needed to open the prototypes locally.
- `design-system/styles.css`, `design-system/industry-readme.md` — the Industry design system tokens and guide.

## Out of scope / later
Chords, Scales, Ear training sections; sound playback; timed mode; adaptive weighting toward weak items; accounts/sync.
