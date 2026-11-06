# Tab: the Chords panel

Issue [#251](https://github.com/memestreak/frets/issues/251), step 2 of
the chords-in-Tab build order (planning doc
https://claude.ai/artifact/R4ffGZLV63TiViD2Hj3mr5). Builds on the Chord
set (`2026-11-05-tab-chord-set-design.md`, #367). The chord editor
(2026-11-06, PR #395) also draws your own shape and renames a chord,
part of #368.

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
  on), and nothing more: its editor opens only from Edit or a
  double-click (Jeremy, 2026-11-06). Moving the cursor changes nothing in the panel (Jeremy,
  2026-11-06). The list folds from its heading (a 16px chevron, down while
  open), kept across visits in `frets.tab.chordPanel` `{ folded }`, like
  the open panel, not a preference.
- **The chord editor** (`ChordEditor.tsx`), in the panel where the + was,
  not a modal (Jeremy, 2026-11-06, mock a of PR #395: "most chords will
  be from a known set, having that set laid out makes it easier to find
  the form you're thinking of"). While it is open the + is hidden;
  Insert stays below it. Two ways in:
  - **+** opens it empty, its Name field taking the keys.
  - **Edit**: a chord's pencil, a double-click on it in the list, or a
    chord name's Edit (its right-click menu, or Enter while picked) or
    double-click on the tab, which also opens the Chords panel with that
    chord picked and moves the cursor to the name's column. It opens on
    that chord: its name, its root and type (a name that isn't a chord
    type, "A barre/5", opens on what its shape's notes are: A major), and
    its shape picked.
  - Top to bottom: **Name**, then **Root** (the Chords page's piano-key
    tiles) and **Type** (its grouped menu; the magnifier swaps it for a
    name to look up, Enter finds it, "No chord “…”" otherwise, Esc goes
    back), then **Shape**: the chord's shapes on the track's tuning (open
    first, then moveable), up to nine, three to a row, plain ink dots
    (Q9), the editor's own shape first (the chord's, or a new chord's
    cursor fingering, captioned "At the cursor"); the last tile is **Draw
    your own**. A new root or type picks its first shape (and sounds it).
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
  - **Add chord** (new) puts the chord in the set with the shape (none
    for a name with no shape, "Riff A"), picks it for Insert, and leaves
    the columns as they were. **Save chord** (Edit), grey until the name
    or shape changes, renames the chord, its definitions and every column
    naming it in every Voice (`withRenamedChord`), and gives it the shape
    (`withChordShape`, keeping its show props). A name already in the set
    can't be taken ("“G” is already in this track’s chords"); Enter in
    Name does the same as the button. Either closes the editor.
  - **Save as new chord** (Edit; Jeremy, 2026-11-06: "make minor changes
    and save it as a new chord") adds the name and shape as a new chord,
    as Add chord does, and leaves the chord opened and the columns naming
    it as they were. It needs a name not in the set: with the name
    unchanged and the shape changed it is grey, with "Give it a new name
    to save it as a new chord." A change that makes another chord (a new
    root or type, or a shape whose notes are another chord) names it, the
    Name following the chord, so it can be saved as a new chord at once
    (Jeremy, 2026-11-06); a name typed in Name is never rewritten.
    Picked over a Duplicate button in the list
    (two steps, and a stray copy on Cancel) and over Save choosing by the
    name (hides the choice, loses renaming). Guitar Pro 8's chord dialog
    likewise adds an edited diagram to the song's list.
  - **Cancel** or **Esc** close it, changing nothing.
- **Insert** Name | Notes | Both (Both by default; Q6): writes the chord
  over the cursor column, its shape as the column's notes, or both, as one
  column (strummed by its notes, not a stroke). A name inserted with no
  definition gets one with the shape it was inserted with. In note input
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
  2026-11-06 that is the chord editor, in the Chords panel.
- Jeremy, 2026-11-06 (PR #395's mocks): the editor in the panel, laid out
  as one form (a), over fingering-first (b) and steps (c); no "New
  chord" title; "Add chord", not "Add G"; picking a chord doesn't open
  it, Edit or a double-click does; Cancel and Esc close it.

Settled while building (my calls, open to change):

- Insert works only with the cursor in the tab, as the palette's tools.
- Insert Notes leaves the column's name as it was.
- The `C` key still opens the chord name field, the way to change a
  column's name; keys for the panel wait for the open question on keys
  (Q2 of the mock round).
- The editor is staged: nothing changes until Add chord, Save chord or
  Save as new chord.
- Save chord's button reads "Save chord", and Add and Save close the
  editor; no ✕ besides Cancel (one way to do a thing).

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
- `ChordEditor.tsx`: the chord editor; `ShapeEditor`, drawing your own.
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

- The panel has the list, + and Insert: no name field, no shapes; each
  chord has Edit; its uses, or ○ for an unused one.
- A chord name's Edit, its Enter and its double-click open the Chords
  panel and that chord's editor, the stored shape picked; not note input.
- Picking a chord in the list doesn't open its editor; its Edit and a
  double-click do.
- The editor on G: Root G, Type major, Name empty (G follows), "Save
  chord" grey. Next shape picked: Save gives G that shape, keeping
  `showname`, C untouched. Cancel after picking, and Esc, change nothing
  and close it.
- Name "G barre" with Save renames the definition and the column's
  `{ch}`; the list has "G barre", used once. A name in the set ("C")
  can't be saved.
- Save as new chord on C: grey, with "Give it a new name…", after only
  the shape changed; with Name "C high" and another shape it adds
  "C high" with that shape, picked, unused; C keeps its shape and the
  column naming C is unchanged. On C, Type minor names it Cm, and Save
  as new chord adds Cm with no name typed.
- Esc closes the editor after + → a root → a shape press, the focus let
  go to the page; Esc in the look-up field closes only the search.
- A chord with a custom name ("My C" with the C shape) opens on Root C,
  Type major, Name "My C".
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
- With a chord picked, moving the cursor leaves the panel exactly as it
  was.
- Insert Name, Notes and Both each write what they say at the cursor.
- In note input with an eighth chosen, Insert Both on a quarter rest twice
  writes two eighth C columns, named, then `r.4`; Notes writes the notes
  alone at an eighth; Name names the rest, a quarter still.
- `parseLayout` reads `chords`.
- `shapeAlone`: nothing for no strings; a quarter at 120 bpm, strummed
  down. `parsePlaybackSettings` reads `hearChords`, false by default.
- The list folds, kept; `parseChordPanel` drops ids it doesn't know.
- Hear is off at first, in the panel's head; its toggle turns it on and
  saves `hearChords`.
- An unused chord's trash can takes its definition out and leaves nothing
  picked; a used chord has no trash can.
