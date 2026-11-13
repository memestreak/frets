# Tab: Lengths, and bars always full

Step 4 of the build order in the Tab editing principles
(`docs/tab-editing-principles.md`, choices A8, A10,
A11 and A12, refined here). Jeremy settled the questions below on
2026-11-04 (Q1–Q26 in the thread "Make bars always full (step 4)", run
with /grill-with-docs). Rests are Gaps written by the meter
(`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`), and the meter's
splits are the step 1 tables
(`docs/specs/2026-11-03-tab-sounding-notes-design.md`); why edits work on
Sounding notes while the Clip stores Columns:
`docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`.

No edit makes an Uneven bar. A note that runs past the room it has
writes over what follows and is split and tied by the meter. Time is
added or taken only by Insert, Insert paste and Ctrl/⌘+Delete, which push
or pull the music after them across bar lines. A short first bar is a
Pickup bar, set on purpose. Uneven bars come only from an import or a
link, and their ⚠ offers the fix.

## Writing over (Q1, Q18, Q19, Q12)

Every edit that changes time works on the Voice's Sounding notes in one of
three ways, and the meter then writes every bar it touched:

- **Write over** from a time: the new notes take the whole Voice for their
  time, every string of a chord included, since a Column has one length.
  Whatever a covered note sounds after the new notes end becomes a Gap; it
  is not tied on. A note that covers any part of a tuplet removes the whole
  tuplet, and the tuplet's time the note doesn't cover becomes a Gap.
- **Push** from a time by a length: everything after moves later.
- **Pull back** from a time by a length: everything after moves earlier.

Music running past the clip's last bar gets new bars in the last bar's
time, in every Track; the other Tracks' new bars are Whole-bar rests
(Q23).

## Lengths (A8, Q10, Q11, Q13)

- **One note or chord**, picked alone: as since #294, its start stays;
  longer writes over what follows, split and tied by the meter across bar
  lines; shorter leaves a Gap.
- **A run** (a selection of several Columns): laid out again from its
  start, in order, each note with its new length. A Gap between two of its
  notes keeps its length, and the notes close up behind each other: a
  quarter, an eighth rest and a quarter on beat 1 of 4/4, made eighths,
  become `e re e`, then a one-beat Gap to the run's old end. Past the run's old end
  a longer run writes over what follows; a shorter one leaves a Gap.
- **A Tie chain**: the length keys on the Column a note starts in set the
  whole Sounding note's length, its Tie chain included (a quarter tied to
  an eighth, made a half, is a half from the same start). On a Column that
  only carries tied notes on, they do nothing until step 5 picks Tie chains
  as one (since then they set the whole chain's length:
  `docs/specs/2026-11-04-tab-ties-forward-design.md`).
- **In a tuplet**: the length keys do nothing on a note inside a tuplet
  until step 6. Triplet and Grace keep today's behaviour, and the ⚠ they
  can leave, until step 6 rebuilds them.
  (Since step 6 the length keys work within the tuplet, and tuplets and
  grace notes keep bars full: `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`.)
- A grace note's length still changes as before; it takes no time.

## Typing (A12, Q14)

- **Note input mode**: a typed note longer than the room before the next note
  writes over what follows, split and tied by the meter, over bar lines
  too. It no longer runs over the bar. A fret typed on a Column that
  already holds a note joins its chord at the chord's length, as before.
- **Normal mode, a fret on a picked rest**: the note takes that rest's own
  length, no longer the last note's.
- **On a Whole-bar rest**: the note fills the bar, written by the meter: a
  whole note in 4/4, a dotted half in 3/4, `q.` tied to `q` in 5/8.

## Adding and taking time (A10, A11, Q2, Q15, Q21, Q4)

- **Insert** adds a Gap at the cursor and pushes what follows: in note
  input, the input length at the cursor's time (a grid point inside a
  rest too); in normal mode, the picked note's or rest's length; with a
  selection, the selection's whole time.
