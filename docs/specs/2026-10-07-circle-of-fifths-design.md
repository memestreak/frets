# Circle of fifths

Jeremy, 2026-10-07: a page that teaches with the circle of fifths. Of five
mocked options (https://claude.ai/artifact/6Xgs8gnjJ8k1XucpEgT157) he
wants the **Key wheel** (A) and **Modes** (E) for now, on **one page**
with a **Key | Mode** switch. Modulation planning, the wheel-and-neck view
and the progression tracer are later slices.

Jeremy, 2026-10-09: the views are **Circle | Advanced**. The Circle is
the conventional circle of fifths (the Key view), its wheel large on its
own row; Advanced holds the mode features, beside the wheel on wide
screens.

## Page

`/explore/circle`, in Explore after the Scale lab. The view is in the URL:
`?view=advanced` for Advanced, nothing (or anything else) for the Circle, so either view
can be linked. Nothing else is in the URL or saved: the page opens on
C major, and on C Dorian in Advanced view.

- Header: the title (`C major`, `A minor`, `C Dorian`) and the Circle | Advanced
  `Segmented` on its line. Advanced view shows the mode's formula under the
  title, like the Scale lab (`1 2 ♭3 4 5 6 ♭7`).
- A row of checkboxes, all off by default: **Key signatures**, **All
  numerals**, and in Circle view **Parallel key** and **Secondary dominants**.
  Advanced view keeps those two in place but invisible, so the row (and what
  is below it) doesn't move when the view changes.
- The wheel, then the sections for the view. In the Circle the wheel is
  on its own full-width row, as large as fits (up to 600px for the rings),
  with its sections below. In Advanced, from 1000px wide, the wheel and
  the Parallel modes table sit side by side, so a pick and what it changes
  are both in view (Jeremy, 2026-10-08); narrower, they stack.
- Switching views keeps the root: C major becomes C Ionian, A minor
  A Aeolian; going back, Aeolian becomes a minor key and every other mode
  the major key on its root.

## The wheel

- Fixed: C at the top, never rotated (Jeremy). Outer ring the twelve major
  keys clockwise in fifths, middle ring their relative minors, inner ring
  each major key's vii°. Spoke 6 is F♯ / D♯m / E♯°.
- Cells are filled with the app's degree colours (`DEGREES` in
  `fretboard/theme.ts`, `--degree-*` and `--on-degree-*`) by the degree of
  the chord's root, and nothing else on the page uses those colours.
  Chords outside the key or mode get a dashed border in their degree colour
  instead of a fill. Rings marking something (the selected key's tonic,
  a mode's signature chord, a V/x) are ink.
- Each coloured cell shows its numeral under its name. Numerals count
  against the major scale on the tonic, as in the Scale lab: A minor is
  i ii° ♭III iv v ♭VI ♭VII.
- **All numerals** puts a numeral on every other cell too, named by the
  plainest degree: natural, else flat (E in C is III, G♭ is ♭V).
- **Key signatures** draws a small treble staff outside each spoke with
  its sharps or flats in order; no counts. The staff of the current key
  (in Advanced view, the key whose notes the mode uses) is drawn darker.
- Clicking or tapping shows no blue: no tap flash, no focus outline after
  a click, no text selection. Keyboard focus shows an ink ring.

- **Ring of notes** (2026-10-08), Advanced view only, round the outside: each spoke's note. A
  major scale is seven neighbouring spokes, from the one before its key
  to five after it; the key's or mode's seven notes are lit on a sunken
  band, outlined as one run, and spelled as it spells them. The root is
  an ink pin. The Circle has no ring (Jeremy, 2026-10-09), so its rings of
  chords get that room.
- Coloured cells show the chord as the key or mode spells it (F♯ Lydian's
  V is C♯, though the outer ring calls that spoke D♭).

## Hover tips

Anything not obvious explains itself in a tip after the pointer rests on
it for one second (mouse only), or when it gets keyboard focus: each
coloured cell (e.g. in D, Bm is vi and the tonic of B minor, D's relative
minor; C♯° is built on the leading tone), borrowed chords, the minor
key's major V, secondary dominants and their arrows, each key signature
(its sharps or flats), the ring's lit notes in Advanced view, the Parallel modes rows and their chords.
No text on the page appears or disappears as the selection changes; that
kind of explanation goes in a tip. Touch screens get no tips yet.

## Circle view

- Tap an outer cell for that major key, a middle cell for that minor key.
- **Chords**: the seven diatonic chords as degree-coloured chips, spelled
  in the key (F♯ major's vii° is E♯°). A minor key adds its major V
  (harmonic minor) as a dashed chip, and the cell gets a dashed border.
- **Parallel key** shows the parallel key's chords that aren't in the key
  as dashed cells, numbered against the tonic (♭VI, iv…), and lists them
  under "Borrowed from C minor".
- **Secondary dominants** marks the V of each chord except the tonic and
  vii° with an ink dashed ring and lists them as chips (V/ii A7…). Arrows
  are drawn only on hover or focus (Jeremy, 2026-10-09: five permanent
  arrows were too busy): hovering a secondary dominant, the chord it
  resolves to, or its chip draws that arrow and turns the dominant's ring
  solid.

## Advanced view

Reworked 2026-10-08 after a review
(/mnt/project-files/circle-of-fifths/review/evaluation.md); Jeremy picked
the Notes ring and the chord table from
https://claude.ai/artifact/77Fh6v7USv19keJL7Xemsq.

- Tap an outer cell to make its note the root; the mode stays.
- **Spelling.** A mode's notes are a major key's (its parent), so it is
  spelled as that key: no double flats. The root keeps its name where the
  parent's other spelling allows it (F♯ Lydian uses C♯ major, F Locrian
  G♭ major); otherwise it takes the parent's name for it: D♭ Locrian uses
  D major's notes, so it is C♯ Locrian.
- The coloured wedge is the parent key's seven chords, numbered and
  coloured from the mode's root (C Dorian: i ii ♭III IV v vi° ♭VII). The
  root chord and the mode's signature chord are ringed: Lydian II,
  Mixolydian ♭VII, Dorian IV, Aeolian ♭VI, Phrygian ♭II, Locrian ♭V
  (Ionian has none).
- **Relative modes are on the ring.** Each lit note has the name of the
  mode that starts on it written along the ring; they run Lydian to
  Locrian clockwise, the bright-to-dark order. Tapping a lit note makes it
  the root: the lit run stays, only the pin moves.
- **Parallel modes: same root, other notes**, beside the wheel: one row
  per mode on the root, brightest first, each as its seven chords (numeral
  over name). The current row is in degree colours; elsewhere a chord the
  current mode also has is plain and muted, and one it lacks has a dashed
  border in its degree colour, a chord to borrow (modal interchange). A
  Swap column names the note each row has instead of the row above's
  (B → B♭). Hovering or focusing a row outlines, dashed, the run it would
  light; clicking picks it. On phones the root before each mode and the
  Swap column are dropped so the table fits.
- No rim names, relative-mode cells or chord chips: the ring and the
  table carry them.
- Nothing changes size or position as the selection changes: fixed
  column widths and border thickness (Jeremy).

## Parts

- `features/explore/circle/circle.ts`: pure. Spokes, cells and their
  roots, key signatures, numerals against a tonic, and the two views'
  models (`keyWheel`, `modeWheel`): what each cell shows, arrows, chips,
  tips. Spelling comes from `scales/theory.ts`, still the section's only
  tonal import.
- `CircleWheel.tsx`: draws a model (cells, arrows, the ring of notes
  with its run, pin and mode names, staves); knows no theory.
- `HoverTips.tsx`: the one-second tip for anything with `data-tip`.
- `KeyPanel.tsx`, `ModePanel.tsx`: the sections beside or under the wheel.
- `CircleOfFifths.tsx`: the page; reads the view from the URL and owns
  the state. Client-only loader, like the Chord library.

Later slices: Modulate (from/to keys, pivot chords, path, new V7), the
neck under the wheel, the progression tracer, long-press tips on touch,
links from chords to the Chord library and keys to the Scale lab.
