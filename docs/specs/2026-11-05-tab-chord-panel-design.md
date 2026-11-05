# Tab: the Chords panel

Issue [#251](https://github.com/memestreak/frets/issues/251), step 2 of
the chords-in-Tab build order (planning doc
https://claude.ai/artifact/R4ffGZLV63TiViD2Hj3mr5). Builds on the Chord
set (`2026-11-05-tab-chord-set-design.md`, #367). Drawing your own shape
and editing the list (rename, delete) are #368.

## What

- **A fourth rail panel, Chords**, after Notes, Articulations and Bars
  (`2026-11-02-tab-rail-design.md`): one open at a time, kept in
  `frets.tab.layout` like the others. Jeremy picked this layout (mock a)
  over a panel of its own on the left (b) and a popover (c) on
  2026-11-05.
- **Opening it at a chord.** A chord name's Edit (its right-click menu,
  or Enter while it is picked) and its double-click open the Chords panel
  at that chord, in place of the old chord name field. The cursor goes to
  the name's column. The rail's Chords button opens it at the cursor
  column's chord.
- **Chord.** The name field shows the chord being looked at: the one
  picked in the panel, else the one Edit opened, else the cursor
  column's. Typing a name and Enter writes it over the cursor column, as
  the old field did, and the keys go back to the tab.
- **Shape.** The chord's shapes on the track's tuning (the Chords page's
  shapes: open first, then moveable), up to nine diagrams, plain ink dots
  (no degree colours, Q9). The definition's shape is marked; one the
  Chords page hasn't got shows first. Picking a shape, or ‹ › ("2 of 7"),
  gives the chord's definition that shape (`withChordShape`), keeping its
  `showdiagram`, `showname` and `showfingering`; its `firstfret` and
  `barre` described the old shape, so they go. A name with no definition
  gets one.
- **These notes are.** The best four names `nameNotes` gives the cursor
  column's notes (two or more). Picking one writes it over the column.
- **This track's chords.** The Chord set: a small diagram, the name, and
  how many columns use it, or ○ "Not used" (Q7). Picking one looks at it.
- **New chord** (Jeremy, 2026-11-05: "we'll need a way to define a new
  chord"). "+ New chord" turns the field into "New chord"; a name and
  Enter adds a definition to the set with the chord's first shape
  (`withNewChord`), or with no strings for a name that isn't a chord.
  Nothing is written over a column; the new chord is unused until
  inserted. A name already defined is left as it is. Escape, or leaving
  the field, cancels.
- **Insert** Name | Notes | Both (Both by default; Q6): writes the chord
  over the cursor column, its shape as the column's notes, or both, as one
  column (strummed by its notes, not a stroke). A name inserted with no
  definition gets one with the shape it was inserted with.
- Presses on the panel's buttons keep the tab's focus and cursor, as the
  palette's do.

## Decided

From the evaluation (https://claude.ai/artifact/Ws7FyE8hxitmqvU7kj7hUa)
and the mocks:

- Q5: a side panel, on the left (the rail's).
- Q6: Insert offers name, notes or both.
- Q7: unused chords stay in the list, marked ○.
- Q9: no degree colours.
- Jeremy (relayed 2026-11-05): a chord name's Edit or double-click opens
  the panel at that chord, its shapes shown and the current one marked;
  all name and shape editing is in the panel.

Settled while building (my calls, open to change):

- Insert works only with the cursor in the tab, as the palette's tools.
- Insert Notes leaves the column's name as it was.
- The `C` key still opens the chord name field; keys for the panel wait
  for the open question on keys (Q2 of the mock round).

## How

- `TabRail.tsx`: `PanelId` gains `chords`; the Chords button after the
  tool panels; the open panel is lifted to the page (`useOpenPanel`) so
  Edit can open it; `parseLayout` reads `chords`.
- `ChordPanel.tsx`: the panel; `chordOfName`, `namesForColumn`,
  `insertedColumn`.
- `chordSet.ts`: `withChordShape`, `withNewChord`.
- `TabPage.tsx`: a chord name's Edit and double-click call
  `openChordsAt`.
- `tab.css`: the panel's look.

## Later

- Drawing your own shape; renaming and deleting chords in the list
  (#368).
- Diagrams over names and in exports (#242).
- Keys for the panel.
- Hearing a chord or shape when it is picked: Jeremy, 2026-11-05, "Do
  not play back the chord on click (yet)". The evaluation's "hear chord
  yes" waits for a later step.

## Tests

- A chord name's Edit, its Enter and its double-click open Chords at that
  chord, the stored shape marked; not note input.
- The list shows each chord's uses, ○ for an unused one.
- Next shape changes the definition, keeping `showname`; the other
  definitions are untouched.
- Picking a shape marks it.
- `withChordShape`: the last definition of the name changes; show props
  kept, `firstfret` and `barre` dropped; a name with none gets one at the
  end; "AM" is not "Am".
- New chord: "Dsus2" adds `\chord ("Dsus2" 0 3 2 0 x x)`, unused, and no
  column changes; "Riff A" adds `\chord ("Riff A")` with no shapes; a
  name already defined is left as it is; Escape adds nothing.
- These notes are: a C column offers "C"; picking it writes `ch "C"`.
- Insert Name, Notes and Both each write what they say at the cursor.
- `parseLayout` reads `chords`.
