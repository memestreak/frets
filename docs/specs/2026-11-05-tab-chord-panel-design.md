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
  the name's column. The rail's Chords button opens it with no chord
  picked.
- **Order and folding** (Jeremy, 2026-11-05: "This track's chords should
  be at the top … That section and other sections should be independently
  collapsible"). Top to bottom: This track's chords, the Chord field,
  Shape, Insert. Each of the two sections folds from
  its heading (a 16px chevron, pointing down while open, and its name,
  `aria-expanded`), on its own; the shape stepper at Shape's right
  ("1 of 9") shows only while Shape is open (Jeremy, 2026-11-06).
  Which are folded is kept across visits in `frets.tab.chordPanel`
  `{ folded }`, like the open panel, not a preference. The field and
  Insert don't fold: they are the panel's controls.
- **Chord.** The name field shows the chord being looked at: the one
  picked in the panel, else the one Edit opened, else none ("Pick a chord
  to see its shapes"). Moving the cursor changes nothing in the panel
  (Jeremy, 2026-11-06: clicking between bars changing what it showed was
  unexpected). Typing a name and Enter writes it over the cursor column, as
  the old field did, and the keys go back to the tab.
- **Shape.** The chord's shapes on the track's tuning (the Chords page's
  shapes: open first, then moveable), up to nine diagrams, plain ink dots
  (no degree colours, Q9). The definition's shape is marked; one the
  Chords page hasn't got shows first. Picking a shape, or ‹ › ("2 of 7"),
  gives the chord's definition that shape (`withChordShape`), keeping its
  `showdiagram`, `showname` and `showfingering`; its `firstfret` and
  `barre` described the old shape, so they go. A name with no definition
  gets one.
- **This track's chords.** The Chord set: a small diagram, the name, and
  how many columns use it, or ○ "Not used" (Q7). Picking one looks at it.
- **Insert** Name | Notes | Both (Both by default; Q6): writes the chord
  over the cursor column, its shape as the column's notes, or both, as one
  column (strummed by its notes, not a stroke). A name inserted with no
  definition gets one with the shape it was inserted with.
- **Hear** (Jeremy, 2026-11-05: "a small toggle in the chord panel that
  enables playback when a chord is clicked on"; 2026-11-06: "at the top to
  the right of the Chords label"). A small speaker toggle in the panel's
  head, right of its title, off at first. While on, picking a chord or a shape sounds its
  shape, strummed down, a quarter at 120 bpm, with the track's sound
  (`shapeAlone`, `Player.hearShape`). It is a Playback preference
  (`hearChords` in `frets.tab.playback`), listed in Settings as "Hear
  chords picked in the Chords panel".
- **Delete** (Jeremy, 2026-11-06: "a little trash can rather than a
  context action … only show the trash can if the chord isn't used"). A
  chord no column uses has a small trash can at its right in the list,
  which takes every definition of that name out of the set
  (`withoutChord`); one in use has none. Nothing stays picked after.
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
- `playback.ts`: `shapeAlone`, `Player.hearShape`; `PlaybackFooter.tsx`:
  `hearShape`, and `hearChords` in the Playback settings; `tabSettings.tsx`
  lists it.
- `ChordPanel.tsx`: the panel; `Fold`, `parseChordPanel`,
  `HearChordsToggle` (which `TabRail` shows in the panel's head through
  `chordsHead`); `chordOfName`, `insertedColumn`.
- `chordSet.ts`: `withChordShape`, `withoutChord`.
- `TabPage.tsx`: a chord name's Edit and double-click call
  `openChordsAt`.
- `tab.css`: the panel's look.

## Later

- Drawing your own shape; renaming and deleting chords in the list
  (#368).
- Diagrams over names and in exports (#242).
- Keys for the panel.
- Naming the cursor column's notes ("These notes are"), with New chord
  from a name or the column's fingering: the next PR
  (Jeremy, 2026-11-06).
- Deleting a chord a column uses (with its names).

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
- With a chord picked, moving the cursor leaves the panel exactly as it
  was; with none, the field is empty and Shape says to pick one.
- Insert Name, Notes and Both each write what they say at the cursor.
- `parseLayout` reads `chords`.
- `shapeAlone`: nothing for no strings; a quarter at 120 bpm, strummed
  down. `parsePlaybackSettings` reads `hearChords`, false by default.
- The list is first, above the field; each section folds on its own;
  the folded ones are kept, and `parseChordPanel`
  drops ids it doesn't know.
- Hear is off at first, in the panel's head; its toggle turns it on and
  saves `hearChords`.
- An unused chord's trash can takes its definition out and leaves nothing
  picked; a used chord has no trash can.
