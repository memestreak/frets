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
- **The panel is the list** (Jeremy, 2026-11-06: "remove the chord text
  box and shape chooser from the palette"). This track's chords: the
  Chord set, each chord with a small diagram, its name, how many columns
  use it or ○ "Not used" (Q7), an Edit (pencil) button and, while no
  column uses it, a trash can. Under the list, a + button: Add a
  chord. Picking a chord picks it for Insert (and sounds it, with Hear
  on). Moving the cursor changes nothing in the panel (Jeremy,
  2026-11-06). The list folds from its heading (a 16px chevron, down while
  open), kept across visits in `frets.tab.chordPanel` `{ folded }`, like
  the open panel, not a preference.
- **The Chord dialog** (`ChordDialog.tsx`, a modal): two ways in.
  - **Edit**, from a chord's pencil, or a chord name's Edit (its
    right-click menu, or Enter while picked) or double-click on the tab,
    which also opens the Chords panel with that chord picked and moves the
    cursor to the name's column. Titled "Edit G". The chord's shapes on
    the track's tuning (the Chords page's: open first, then moveable), up
    to twelve, four to a row, plain ink dots (no degree colours, Q9); its
    definition's shape marked, one the Chords page hasn't got first.
    Picking a shape or ‹ › ("2 of 7") chooses it; OK gives the chord's
    definition that shape (`withChordShape`), keeping its `showdiagram`,
    `showname` and `showfingering` (its `firstfret` and `barre` described
    the old shape, so they go; a name with no definition gets one);
    Cancel, Esc or ✕ change nothing.
  - **Add a chord**, from + (Jeremy, 2026-11-06: "a modal chord lookup
    (and creation …) dialog"): a name field and the shapes of the name
    typed, to see and hear. With two or more fretted notes at the cursor,
    "The notes at the cursor are" offers up to four names for them, each
    filling the field (the first is its placeholder), and their fingering
    is the first shape, captioned "At the cursor", shown before a name is
    typed. The first shape is picked until another is, but the fingering
    only while the name typed is none, isn't a chord, or is a chord of its
    notes: under "Dsus2" it stays, unpicked, after Dsus2's first shape. "Add G" (or Enter)
    puts the name in the set with the shape picked (`withNewChord`), or
    with none for a name that isn't a chord ("Riff A"), picks it for
    Insert, and leaves the columns as they were. A name already in the set
    can't be added again ("“G” is already in this track’s chords"; no Add).
    Cancel, Esc or ✕ add nothing. This is the way to create a chord from a
    fingering (asked 2026-11-05) until drawing one (#368).
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
  context action … only show the trash can if the chord isn't used"): the
  trash can takes every definition of that name out of the set
  (`withoutChord`). Nothing stays picked after.
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
  the chord, its shapes shown and the current one marked. Since
  2026-11-06 that is the Chord dialog, over the Chords panel.

Settled while building (my calls, open to change):

- Insert works only with the cursor in the tab, as the palette's tools.
- Insert Notes leaves the column's name as it was.
- The `C` key still opens the chord name field, the way to change a
  column's name; keys for the panel wait for the open question on keys
  (Q2 of the mock round).
- Edit's shape is staged: nothing changes until OK, as in Settings.

## How

- `TabRail.tsx`: `PanelId` gains `chords`; the Chords button after the
  tool panels; the open panel is lifted to the page (`useOpenPanel`) so
  Edit can open it; `parseLayout` reads `chords`.
- `playback.ts`: `shapeAlone`, `Player.hearShape`; `PlaybackFooter.tsx`:
  `hearShape`, and `hearChords` in the Playback settings; `tabSettings.tsx`
  lists it.
- `ChordPanel.tsx`: the panel; `Fold`, `parseChordPanel`,
  `HearChordsToggle` (which `TabRail` shows in the panel's head through
  `chordsHead`), `insertedColumn`.
- `ChordDialog.tsx`: the Chord dialog, Edit and Add, on `Modal`.
- `chordShapes.ts`: `chordOfName`, `shapesOf`, `shapeFor`, `toFrets`,
  `toShape`, `PLAIN_LOOK`, shared by the two; `namesForColumn` and
  `fretsOfColumn`, for Add.
- `chordSet.ts`: `withChordShape`, `withNewChord`, `withoutChord`.
- Diagrams (list and dialog) are drawn with the chord the name means
  when the shape's notes are its tones, else with one its notes are
  (`chordToDraw`), so "My C" with the C shape has its diagram; none for
  no chord at all.
- `TabPage.tsx`: a chord name's Edit and double-click call
  `openChordsAt`.
- `tab.css`: the panel's look.

## Later

- Drawing your own shape; renaming and deleting chords in the list
  (#368).
- Diagrams over names and in exports (#242).
- Keys for the panel.
- Deleting a chord a column uses (with its names).

## Tests

- The panel has the list, + and Insert: no name field, no shapes; each
  chord has Edit; its uses, or ○ for an unused one.
- A chord name's Edit, its Enter and its double-click open the Chords
  panel and that chord's dialog, the stored shape marked; not note input.
- A list chord's Edit opens its dialog; Next shape then OK changes the
  definition, keeping `showname`, the others untouched; without OK
  nothing changes; Cancel after picking a shape changes nothing.
- + opens Add: "Type a chord name" first, no names, no Add; "Dsus2" shows
  x-x-0-2-3-0, picked; Add Dsus2 defines `0 3 2 0 x x`, unused and
  picked for Insert, no column changed. Another shape picked is the one
  added; Enter adds. "N.C." isn't a chord; "Riff A" is added with no
  shape. "G", already in the set, has no Add and Enter adds nothing.
  With the cursor on the C column: placeholder "C", its fingering
  x-3-2-0-1-0 "at the cursor" picked before a name is typed; the name C
  fills the field; under "Dsus2" it is drawn but not picked; "My C" is
  added as `0 1 0 2 3 x` and has a diagram in the list. Cancel and ✕ add
  nothing.
- `withNewChord`: a definition at the end, with frets or with none; a
  name already defined is left as it is.
- `namesForFrets` counts from the capo (the C shape is C at capo 2);
  `fretsOfColumn` needs two fretted notes; `chordToDraw` falls back to
  what the notes are, and gives none for one note.
- `withChordShape`: the last definition of the name changes; show props
  kept, `firstfret` and `barre` dropped; a name with none gets one at the
  end; "AM" is not "Am".
- With a chord picked, moving the cursor leaves the panel exactly as it
  was.
- Insert Name, Notes and Both each write what they say at the cursor.
- `parseLayout` reads `chords`.
- `shapeAlone`: nothing for no strings; a quarter at 120 bpm, strummed
  down. `parsePlaybackSettings` reads `hearChords`, false by default.
- The list folds, kept; `parseChordPanel` drops ids it doesn't know.
- Hear is off at first, in the panel's head; its toggle turns it on and
  saves `hearChords`.
- An unused chord's trash can takes its definition out and leaves nothing
  picked; a used chord has no trash can.
