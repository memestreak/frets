# Tab: a long section name wraps, and moves clear of the next (issue #389)

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

Jeremy picked (2026-11-06) the Text's way, out of three mocks: wrap, then
move up. The others were moving up alone (Dorico's and MuseScore's way,
never wrapping) and widening the bar to fit the name, as a chord name
widens its column. Sections and Text now make room by one rule.

## What is drawn

- A section reaches from its bar's text start (4px inside the opening
  line), over its rehearsal mark's box if it has one, to its name's end,
  plus 12px (`SECTION_GAP`) of room before the next.
- A name wider than the room before the next section on its line (or the
  drawing's right edge) breaks at its spaces into lines, each as long as
  fits. The room is never less than 100px (`SECTION_MIN_ROOM`), so a name
  over a short bar isn't a word a line. A word is never split. The words
  are drawn as typed.
- A name that, wrapped, still reaches into the next section (one word
  wider than the room, or a bar under 100px) moves the next section up a
  level, away from the music. Each section takes the lowest level where it
  clears the sections already there; a later one that clears goes back
  down. Then each wraps again to the room before the next section on its
  own level, so one moved up makes room for the one under it
  (`placeSections`, by the Text's rule, `stackWords`).
- Section rows are 21px (`SECTION_LINE`) apart, so a boxed mark clears the
  one over it. A level is as tall as its tallest name, and each section
  sits on its level's bottom row, next to the music, as a Text does. Only
  the first line has the rehearsal mark's box in front of it.
- The section row's top stays where it was: the row over it (tempo)
  doesn't move; each extra row pushes everything under it down (endings,
  chord names, Text, the staff, the tab). Only the line (system) holding
  them grows.

## Picking and editing

- A press on a moved-up section picks it; its blue box and right-click
  menu are where it is drawn.
- A press on any line of a wrapped section picks it; its box covers every
  line.
- Its field (double-click, or Edit) opens over where its first line is
  drawn.

## Exports

PNG and SVG are drawn by the same code. MusicXML and Guitar Pro keep a
section as it is; the program that opens them lays it out.

## How

- `stackWords.ts`: the shared rule, `stackWords`, that the Text's
  `placeBeatTexts` (`beatText.ts`) and `placeSections` both call.
- `sectionText.ts`: the section's size and measuring (moved from
  `layoutText.ts`) and `placeSections`.
- `layout.ts`: `layoutClip` places each line's sections once its bars are
  placed (`PlacedBar.sectionLines`, `sectionTop`, `System.sectionRows`);
  `rowsFor` grows the section row.
- `layoutText.ts`: `sectionBox`, used by `textBox` and `textAt`.
- `TabClip.tsx`: draws each section on its row, a `<tspan>` per line.
- `fieldSpots.ts`: the section's field opens over its row.
- The built-in arrangement `song_structure/long-sections.atex` shows it.

## Tests

`src/__tests__/tab/sections.test.ts`:

- Sections that clear each other stay on one row.
- A long name wraps to the room before the next section, each line no
  wider than that room, joined back as typed; the next section stays by
  the music, on the long one's last row.
- A name never wraps to less than 100px: one that then still reaches the
  next moves that one up a row, and, moved clear, keeps one line.
- A single word wider than the room before the next isn't split; the next
  moves up.
- 12px is kept after a name: a section 1px closer moves up.
- A rehearsal mark's box counts: a name that clears without its box
  doesn't with it.
- A later section that clears the row by the music goes back down to it.
- Issue #389's clip: five bars on one line, and no two sections that share
  a row overlap.
- Short names (Intro, Verse, Chorus) keep one row, as before.
- Each extra section row pushes the staff down 21px; the tempo and section
  rows don't move.
- A press on a moved-up section picks it, a press on the row under it
  picks the section there, and its box is centred on its row.
- A moved-up section's field opens one row (21px) higher than the field of
  the one under it.
