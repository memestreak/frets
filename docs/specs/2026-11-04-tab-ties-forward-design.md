# Tab: Ties forward, a Tie chain as one note

Step 5 of the build order in the Tab editing principles
(`docs/tab-editing-principles.md`, choice A7, with P3
and P8). Jeremy settled the questions below on 2026-11-04 (Q1–Q22 in the
thread "Plan ties as one note (step 5)", run with /grill-with-docs). A
Tie chain is read as one Sounding note by the step 1 layer
(`docs/specs/2026-11-03-tab-sounding-notes-design.md`); why edits work on
Sounding notes while the Clip stores Columns:
`docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`. Writing over,
pushing and pulling are step 4's
(`docs/specs/2026-11-04-tab-bars-always-full-design.md`).

T ties forward, as in Dorico (MuseScore ties forward too), no longer
back to the note before. T used to be Tap, which moves to Alt+T, and `=`
becomes Dorico's "longer", beside − for shorter (Jeremy, 2026-11-04). A Tie chain is picked, deleted, lengthened and re-fretted as one
note, whichever of its Tied notes is pressed. Alt+press picks one Tied
note alone, for marks of its own. The Clip still stores each tie on the
note it arrives at (alphaTex `-`), so nothing saved, linked or exported
changes.

## A Tie chain is one note (Q1, Q2, Q3, Q11, Q12, Q18, Q21, Q22)

- **Pressing** any Tied note picks the whole chain: the cursor goes to
  its first note, and every note of it is drawn picked (`--select`), the
  tab's numbers and the staff's heads, across bar lines and Systems.
  A press where a Tied note isn't drawn (in Both view the tab hides tied
  numbers inside a bar) still picks the chain.
- **Hear notes**: pressing a chain plays it once, at its whole length.
- **← →** in normal mode skip a Column that holds only tied-on notes, as
  note input mode already does (step 4): the chain is one stop. A Column
  where something starts, a note on another string or a Column thing, is
  still a stop. **Alt+← →** stops on a chain once, as a note; a Tied
  note's own marks stay stops of their own.
- **Delete, cut, copy, Insert and Ctrl/⌘+Delete** on a picked chain act
  on all of it: Delete leaves one Gap for the chain's whole time, Insert
  adds a Gap the chain's length, Ctrl/⌘+Delete takes the chain's time.
- **The length keys** set the whole chain's length from its start,
  whichever Tied note is picked (step 4 did this only from its first
  Column).
- **A fret typed** on any note of a chain in normal mode changes the
  whole chain's fret; it no longer unties the note. In note input mode, step
  4's rule for a lone note applies to the chain as a whole.
- **A selection of several Columns** acts on the Sounding notes that
  start inside it, whole: a chain that starts inside and runs past the
  selection's end goes whole, and its Tied notes past the box are drawn
  picked too; a note held from before the selection is left as it is.
  Copy and cut take the same notes, so the clipboard runs to the last
  note's end.

## Duration and dots on a chain (Q10)

- The Duration group lights the chain's whole length when that is one
  written value: `q~e` lights quarter and the dot. When it isn't (`h~e`),
  nothing lights.
- `.` dots the chain when its length is one plain value: `q~q` becomes
  `h.`. Otherwise `.` does nothing.

## Marks on a chain (Q5)

A mark put on a picked chain goes where the step 1 rules put it when a
note is split:

- **Whole-note marks** on every Tied note: palm mute, let ring, vibrato,
  tremolo picking.
- **Attack marks** on the first: hammer-on or pull-off, slide in, accent,
  ghost, tap, harmonic, mordent, staccato, and the bend.
- **Slide out** on the last.

A tool lights when the chain has the mark where it belongs.

## One Tied note alone (Q4, Q16, Q17)

- **Alt+press** on a Tied note picks only that note, and only it is
  drawn picked. It is listed in the `?` overlay.
- A Tied note picked alone takes marks, put on that note alone: a bend
  held and pushed higher, a slide out, palm mute on just that note (the
  Sweet Child bends). Fret, length, Delete, T and Insert still act on
  the whole chain.

## Keys: T ties, = and − change the length

