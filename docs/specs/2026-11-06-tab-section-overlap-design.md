# Tab: a long section name moves clear of the next (issue #389)

A section's name is drawn in bold at its bar's start, on one row, and the
layout never made room for it. On short bars, a long name ran into the next
section's and the two overprinted (issue #389, the annotated demo of
PR #387: five one-row bars, each with a long `\section` name). Widening the
window only hid it.

## What other programs do

- **Dorico:** rehearsal marks and system text never widen a bar. When two
  collide, the later one moves up, away from the staff (collision
  avoidance), and the staff below makes room.
- **MuseScore:** automatic placement does the same: a rehearsal mark or
  text that would collide is pushed up, away from the staff, by at least
  its minimum distance. Measure widths don't change.
- **Guitar Pro 8:** not confirmed. Its section marks are short by habit
  ("A", "Intro"), and its documentation says nothing about long ones.

Frets' free Text already does the Dorico thing after wrapping
(`2026-11-03-tab-text-wrap-design.md`): one that still touches the one
before moves up a level.

## Choice

MOCK, until Jeremy picks (`?mock=a|b|c`):

- **A (the default): move up a row.** A section that a name before it runs
  into moves up a row, as Dorico and MuseScore move it. Names never wrap,
  and the music doesn't move.
- **B: wrap, then move up.** As the Text does: a name first wraps to the
  room before the next section (never to less than 100px), then moves up
  if it still touches.
- **C: widen the bar.** A bar is at least as wide as its section's name,
  as a chord name widens its column. The names stay on one row and the
  music spreads out.

## What is drawn (A, and B's stacking)

- A section reaches from its bar's text start (4px inside the opening
  line), over its rehearsal mark's box if it has one, to its name's end,
  plus 12px (`SECTION_GAP`) of room before the next.
- Left to right, each section takes the lowest row where it clears the
  sections already there (`placeSections`, by the same rule as the Text's,
  `stackWords`). A later section that clears the row by the music goes back
  down to it.
- A row is 21px (`SECTION_LINE`) under the one before, so a boxed mark
  clears the one over it. The section row's top stays where it was: the
  rows over it (capo, tempo) don't move; each extra row pushes everything
  under it down (endings, chord names, Text, the staff, the tab). Only the
  line (system) holding them grows.
- Each section sits on its row's bottom, next to the music, as a Text does.
- A rehearsal mark's box moves with its name.

## Picking and editing

- A press on a moved-up section picks it; its blue box and right-click
  menu are where it is drawn.
- Its field (double-click, or Edit) opens over where it is drawn.

## Exports

PNG and SVG are drawn by the same code. MusicXML and Guitar Pro keep a
section as it is; the program that opens them lays it out.

## How

- `stackWords.ts`: the shared rule, `stackWords`, that the Text's
  `placeBeatTexts` (`beatText.ts`) and `placeSections` both call.
- `sectionText.ts`: the section's size and measuring (moved from
  `layoutText.ts`), `placeSections`, and while the mock is up,
  `setSectionFit`.
- `layout.ts`: `layoutClip` places each line's sections once its bars are
  placed (`PlacedBar.sectionLines`, `sectionTop`, `System.sectionRows`);
  `rowsFor` grows the section row; mock C widens the bar.
- `layoutText.ts`: `sectionBox`, used by `textBox` and `textAt`.
- `TabClip.tsx`: draws each section on its row, a `<tspan>` per line.
- `fieldSpots.ts`: the section's field opens over its row.
- The built-in arrangement `song_structure/long-sections.atex` shows it.

## Tests

`src/__tests__/tab/sections.test.ts`:

- Sections that clear each other stay on one row.
- A section that a name before it runs into moves up a row; the long one
  stays by the music.
- 12px is kept after a name: a section 1px closer moves up.
- A rehearsal mark's box counts: a name that clears without its box
  doesn't with it.
- A later section that clears the row by the music goes back down to it.
- Names never wrap, except in mock B, where a name wraps to the room
  before the next and never to less than 100px.
- Issue #389's clip: five bars on one line, and no two sections on one row
  overlap.
- Short names (Intro, Verse, Chorus) keep one row, as before.
- Each extra section row pushes the staff down 21px; the tempo and section
  rows don't move.
- A press on a moved-up section picks it, and its box is centred on its
  row; its field opens one row (21px) higher than the one under it.
- Mock C: each bar is at least as wide as its section reaches, and the
  names share one row.
