# Tab: the Chords panel

Issue [#251](https://github.com/memestreak/frets/issues/251), step 2 of
the chords-in-Tab build order (planning doc
https://claude.ai/artifact/R4ffGZLV63TiViD2Hj3mr5). Builds on the Chord
set (`2026-11-05-tab-chord-set-design.md`, #367). The chord editor
(2026-11-06, PR #395) also draws your own shape and renames a chord,
part of #368. Issue [#400](https://github.com/memestreak/frets/issues/400)
(PR #401, 2026-11-07) reworked the list into tiles, split editing a chord
from defining one, and moved Edit and Delete into a right-click menu; the
mocks and Jeremy's calls are in https://claude.ai/artifact/WTMhNDkupjYQqnTwMUTM9W
and the Penpot page "Tab Chords panel (issue 400)".

## What

- **A fourth rail panel, Chords**, after Notes, Articulations and Bars
  (`2026-11-02-tab-rail-design.md`): one open at a time, kept in
  `frets.tab.layout` like the others. Jeremy picked this layout (mock a)
  over a panel of its own on the left (b) and a popover (c) on
  2026-11-05.
- **The Chord set** (Jeremy, 2026-11-07: it was "This track's chords"):
  the panel's first section, its chords as tiles, each its name over its
  diagram, two rows to a page (Jeremy, 2026-11-07: less room than a list):
  four to a row at the panel's first width, and as many as fit when the
  panel is widened or narrowed, so a wider panel uses fewer rows rather than
  spacing four apart (Jeremy, 2026-11-08, issue #431;
  `2026-11-08-tab-rail-width-design.md`). Under them ‹ "1 / 2" › page through them, shown only with
  more than one page; a short last page keeps a full page's room, so
  nothing below moves. A small solid dot on the bottom right corner of
  each tile's diagram, just over it, says how many times the chord is used
  ("99+" past 99); a chord no column uses has none, and nothing else marks
  it (Jeremy, 2026-11-09: it was tinted; dot b of four mocks). Hovering a
  tile says "Used 3 times" or "Not used". No icons on the tiles: a press picks
  a chord for Insert (and sounds it, with Hear on) and nothing more; a
  double-click opens Edit chord; a right-click (or a long press, or
  Shift+F10) opens its menu: **Insert** (at the cursor, as the button),
  **Edit**, **Rename**, **Copy to new chord**, and **Delete** while no
  column uses it. The section folds from its heading (a 16px chevron,
  down while open), kept across visits in `frets.tab.chordPanel`
  `{ folded }`, like the open panel, not a preference; the + to add a
  chord sits at the heading's right, folded or not. Moving the cursor
  changes nothing in the panel but Insert's label (Jeremy, 2026-11-06).
- **Insert's button**, under the tiles with Name | Notes | Both, says
  where it writes: "Insert at bar 3, beat 2" (¼ ½ ¾ for beats between),
  plain "Insert" with the cursor off the tab (Jeremy, 2026-11-07, over
  "Insert C").
- **Edit chord** (`ChordShapesEditor`), its own section under the Chord
  set, opened by a tile's double-click or its menu's Edit, or a chord
  name's Edit (its right-click menu, or Enter while picked) or
  double-click on the tab, which also opens the Chords panel with that
  chord picked and moves the cursor to the name's column. Editing a chord
  the track has is choosing its shape (Jeremy, 2026-11-07):
  - The chord's **name** as a heading; a double-click or F2 on it, or the
    menu's Rename, opens it as a field, its text selected: Enter (or
    leaving it) renames the chord, its definitions and every column
    naming it in every Voice (`withRenamedChord`); Esc leaves it. Only the
    name changes. A name already in the set is refused ("“C” is already
    in the Chord set.").
  - **Shapes**: the chord's shapes on the track's tuning, its own first,
    up to nine, three to a row. A shape pressed is the chord's shape at
    once (`withChordShape`, keeping its show props); undo takes it back.
    MuseScore and Dorico apply a pick at once too.
  - **Change chord** opens the chord dialog on it (below); **Done** or
    Esc close Edit chord.
  - **It follows the chord picked** (Jeremy, 2026-11-07, over greying the
    other chords while it is open): a tile pressed, a chord name picked in
    the tab, or a Chord chart chord of this track pressed moves Edit chord
    to that chord, and Change chord to that chord's Change chord, dropping
    what wasn't saved, as Cancel does. Dorico's and MuseScore's Properties
    panels follow the selection likewise. A new chord's dialog (+, Copy to
    new chord) stays. Following never scrolls the page: the editor takes
    the keys without scrolling to itself (Jeremy, 2026-11-07).
- **The chord dialog** (`ChordEditor.tsx`): one dialog for defining a
  chord and for changing one (Jeremy, 2026-11-07: a detailed edit "as
  close as possible to the way of defining a new chord"). + opens it
  empty ("New chord"), Copy to new chord on a copy named "C 2" ("New
  chord from C"), and Change chord on the chord ("Change chord"). In the
  panel, not a modal (Jeremy, 2026-11-06, mock a of PR #395).
  - Top to bottom: **Name**, then **Root** (the Chords page's piano-key
    tiles) and **Type** (its grouped menu; the magnifier swaps it for a
    name to look up, Enter finds it, "No chord “…”" otherwise, Esc goes
    back), then **Shape**: the chord's shapes on the track's tuning (open
    first, then moveable), up to nine, three to a row, plain ink dots
    (Q9), the dialog's own shape first (the chord's, or a new chord's
    cursor fingering, captioned "At the cursor"); the last tile is **Draw
    your own**. A new root or type picks its first shape (and sounds it).
    On a chord, it opens on that chord's root and type (a name that isn't
    a chord type, "A barre/5", opens on what its shape's notes are: A
    major) and its shape picked.
  - **Name** follows the chord, shown as its placeholder, until something
    is typed in it (Jeremy, 2026-11-06: "customize the names of the
    chords even if they are known chord types"); emptied, it follows
    again. The name offered is the chord's symbol, unless the shape's
    notes aren't that chord: then the first name its notes have.
  - **Draw your own** swaps the tiles for a diagram you press (low E at
    the bottom, five frets): a press on a string at a fret puts a finger
    there, a second lifts it (open); beside the nut a press turns open to
    muted and back; ‹ "Fret 5" › move the frets shown. "Back to shapes"
    returns to the tiles. While the shape is drawn, or is the cursor's,
    "These notes are" (or "The notes at the cursor are") offers up to four
    names for its notes, each filling Name.
  - Nothing changes until a button: **Add chord** (new) puts the chord in
    the set with the shape (none for a name with no shape, "Riff A"),
    picks it for Insert, and leaves the columns as they were. **Save
    chord** (on a chord) renames the chord and gives it the shape, then
    goes back to Edit chord on it; with nothing changed it just goes back
    (Jeremy, 2026-11-07: never grey for want of a change). On a chord,
    Name's hint reads "Leave it empty and the name follows the chord
    (G)."
    A name already in the set can't be taken ("“G” is already in the
    Chord set."); Enter in Name does the same as the button.
  - **Save as new chord** (on a chord; Jeremy, 2026-11-06: "make minor
    changes and save it as a new chord") adds the name and shape as a new
    chord, as Add chord does, and leaves the chord opened and the columns
    naming it as they were. It needs a name not in the set: with the name
    unchanged and the shape changed it is grey, with "Give it a new name
    to save it as a new chord." A change that makes another chord (a new
    root or type, or a shape whose notes are another chord) names it, the
    Name following the chord, so it can be saved as a new chord at once
    (Jeremy, 2026-11-06); a name typed in Name is never rewritten. Guitar
    Pro 8's chord dialog likewise adds an edited diagram to the song's
    list. Copy to new chord in the menu stays too: it starts a copy before
    any change.
  - **Cancel** or **Esc** close it, changing nothing; from Change chord,
    back to Edit chord.
- **Insert** Name | Notes | Both (Both by default; Q6): writes the chord
  over the cursor column, its shape as the column's notes, or both, as one
  column (strummed by its notes, not a stroke). A name inserted with no
  definition gets one with the shape it was inserted with. In note input mode
  (Jeremy, 2026-11-06: the notes should "conform to whatever the note
  length was chosen by the digit key"), Notes and Both go in as a note
  typed does: a new column of the Input length at the cursor, over what is
  there, and the cursor moves on by it, so pressing Insert again writes the
  next chord. Name still names the cursor column, its length kept. In
  normal mode Insert writes over the picked column, keeping its length.
- **Hear** (Jeremy, 2026-11-05: "a small toggle in the chord panel that
  enables playback when a chord is clicked on"; 2026-11-06: "at the top to
  the right of the Chords label"). A small speaker toggle in the panel's
  head, right of its title, off at first. While on, picking a chord or a shape sounds its
  shape, strummed down, a quarter at 120 bpm, with the track's sound
  (`shapeAlone`, `Player.hearShape`). It is a Playback preference
  (`hearChords` in `frets.tab.playback`), listed in Settings as "Hear
  chords picked in the Chords panel".
- **Delete**, in an unused chord's menu (Jeremy, 2026-11-07: right-click
  over icons on the tiles), takes every definition of that name out of
  the set (`withoutChord`). Nothing stays picked after.
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
  2026-11-06 that is the chord editor, in the Chords panel.
- Jeremy, 2026-11-06 (PR #395's mocks): the editor in the panel, laid out
  as one form (a), over fingering-first (b) and steps (c); "Add chord",
  not "Add G"; picking a chord doesn't open it, Edit or a double-click
  does; Cancel and Esc close it.
- Jeremy, 2026-11-07 (issue #400, PR #401's mocks and Penpot comments):
  tiles with pages (b) over a scrolling list (a) and a selector (c); one
  Insert under the tiles, saying where; "Chord set" as the section's
  name; no icons on the tiles, a right-click menu with Copy to new chord;
  a copy named "C 2"; editing a chord is choosing its shape, its name
  renamed apart; Change chord opens the same dialog as +, with Cancel.
  Left to my recommendations: a shape picked in Edit chord applies at
  once (undo takes it back); Rename by double-click, F2 or the menu;
  both Copy to new chord and Save as new chord stay.

Settled while building (my calls, open to change):

- Insert works only with the cursor in the tab, as the palette's tools.
- Insert Notes leaves the column's name as it was.
- The `C` key still opens the chord name field, the way to change a
  column's name; keys for the panel wait for the open question on keys
  (Q2 of the mock round).
- The chord dialog is staged: nothing changes until Add chord, Save chord
  or Save as new chord. Edit chord is not: a shape pressed applies.
- Add closes the dialog; Save chord goes back to Edit chord. No ✕ besides
  Cancel and Done (one way to do a thing).

## How

- `TabRail.tsx`: `PanelId` gains `chords`; the Chords button after the
  tool panels; the open panel is lifted to the page (`useOpenPanel`) so
  Edit can open it; `parseLayout` reads `chords`.
- `playback.ts`: `shapeAlone`, `Player.hearShape`; `PlaybackFooter.tsx`:
  `hearShape`, and `hearChords` in the Playback settings; `tabSettings.tsx`
  lists it.
- `ChordPanel.tsx`: the panel; `Fold`, `parseChordPanel`,
  `HearChordsToggle` (which `TabRail` shows in the panel's head through
  `chordsHead`), `insertedColumn`, `freeName` (the copy's "C 2"),
  `cursorPlace` (Insert's "bar 3, beat 2"); the tiles, pager and menu
  (`ShapeMenu`, `useMenuTrigger`, as the Chords page's).
- `ChordEditor.tsx`: the chord dialog (`ChordEditor`), Edit chord
  (`ChordShapesEditor`), and `ShapeEditor`, drawing your own.
- `chordShapes.ts`: `chordOfName`, `shapesOf`, `shapeFor`, `toFrets`,
  `toShape`, `PLAIN_LOOK`, shared by the two; `namesForColumn` and
  `fretsOfColumn`, for Add.
- `chordSet.ts`: `withChordShape`, `withNewChord`, `withRenamedChord`,
  `withoutChord`.
- Diagrams (list and editor) are drawn with the chord the name means
  when the shape's notes are its tones, else with one its notes are
  (`chordToDraw`), so "My C" with the C shape has its diagram; none for
  no chord at all.
- `TabPage.tsx`: a chord name's Edit and double-click call
  `openChordsAt`.
- `tab.css`: the panel's look.

## Later

- Barres, fingers and a first fret in a drawn shape (#368).
- Diagrams over names and in exports (#242).
- Keys for the panel.
- Deleting a chord a column uses (with its names).

## Tests

- The dot's count: none for 0, "1", "99", "99+" for 100.
- Following a picked chord focuses the editor with `preventScroll`.
- The Chord set is tiles: a used one's title "Used 1 time" and its dot
  "1"; an unused one "Not used", with no dot and no tint; each has a diagram; no Edit or Delete icons, no
  name field, no shapes; + in the heading; no pager for two chords.
- Ten chords: page 1 has the first eight, "1 / 2", Previous grey; More
  shows Bm and Em, "2 / 2", More grey, six empty tiles keeping the room.
- A right-click on a tile picks it; its menu is Insert, Edit, Rename,
  Copy to new chord, Delete; a used chord's has no Delete.
- A chord name's Edit, its Enter and its double-click open the Chords
  panel and Edit chord on it, the stored shape picked; not note input mode.
- Picking a tile doesn't open it; a double-click and the menu's Edit do;
  + stays.
- Edit chord shows Shapes and Change chord: no Root, Type, Name field,
  Draw your own or Cancel.
- In Edit chord, a shape pressed is G's at once (its column still named
  G); Ctrl+Z puts 3-2-0-0-0-3 back; Done and Esc close it.
- A double-click on the name, and F2 on it, open the name field with G;
  "C" says it's in the Chord set and Esc leaves G; "G barre" with Enter
  renames the definition and the column's `{ch}`, Edit chord staying open
  on G barre. The menu's Rename opens it with the field focused.
- With Edit chord on G, pressing the C tile moves it to C, C's shape
  picked; with Change chord on G and another shape picked, pressing C
  moves to Change C and G keeps its shape. Picking the G name in the tab,
  or pressing G in the Chord chart, moves Edit chord on C to G. With +
  open, pressing a tile leaves it.
- Change chord on G: heading "Change chord", Root G, Type major, Name
  empty (G follows, the hint saying so), Draw your own there; Save chord
  with nothing changed goes back to Edit chord, G as it was. Another
  shape changes nothing until Save; Save gives G that shape, keeping
  `showname`, C untouched, and goes back to Edit chord. Cancel after
  picking, and Esc, change nothing and go back to Edit chord.
- In Change chord, Name "G barre" with Enter renames it everywhere; "C"
  can't be saved.
- Save as new chord on G: grey, with "Give it a new name…", after only
  the shape changed; with Name "G high" it adds "G high" with that shape,
  picked, unused; G keeps its shape and the column naming G is
  unchanged. On C, Type minor names it Cm, and Save as new chord adds Cm
  with no name typed. + has no Save as new chord.
- Copy to new chord on C opens the dialog named "C 2"; Add chord adds
  `"C 2" 0 1 0 2 3 x`.
- Esc closes the dialog after + → a root → a shape press, the focus let
  go to the page; Esc in the look-up field closes only the search.
- A chord with a custom name ("My C" with the C shape) opens Change chord
  on Root C, Type major, Name "My C".
- + opens Add: no Add until there is a name; Root D, Type sus2 picks
  x-x-0-2-3-0; Add chord defines `0 3 2 0 x x` as "Dsus2", unused and
  picked for Insert, no column changed; the editor closes. Another shape
  picked is the one added; Enter in Name adds. The magnifier: "Em"
  Enter gives Root E, Type minor; "Hendrix" says "No chord". "Riff A"
  typed with no shape is added with none. "G" can't be added again.
- With the cursor on the C column: the cursor's fingering x-3-2-0-1-0
  "at the cursor" is picked, Name's placeholder "C", "The notes at the
  cursor are" C; typed "My C", Add defines `0 1 0 2 3 x` with a
  diagram in the list.
- Draw your own: a press on string 1 at fret 3 of an empty shape gives
  x-x-x-x-x-3; again lifts it to open (0); beside the nut, open turns
  muted; "Higher frets" moves the frets shown, not the shape; the
  names of the drawn notes fill Name.
- `withRenamedChord`: definitions and columns in this Voice and the
  others renamed; nothing for a name already taken.
- `withNewChord`: a definition at the end, with frets or with none; a
  name already defined is left as it is.
- `namesForFrets` counts from the capo (the C shape is C at capo 2);
  `fretsOfColumn` needs two fretted notes; `chordToDraw` falls back to
  what the notes are, and gives none for one note.
- `withChordShape`: the last definition of the name changes; show props
  kept, `firstfret` and `barre` dropped; a name with none gets one at the
  end; "AM" is not "Am".
- With C picked, moving the cursor leaves the panel as it was but
  Insert's label: "Insert at bar 1, beat 1", then beat 2, then beat 3.
- Insert Name, Notes and Both each write what they say at the cursor.
- In note input mode with an eighth chosen, Insert Both on a quarter rest twice
  writes two eighth C columns, named, then `r.4`; Notes writes the notes
  alone at an eighth; Name names the rest, a quarter still.
- `parseLayout` reads `chords`.
- `shapeAlone`: nothing for no strings; a quarter at 120 bpm, strummed
  down. `parsePlaybackSettings` reads `hearChords`, false by default.
- The Chord set folds, + staying, kept; `parseChordPanel` drops ids it doesn't know.
- Hear is off at first, in the panel's head; its toggle turns it on and
  saves `hearChords`.
- An unused chord's menu Delete takes its definition out and leaves
  nothing picked.