- **Insert paste** (Ctrl/⌘+Shift+V, the right-click menu) puts the
  clipboard's Voice 1 in at the cursor and pushes what follows by its
  length. The pasted bar lines are not kept, as with paste. Into an empty
  clip the pasted clip still comes whole, with its name, time and tuning.
  A copy that starts or ends inside a bar (most copies) is written from
  the clip's start through the meter instead, so its bar is filled with
  rests and never short; the pasted clip's name, time and tuning still
  come. A paste never says a copied bar "doesn't add up": the bars it
  lands in stay full (issues #421, #422).
- **Ctrl/⌘+Delete** takes the selection's time, or the cursor's Column's,
  and pulls what follows back. Bars it covers whole are removed, as now
  and as MuseScore's "Remove selected range" does; the time it takes from a
  bar covered in part pulls the following music back. The clip's last bar
  ends in a Gap: no bars come off the end. On an empty bar it removes the
  bar, as now.
- **What moves**: every Voice of the Track, so Voice 2 keeps its place
  against Voice 1. Other Tracks don't move.
- **Bars the moved music passes through** are written by their time
  signatures, so an Uneven bar it reaches comes out even and its ⚠ goes.
  Bars the edit doesn't reach keep theirs. A free-time bar keeps its
  written length.

## Where the cursor lands (Q22)

- After Insert: on the new Gap's first rest, picked by itself, as a rest
  is after Delete.
- After Ctrl/⌘+Delete: where the removed time began.
- After Move extra into next bar or Fill with rests: on the bar fixed.
- After a re-bar (a time signature or a Pickup bar changed): the same time
  and string, as after a rewrite.

## Time signatures re-bar (Q3, Q20)

Setting or removing a time signature on a bar (the time signature panel)
re-bars the music from that bar up to the next time signature change, or
the clip's end, in every Track and every Voice: notes are split and tied
over the new bar lines by the meter. Music that needs more bars gets new
bars before that change, in every Track. A last bar left part-filled ends
in a Gap. Today such a change leaves Uneven bars.

## → never grows a bar (Q24)

→ never adds a rest inside a bar. It moves on, out of a short imported bar
too. From the clip's last Column it still starts a new bar, drawn as a
Whole-bar rest.

## The Pickup bar (Q8, Q9, Q26)

- Bar 1's time signature panel has a **Pickup** number field: whole beats
  of the time signature (eighths in 6/8), from 1 to one less than the bar
  has (1–3 in 4/4, 1–5 in 6/8), and 0 for none. It drags up and down and
  double-click resets it to 0, as numeric fields do.
- A Pickup bar is that long, not Uneven, and draws no ⚠. Its Gaps are
  written as the end of a full bar: a 1-beat pickup in 4/4 counts as
  beat 4, so an eighth on its last eighth has an eighth rest before it:
  `re e`.
- Changing the field, or setting it to 0, re-bars the music after it, as a
  time signature change does.
- It has no bar number: the first full bar is bar 1, as books, Dorico and
  MuseScore count, in the drawing, the ⚠ lines and messages.
- alphaTex writes it `\ac` (its length is its content's, as alphaTab reads
  it); Guitar Pro as an anacrusis; MusicXML as measure 0 with
  `implicit="yes"`. An imported pickup of part of a beat keeps its length
  until the field is changed.

## Uneven bars (A10, Q5, Q6, Q7, Q25)

An Uneven bar comes only from an import or a link (or, until step 6,
Triplet and Grace). It keeps its ⚠ and the line under the clip. A press on
its ⚠ opens a small panel there, with the one command that fixes it:

- **Overfull: Move extra into next bar.** The time past the bar's end moves
  into the next bar and pushes the following music along; nothing is lost.
- **Short: Fill with rests.** The missing time becomes a Gap at the bar's
  end.
- **A short bar 1** also offers **Make pickup bar**, which sets the Pickup
  field to its length, kept as it is even when that is part of a beat, as
  an imported pickup's is.
- A short last bar is no special case: it gets Fill with rests, as Dorico
  leaves it to you.
- The command fixes every Voice of the Track in that bar, and the panel
  closes after it (let go after use).

## What goes (A10)

- The "Fill short bars with rests" setting (Settings › Tab › Editing) and
  its `fillBars` field of `frets.tab.editing`; the parser drops it (no
  users, no migration).
- → adding one rest at a time to a short bar; ← and leaving a bar filling
  it.
- `fillBar`, `restToTypeOn`, `splitRest` and Insert's rest Column
  (`insertColumn`); `pasteOver`'s own splitting and `fewestRests` where
  the meter now writes.

No key is added or removed, so the `?` overlay is unchanged.

## How

- `src/features/tab/timeline.ts` (pure, new): a Voice from the edit's
  bar on as one stream of Columns (a tuplet group whole, a grace note
  taking no time), the bar lines taken out. `writeOver`, `writeSpan`,
  `pushTime` and `pullTime` change the stream; `layStream` lays it back
  into bars by their time signatures (and the Pickup bar), splitting a
  Column at a bar line and tying it on, and `writeVoice` spells the bars
  laid by the meter. The laying stops at the first bar line past the
  edit where the music is back on one of its old bar lines, so bars past
  the edit's reach keep their Columns. `reBar` and `reBarClip` lay a
  stretch of bars again by new time signatures, every Voice and Track;
  `layFrom` lays every bar from one on (Move extra).
- `editing.ts` and `noteEdits.ts`: `setFret`, `setDead`, `changeLength`
  (one note, runs, Tie chains), `pasteOver`, `insertPaste`, Insert and
  `deleteColumns` call the timeline. A time shift reads and writes every
  Voice of the Track (the Part's `otherVoices` too, through `withPart`),
  and adds master bars to every Track at the clip's end.
- `barEdits.ts`: `setBarTime` and the new `setPickup` re-bar through
  `rebar`. The Pickup bar is a master-bar field, read from and written to
  `\ac` (`alphatexRead.ts`, `alphatex.ts`), `guitarPro.ts`, `musicxml.ts`;
  `isUneven` and bar numbering skip it; the step 1 meter takes the
  pickup's offset.
- `BarTimePanel.tsx`: the Pickup field on bar 1.
- `TabClip.tsx`: the ⚠ under an Uneven bar becomes a button opening the
  panel (`moveExtra`, `fillWithRests`, `makePickup` in `barEdits.ts`).
- Remove `fillBars` from `editingPrefs.ts`, `tabSettings.tsx`,
  `editorKeys.ts`, `useEditorState.ts`, `TabPage.tsx`, and its line in
  `src/lib/README.md`.
- `editing_tests/`: add `insert-pushes.atex` (Insert and Ctrl/⌘+Delete
  across a bar line) and `typed-note-ties-over.atex` (note input mode past the
  bar line); update `longer-note-writes-over.atex` for runs
  (`.claude/skills/test-arrangement/`).
- Update `public/tab-alphatex.txt` and `public/skills/frets-tab/SKILL.md`
  for `\ac`.

## Settled while building

Small points the questions didn't reach, decided by the rules above:

- An edit that would put a tuplet across a bar line is refused, with "That
  would put a tuplet across a bar line." under the clip; so is a time
  signature change or Move extra that would.
- In note input mode, a fret typed on the string of a lone note (not a chord's,
  a tuplet's or a grace note) at another input length writes over at that
  length, as Dorico's and MuseScore's note input mode do; on another string it
  joins the chord at the chord's length, as before.
- In note input mode, ← and → step over the tied-on part of a note, the Tie
  chain being one Sounding note.
- A re-bar that reaches the clip's end drops the Gap after the last note,
  so changing 4/4 to 3/4 and back leaves no bar of rests.
- Move extra lays each Voice by itself: a Voice that fills the bar keeps
  its place.
- Ctrl/⌘+Delete on the Gap that ends the clip does nothing, and the
  playback line stays.
- Insert bar before a Pickup bar puts the new bar after it: the Pickup bar
  stays first.

## Tests

`src/__tests__/tab/timeline.test.ts`, the editing tests and page tests:

- Note input mode, input length a half, on beat 4 of a 4/4 bar of rests: a
  quarter on beat 4 tied to a quarter on beat 1 of the next bar; no bar is
  Uneven.
- Note input mode, a half typed on beat 1 of `q q q q`: `h q q`; on beat 2 it
  writes over beats 2–3, leaving `q h q`.
- A half typed over the first half of a whole note: `h rh`, the
  uncovered part a Gap, not tied on.
- A note over beat 2 of a triplet group on beats 1–2 removes the whole
  tuplet; its uncovered time is a Gap.
- A chord written over by a single note: every string of it goes for that
  time.
- Run: `q re q` from beat 1 made eighths is `e re e`, then a one-beat
  Gap, with what followed the run where it was; made halves, the run
  writes over what follows and ties over the bar line.
- A quarter tied to an eighth, made a half from its first Column, is a
  half on the same start; the length keys on the tied-on Column leave the
  Clip unchanged.
- The length keys on a note in a tuplet leave the Clip unchanged.
- Normal mode: a fret on a picked quarter rest is a quarter; on a 4/4
  Whole-bar rest a whole note; on 3/4's a dotted half; on 5/8's `q.` tied
  to `q`.
- Insert in note input mode with input length an eighth on beat 2: an eighth
  Gap there, the rest of the Voice an eighth later across the bar line;
  normal mode on a picked quarter: a quarter later; with beats 2–3
  selected: a half later.
- Ctrl/⌘+Delete on beat 2 of a 4/4 bar of quarters pulls the next bar's
  first quarter into beat 4; the clip's last bar ends in a Gap and the bar
  count is unchanged. Over two whole bars, both bars go.
- Insert and Ctrl/⌘+Delete move Voice 2 with Voice 1, and leave other
  Tracks' Columns unchanged.
- Running past the clip's end adds bars in the last bar's time to every
  Track; the other Tracks' new bars are Whole-bar rests.
- Insert before an imported overfull bar: the bar comes out even, with no
  ⚠; a bar after the edit's reach keeps its ⚠.
- 3/4 set on bar 3 of four bars of 4/4 quarters: bars 3 on hold the same
  notes in 3/4, with one new bar added, the last ending in a Gap; every
  Track re-bars.
- → at the end of a short imported bar moves on, adding no Column; from
  the clip's last Column it adds a bar that is a Whole-bar rest.
- Pickup field: 0–3 in 4/4, 0–5 in 6/8; set to 1 in 4/4, bar 1 is a
  quarter long, draws no ⚠, has no number, the next bar is bar 1; an
  eighth on its last eighth is written `re e`. Set back to 0, the music re-bars.
- alphaTex writes a Pickup bar `\ac` and reads it back; MusicXML writes it
  `number="0" implicit="yes"`; Guitar Pro marks it an anacrusis.
- The ⚠ panel: Move extra into next bar on an overfull bar pushes its
  extra into the next bar, losing no note; Fill with rests on a short bar
  ends it in a Gap; a short bar 1 also offers Make pickup bar; each fixes
  Voice 2 too, and closes the panel.
- Settings › Tab › Editing has no "Fill short bars with rests";
  `parseEditing` drops a saved `fillBars`.
