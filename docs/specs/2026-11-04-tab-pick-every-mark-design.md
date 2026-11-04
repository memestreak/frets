# Tab: every Mark can be picked

Step 8 of the build order in the Tab editing principles
(https://claude.ai/artifact/T5JHs64SqQcS6iqLhYfqs7, choice A15, with P11
and P14; §8's "Picking a mark" row; §13 row 13). Jeremy settled the
questions below on 2026-11-04 (Q1–Q19 in the thread "Plan step 8: every
mark can be picked", run with /grill-with-docs; the rounds are on the
page https://claude.ai/artifact/426tQEVpocHRY13S2KsBAn). It takes in
issue #351 (pick a let ring line and drag its ends) and closes it.

Most Marks are picked on their own already
(`docs/specs/2026-10-27-tab-pick-marks-design.md`,
`docs/specs/2026-11-01-tab-selection-look-design.md`, PR #286, PR #339).
This step makes the rest pickable, gives Spans a Handle at each end, and
shows what a picked Mark belongs to: an Attachment line and a soft tint
on its notes.

## What a press picks (Q1)

- **Newly picked on their own:** P.M. and let ring lines (Q2), time and
  key signatures (Q3); on the staff, stems and beams pick their column
  (Q4); a multi-bar rest picks its bars, as a press on a Whole-bar rest
  does.
- **Part of the note,** so a press picks the note, as now: fret numbers,
  note heads, ghost brackets, dead-note x's, natural harmonics' brackets
  and diamonds, dots, accidentals, grace notes.
- **Never picked:** the clef and TAB sign, staff and string lines, plain
  bar lines, bar numbers, the Grid, the cursor, the playback line, the
  loop, and the line under the clip. A ⚠ still opens its fix.
- Everything already picked stays as it is.

## P.M. and let ring lines (Q2)

A press on a P.M. or let ring line, on its label or its dashes, picks the
line as a Mark. The line alone turns blue; no column is selected (this
replaces the run selection in `2026-10-26-tab-note-marks-design.md`).
Delete, Backspace and its menu's Delete take P.M. or let ring off every
note of the Span and leave the notes. Esc lets it go. Its own tool
(Palm mute or Let ring) lights, and nothing else.

## Time and key signatures (Q3)

A press on a time or key signature picks it, blue, as a chord name is
picked. Enter, a double-click or its menu's Edit opens its panel under
it, where a press opened it before (this reverses the 2026-10-27 ask;
the double-click is the one a picked word already has,
`2026-11-01-tab-double-click-edit-design.md`). Delete or the menu's
Delete takes away a change later in the clip, re-barring as removing a
change does now; bar 1's signatures have Edit only, and Delete does
nothing.

## Stems and beams on the staff (Q4)

A press on a stem picks its column with no string, as a press on a tab
stem does now. A press on a beam picks the column whose stem is nearest
the press.

## Spans and their Handles (Q5–Q8, Q12)

- The Spans are **let ring, P.M., vibrato, octave lines and hairpins**:
  the Marks drawn as one line or wave over a run of columns. The whammy
  bar's "w/ bar" line, tuplets, ties, hammer-on arcs and text are not
  Spans.
- A picked Span has a **Handle** at each end: a small hollow circle in
  `--select`, about 7 units across, with a ±16 unit hit area, drawn only
  while the Span is picked. The start Handle sits at the line's start,
  so its label moves with it; on a Span shorter than its label, the end
  Handle sits just right of the label.
- A Handle snaps to columns. Dragging it past a column marks every note
  in that column, as the tool does on a selection; dragging back takes
  the Mark off the columns it leaves. A whole Tie chain is marked or
  unmarked together. A vibrato's new notes take its kind (slight or
  wide); an octave line's new columns its octave; a hairpin's its kind.
- Let ring, P.M. and vibrato are on notes, so their Handles stop before
  a rest. Octave lines and hairpins are on columns and can cover rests.
- Dragging into the next Span of the same Mark and kind joins them into
  one. A Span can't shrink below one column, and the start can't pass
  the end. A drag stops at its line of tab's end.
- While dragging, the Span is drawn where it will land; letting go is
  one undo step and leaves the Span picked; Esc while dragging puts it
  back. Touch drags the Handle the same way.
- The drawing doesn't change: a line is still the run of neighbouring
  columns that have the Mark. Let ring can sound past its line (alphaTab
  rings it until the string plays again); that stays as it is (Q16).

## Keys for a picked Span (Q9)

Alt+Shift+→ / ← move the picked Span's end one column later or earlier,
as Dorico's Shift+Alt+→ / ←, by the same rules as the end Handle, and go
on across lines of tab. The start moves by its Handle only. Without a
picked Span the keys do what they do now.

## Attachment lines (Q10, Q11)

- A picked Mark drawn away from its note has an **Attachment line**:
  chord names and text, accents and staccato, fermatas, strokes, wah,
  P.H. and AH, mordents, tremolo slashes, tuplet numbers, the whammy bar,
  and every Span. Marks that touch their note already (bends,
  slide-outs, taps, slides, tie and hammer-on arcs) have none; nor do
  what belongs to a bar (sections, tempos, the capo, endings,
  signatures, bar lines).
- It is a thin dotted line in `--select`, straight from the edge of the
  Mark nearest the note to the note's fret number, or to its note head
  when the Mark was picked on the staff. A Mark over a whole column goes
  to the column's nearest note: its top note for Marks over the tab, its
  bottom one for Marks under it.
- A Span has one line to its first column and one to its last; a Span
  crossing onto another line of tab draws, on each line, the line for
  the end that is on it.

## The related notes' tint (Q2 comment, Q18, Q19)

- Every picked Mark lights the notes it is on with a soft tint behind
  each fret number (and its note head on the staff): `--select-soft`,
  the fill of a selected range's box, with no outline. The numbers stay
  in ink, so they don't look picked.
- The notes: one for a bend, slide-out or tap; both for a tie, hammer-on,
  pull-off or slide between two notes; every note of the column for a
  column Mark; every note of a Span; the column's notes for a chord name
  or text. Marks that belong to a bar light nothing.
- This revises A15, which chose the line over a tint; Jeremy asked for
  both (2026-11-04).

Handles, Attachment lines and the tint are drawn only on the page while
a Mark is picked. Nothing moves or changes size, and none of them reaches
a PNG, SVG or print.

## The menu, one pick, Alt+← → (Q13–Q15)

- A picked Mark's menu has Delete, with Edit first where a panel or field
  exists: words, ×N counts, time and key signatures, and tuplet numbers
  (Edit opens the Tuplet panel). Nothing else is added.
- One Mark is picked at a time, as now. Picking several and Select
  similar stay with issue #260.
- Alt+← → step onto the new pickable things too, in reading order: a
  bar's signatures before its opening words, a P.M. or let ring Span
  with its first column's Marks.

## Kept out (Q16)

Issue #350 (the selection's articulations shown while their panel is
closed); drawing let ring to where it stops ringing; moving a whole Mark
to other notes by dragging its body.

## Exports and what doesn't change (Q17)

- alphaTex, Guitar Pro, MusicXML, ASCII, PNG and SVG are unchanged.
- No Preference is added or removed.
- `public/tab-alphatex.txt` and `public/skills/frets-tab/SKILL.md` are
  unchanged: alphaTex and the drawing are the same.
- The `?` overlay's "A picked word, bar line or mark" group gains
  Alt+Shift+← → ("Move a picked line's end"), and its Enter row says
  signatures and tuplet numbers open too.

## How

- `runs.ts`: `runAt` returns a Span as a `MarkHit` (`palmMute`,
  `letRing`, with `to`); `spanEnds` gives each Span's Handles.
- `marks.ts`: `DrawnMark` gains `palmMute`, `letRing`; `markNotes` and
  `attachment(layout, hit)` give the notes to tint and the line's ends;
  `markTool` lights Palm mute and Let ring.
- `layoutText.ts` / `useTabPicking.ts`: a signature press picks a
  `WordHit` of kind `timeSignature` or `keySignature`; `hasEdit` covers
  them and tuplets.
- `hitTest.ts`: `rhythmAt` takes staff stems and beams; multi-bar rests.
- `noteEdits.ts`: `setSpan(clip, hit, from, to)` marks and unmarks
  columns, Tie chains whole, for the Handles and Alt+Shift+← →.
- `TabClip.tsx`: draws the Handles, the Attachment line and the tint
  for the picked Mark; a Handle drag previews and commits once.
- `elements.ts`: the new stops; `shortcuts.ts`: the keys.
- `editing_tests/`: add `pick-spans.atex` and `pick-everything.atex`.

## Tests

`src/__tests__/tab/` (pure tests next to `marks.test.ts`, page tests in
`page/`):

- A press on a let ring line picks it: it is drawn in `--select`, no
  column is selected, Let ring lights and no other tool does; Delete
  takes `lr` off every note of the run and the notes stay; Esc lets it
  go. The same for P.M.
- A press on a time signature picks it and opens no panel; Enter, a
  double-click and the menu's Edit open the panel; Delete on a later
  change removes it; Delete on bar 1's does nothing and its menu has no
  Delete. The same for a key signature.
- A press on a staff stem picks its column with no string; a press on a
  beam between two stems picks the nearer column. A press on a
  multi-bar rest picks its bars.
- A press on a ghost bracket, a dot or an accidental picks the note; a
  press on a plain bar line, a bar number or the clef picks nothing new.
- A picked Span draws two Handles; a vibrato, an octave line and a
  hairpin are Spans; a picked tuplet, tie and the whammy bar draw none.
- Dragging a let ring Span's end Handle two columns on marks every note
  of both columns, as one undo step; dragging it back unmarks them; it
  stops before a rest; a hairpin's Handle passes over a rest; dragging
  into the next let ring Span joins them; the Span can't shrink below one
  column; Esc mid-drag changes nothing.
- Dragging the start Handle one column earlier moves the label there.
- A Handle dragged over a Tied note marks its whole Tie chain.
- A wide vibrato's new column is wide; an `8vb` line's new column `8vb`.
- Alt+Shift+→ on a picked let ring Span marks the next column and goes
  across a line of tab; Alt+Shift+← unmarks its last; without a picked
  Span, Alt+Shift+→ grows the selection as before.
- A picked chord name, accent, fermata and let ring Span draw an
  Attachment line, a Span two; a picked bend, tie, section and time
  signature draw none. A Mark over the tab's line ends at the column's
  top number; one under it, at its bottom one; one picked on the staff,
  at the note head.
- A picked bend tints its note; a picked tie both its notes; a picked
  accent every note of its column; a picked let ring Span every note of
  its run; a picked section nothing. Tinted numbers stay in ink.
- PNG and SVG exports of a clip with a picked Span have no Handle,
  Attachment line or tint.
- Alt+→ steps onto a time signature and a let ring Span.
- The `?` overlay lists Alt+Shift+← →.