As Dorico's (Jeremy, 2026-11-04, after the questions; A7 said T stays
Tap): **T** ties forward, **Alt+T** is Tap, and **=** and **−** make the
picked notes, or note input mode's next note, longer and shorter, beside W
and Q (MuseScore's). `+` still does what `=` does, since it is Shift+= on
many keyboards. The Tie tool's tip is "Tie to the next note (T)", the Tap
tool's "Tap (Alt+T)", and the Duration tips and the `?` overlay say `= −`.

## T ties forward (A7, Q6, Q7, Q8, Q19, Q20)

**Normal mode, one picked note or chord.** T ties each picked note on
from its chain's end, by what the next Column holds on that string:

- **A note**: it takes the fret and is tied.
- **Notes on other strings only**: a tied note is added there on this
  string.
- **A rest**: the rest becomes a tied note of that rest's length (as a
  fret typed on a picked rest, A12).
- **Nothing** (the clip's end): nothing happens.

A grace note in between is skipped: the tie goes to the next note that
takes time. A tie into or out of a tuplet note follows the same rule.
The note tied to loses its attack marks (hammer-on or pull-off, slide in,
accent, ghost, tap, harmonic, mordent, staccato) and keeps the rest (a
bend, palm mute, a chord name over it).

**Normal mode, a selection of several Columns.** T ties each selected
note to the next note on its string only where that note already has the
same fret, as MuseScore ties a range; it never changes a fret.

**Note input mode.** T adds a note of the input length tied on after the
chain at the cursor, every string of its chord, writing over what follows
and split and tied by the meter (step 4). The cursor stays on the chain,
so T again makes it longer. It plays nothing (the note is held). On a
rest T does nothing.

**Taking a tie away.** Pick the tie arc and press Delete or T: the
chain splits there, and the note after is played again, keeping its
fret. T on a note never unties. The Tie tool lights only when a tie arc
is picked.

The Tie tool's tip becomes "Tie to the next note".

## What doesn't change (Q13)

- Ties are drawn as today: in brackets where a bar starts, every tied
  number in Tab view.
- The Clip stores each tie on the note it arrives at, as alphaTex's `-`
  does, so alphaTex, links, saves, Guitar Pro, MusicXML and ASCII tab are
  unchanged, and so are `public/tab-alphatex.txt` and
  `public/skills/frets-tab/SKILL.md`.
- No Preference is added or removed.

## How

- `sounding.ts` already reads a Tie chain as one Sounding note with its
  Tied notes; a small `chainAt(part, cursor)` gives the chain under a
  Column and string, its first and last Tied note and its time.
- `useTabPicking.ts`, `useEditorState.ts`: a press on a Tied note puts the
  cursor on the chain's first note; Alt+press keeps it on the Tied note
  and marks the pick as one Tied note alone.
- `TabClip.tsx`, `StaffDrawing.tsx`: draw every Tied note of the picked
  chain, and of chains starting in a selection, in `--select`.
- `editorKeys.ts`: normal mode's ← → skip tied-on Columns (the note
  input loop, shared); `elements.ts` lists a chain once.
- `editing.ts`, `noteEdits.ts`, `timeline.ts`: Delete, cut, copy, Insert,
  Ctrl/⌘+Delete, `changeLength`, `cycleDots` and `setFret` take the
  chain's whole time and every Tied note; `setFret` stops untying; marks
  go by the split rules above unless one Tied note is picked alone.
- `toggleTie` becomes `tieForward` (normal mode, both cases above) and a
  note input mode `tieOn` through `writeOver`; the tie arc's Delete and T
  untie (`marks.ts`, already pickable).
- `tools.ts`: the Tie tool's label, its light, T in note input mode.
- `shortcuts.ts`: Alt+press, "One Tied note of a chain"; `= −` for longer and shorter. `tools.ts`, `editorKeys.ts`: T ties, Alt+T taps, `=` is longer.
- `editing_tests/`: add `tie-forward.atex` (T in normal mode and note
  input) and `tie-chain-is-one-note.atex` (press a tied (5): the whole
  chain lights, then a length key and Delete); update
  `fret-follows-tie.atex` (press the tied (5), type 7: both turn 7).

## Tests

`src/__tests__/tab/ties.test.ts`, the editing tests and page tests:

- A press on the second Tied note of a `q~q` chain over a bar line puts
  the cursor on the first and draws both picked; a press on a hidden tied
  number in Both view picks the chain too.
