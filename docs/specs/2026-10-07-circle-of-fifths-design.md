# Circle of fifths

Jeremy, 2026-10-07: a page that teaches with the circle of fifths. Of five
mocked options (https://claude.ai/artifact/6Xgs8gnjJ8k1XucpEgT157) he
wants the **Key wheel** (A) and **Modes** (E) for now, on **one page**
with a **Key | Mode** switch. Modulation planning, the wheel-and-neck view
and the progression tracer are later slices.

## Page

`/explore/circle`, in Explore after the Scale lab. The view is in the URL:
`?view=mode` for Mode, nothing (or anything else) for Key, so either view
can be linked. Nothing else is in the URL or saved: the page opens on
C major, and on C Dorian in Mode view.

- Header: the title (`C major`, `A minor`, `C Dorian`) and the Key | Mode
  `Segmented` on its line. Mode view shows the mode's formula under the
  title, like the Scale lab (`1 2 ♭3 4 5 6 ♭7`).
- A row of checkboxes, all off by default: **Key signatures**, **All
  numerals**, and in Key view **Parallel key** and **Secondary dominants**.
  Mode view keeps those two in place but invisible, so the row (and what
  is below it) doesn't move when the view changes.
- The wheel on its own full-width row, as large as fits (up to about
  560px for the rings), then the sections for the view, each full width.
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
  (in Mode view, the key whose notes the mode uses) is drawn darker.
- Clicking or tapping shows no blue: no tap flash, no focus outline after
  a click, no text selection. Keyboard focus shows an ink ring.

## Hover tips

Anything not obvious explains itself in a tip after the pointer rests on
it for one second (mouse only), or when it gets keyboard focus: each
coloured cell (e.g. in D, Bm is vi and the tonic of B minor, D's relative
minor; C♯° is built on the leading tone), borrowed chords, the minor
key's major V, secondary dominants and their arrows, each key signature
(its sharps or flats), mode names on the rim and the relative-mode cells.
No text on the page appears or disappears as the selection changes; that
kind of explanation goes in a tip. Touch screens get no tips yet.

## Key view

- Tap an outer cell for that major key, a middle cell for that minor key.
- **Chords**: the seven diatonic chords as degree-coloured chips, spelled
  in the key (F♯ major's vii° is E♯°). A minor key adds its major V
  (harmonic minor) as a dashed chip, and the cell gets a dashed border.
- **Parallel key** shows the parallel key's chords that aren't in the key
  as dashed cells, numbered against the tonic (♭VI, iv…), and lists them
  under "Borrowed from C minor".
- **Secondary dominants** marks the V of each chord except the tonic and
  vii° with an ink dashed ring, draws an arrow from it to the chord it
  resolves to, and lists them as chips (V/ii A7…).

## Mode view

- Tap an outer cell to make its note the root; the mode stays.
- Pick a mode by a row of the Parallel modes table or a mode name on the
  rim. The names sit on the seven spokes whose notes each mode on this
  root uses (C Lydian on G, C Dorian on B♭), brightest clockwise.
- The coloured wedge is the parent key's seven chords, numbered and
  coloured from the mode's root (C Dorian: i ii ♭III IV v vi° ♭VII). The
  root chord and the mode's signature chord are ringed: Lydian II,
  Mixolydian ♭VII, Dorian IV, Aeolian ♭VI, Phrygian ♭II, Locrian ♭V
  (Ionian has none).
- **Chords**: the seven chords as chips, ringed the same way.
- **Relative modes: same notes, other roots**: seven equal cells in the
  parent key's order, Ionian first (`B♭ Ionian`, `C Dorian`,
  `D Phrygian`…); clicking one keeps the notes and moves the root. The
  current one is outlined; the order never changes, so only the outline
  moves (Jeremy, 2026-10-08).
- **Parallel modes: same root, other notes**: one row per mode on the
  root, brightest first, with its formula and whose notes it uses
  ("B♭ major's notes"). The note each row flattens from the row above is
  marked; the current row is outlined; clicking a row picks it.
- Nothing in these widgets changes size or position as the selection
  changes: fixed cell widths and border thickness (Jeremy).

## Parts

- `features/explore/circle/circle.ts`: pure. Spokes, cells and their
  roots, key signatures, numerals against a tonic, and the two views'
  models (`keyWheel`, `modeWheel`): what each cell shows, arrows, chips,
  tips. Spelling comes from `scales/theory.ts`, still the section's only
  tonal import.
- `CircleWheel.tsx`: draws a model (cells, arrows, rim labels, staves);
  knows no theory.
- `HoverTips.tsx`: the one-second tip for anything with `data-tip`.
- `KeyPanel.tsx`, `ModePanel.tsx`: the sections under the wheel.
- `CircleOfFifths.tsx`: the page; reads the view from the URL and owns
  the state. Client-only loader, like the Chord library.

Later slices: Modulate (from/to keys, pivot chords, path, new V7), the
neck under the wheel, the progression tracer, long-press tips on touch,
links from chords to the Chord library and keys to the Scale lab.