- Normal mode → from the start of a `h~q` chain under a moving melody
  stops where the melody's notes start, and skips a Column holding only
  the tied-on note; Alt+→ stops on the chain once.
- Delete on a picked chain's second Tied note leaves one Gap for the
  whole chain, written by the meter.
- Insert on a picked `q~e` chain adds a dotted-quarter Gap; Ctrl/⌘+Delete
  takes a dotted quarter.
- The length key for a half on the second Tied note of `q~e` makes a
  dotted half from the chain's start (the chain's dot stays, as a length
  key keeps a note's); on `e~e` it makes a half.
- Duration on `q~e` lights quarter and the dot; on `h~e` nothing; `.` on
  `q~q` makes `h.`; on `h~e` leaves the Clip unchanged.
- A fret typed on the second Tied note changes both notes' fret and keeps
  the tie (replaces the "keeps marks, but not a tie" test).
- A selection from beat 2 of a bar whose bass is held from beat 1, with a
  chain starting on beat 3 running into the next bar: Delete leaves the
  bass held and removes the whole chain; copy's clipboard runs to the
  chain's end.
- A mark on a picked chain: palm mute, let ring, vibrato and tremolo on
  every Tied note; hammer-on, slide in, accent, ghost, tap, harmonic,
  mordent, staccato and bend on the first; slide out on the last; each
  tool lit for the chain.
- Alt+press on the second Tied note then a bend: the bend is on that note
  only; then a length key changes the whole chain.
- T in normal mode: onto a note at another fret, the fret is taken and
  tied, and its hammer-on and accent go, its palm mute stays; onto a
  Column with notes on other strings only, a tied note is added on this
  string; onto a quarter rest, a tied quarter; at the clip's last note,
  the Clip is unchanged; past a grace note, the tie goes to the note after.
- T with three Columns selected ties only where the next note has the
  same fret, and no fret changes.
- T in note input mode, input length a quarter, on a half on beat 1 of
  `h q q`: `h. q` (the meter writes `h~q` as one dotted half), cursor
  still on beat 1; T again ties over beat 4 too, a whole note; on a
  rest, the Clip is unchanged; nothing is played.
- A picked tie arc and Delete, or T, splits the chain: the note after is
  played again at the same fret; T on a picked note never unties; the
  Tie tool lights only on a picked tie arc.
- The Tie tool's tip is "Tie to the next note (T)", Tap's "Tap
  (Alt+T)"; Alt+T taps a note; `=` makes a picked note longer and, in
  note input mode, the next note; the `?` overlay lists Alt+press and `= −`.
- alphaTex, MusicXML, Guitar Pro and ASCII tab of a chain made with T
  are the same as of one typed with `-`.

## Settled while building

- **The meter spells the chain after every edit.** T ties the Clip's
  notes, and the bars it changed are written again by the meter (step
  3), so a chain that fits one value becomes one note: T on beat 1 of
  `q q h` gives `h h`, and in note input mode `h` then T gives `h.`, then
  `w`. Ties only show where the meter needs them.
- **T stops at a grace note on the same string.** A tie after a grace
  note ties from the grace note in alphaTex, so T can't reach over one
  on its own string and does nothing there; a grace note on another
  string is passed over, as Q20 says.
- **The length keys keep the chain's dot**, as they keep a single
  note's: a half on `q~e` (a dotted quarter) makes a dotted half. `+ −`,
  `W Q` and `.` do nothing on a chain that is no one written value
  (`h~e`), as nothing lights for it.
- **Insert and Ctrl/⌘+Delete with several Columns selected** take the
  selection's own time, as before; only with a chain picked, or one
  Column, do they take the chain's.
- **A picked mark on a Tied note** (its bend, its slide out) is that
  note's own: Delete takes it from that note only.
- **A Tied note the tab doesn't number** (inside a bar in Both view)
  lights on the staff only. A Tied note past a selection's box, or the
  rest of a picked chain, is drawn with the box the picked note has,
  under its number.
- **A press doesn't sound in normal mode**, as before, so Q22's "plays
  it once" is about Hear notes: an edit heard on a chain sounds once, at
  the cursor, which is on its first note. T sounds nothing.
- **A fret typed on a chain in note input mode** enters a note of the input
  length at its start, over the whole chain: step 4's rule for a lone
  note.
