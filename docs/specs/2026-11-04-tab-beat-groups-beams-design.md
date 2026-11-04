# Tab: Beat groups and beam overrides

Step 7 of the build order in the Tab editing principles
(https://claude.ai/artifact/T5JHs64SqQcS6iqLhYfqs7, choices A5 and A6,
with P6 and P9; §13 row 12). Jeremy settled the questions below on
2026-11-04 (Q1–Q13 in the thread "Plan step 7: beat groups and beams",
run with /grill-with-docs; the round is on the page
https://claude.ai/artifact/D7vhxkR3KsGneSmqs3dbMS). Notes and Gaps are
already split where Beat groups meet
(`docs/specs/2026-11-03-tab-sounding-notes-design.md`,
`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`); re-barring after a
time signature change is step 4's
(`docs/specs/2026-11-04-tab-bars-always-full-design.md`).

Beams now follow the Beat groups too, a time signature of five or more
beats can be given its own grouping, and a note can break or join the
beam before it. Until now `\beaming` and `{beam split|merge}` were kept
as written but not drawn.

## Automatic beams (Q1)

- In a meter counted in eighths or shorter (5/8, 6/8, 7/8, 9/8, 12/8,
  12/16…), eighths and shorter are beamed within each Beat group:
  5/8 as 3+2, 7/8 as 2+2+3, 6/8 as 3+3. Sixteenths too: in 7/8 the
  sixteenths of each group of two eighths share one beam.
- In a meter counted in quarters or halves, beams stay by the beat, and
  in 4/4 plain eighths are beamed four together in each half bar, as
  now. Eighths in 2/4 and 3/4 stay in pairs.
- Beams never cross a rest, a grace note or a bar line, and are flat, as
  now.

The default Beat groups are those `beatGroups` already has: 4/4 2+2,
5/4 3+2, 6/4 3+3, 7/4 4+3, other quarter meters one per beat; over 8 or
shorter, threes when the count divides by three, 5 as 3+2, 1 and 2 as
one group, else twos ending in a three (7/8 2+2+3, 11/8 2+2+2+2+3).

## The Beat groups field (Q2, Q3, Q4)

- The time signature panel has a **Beat groups** field under its two
  numbers when the time signature's top number is 5 or more (5/8, 6/8,
  7/8, 9/8, 12/8, 5/4, 7/4…), and on any bar whose time signature
  already has a grouping of its own (from an import), so it can be put
  back.
- It is one small text field showing the grouping in use, such as
  `2+2+3`, counted in the time signature's lower number: eighths in 7/8,
  quarters in 5/4. Each part is a whole number, 1 or more.
- Enter, or leaving the field, applies it. A grouping that doesn't add up
  to the top number is not applied and the field gets a small red ⚠ with
  a tip ("Adds up to 6; the bar has 7"). The text stays as typed. A
  double-click puts back the default grouping. Typing the default is the
  same as having none of its own.
- A grouping is part of the time signature, as in Dorico and MuseScore.
  It holds from its bar to the next time signature. To change the
  grouping inside a run of 7/8, set it on that bar's panel: the bar gets
  a 7/8 time signature change with the new grouping, drawn there like
  any change, and "Remove the change" takes it away. A time signature
  change whose meter and grouping both equal the one before is no change,
  as now.
- The drawn time signature is always the two numbers (7/8), never
  `2+2+3`.

## A grouping changed (Q5)

The bars it covers are written again by the new groups, in every Track
and Voice. Notes keep their starts and lengths; their splits, ties and
Gaps follow the new groups, and so do the beams. Undo takes it back in
one step.

## Reading and saving a grouping (Q6)

- A grouping belongs to the bar every Track shares (`masterBars`), as
  alphaTab's `\beaming` does, not to one Track's bar.
- It is written as `\beaming (8 2 2 3)` in the bar of its `\ts`, the
  first number the time signature's lower number.
- Where a time signature follows one with a grouping of its own, Frets
  writes that time signature's default grouping there too, so alphaTab
  and Guitar Pro, which carry a `\beaming` on until the next one, don't
  carry the old grouping into it.
- An imported `\beaming` in finer units that converts to whole beats is
  read: `(16 6 4 4)` in 7/8 is 3+2+2. One that doesn't convert, doesn't
  add up, or is one of several in the bar, is kept as written and not
  drawn, as now.

## Beam overrides (Q7, Q11)

A note can have one **Beam override**: Break before (the beam stops
before this note) or Join to previous (the beam goes on from the note
before it), else it is Automatic.

- Only an eighth or shorter, not a grace note, takes one, and it only
  works where the note before it in the bar is one too: Join never
  crosses a rest, a grace note or a bar line. Join on a note with no
  beamable note right before it, and Break on the bar's first note, do
  nothing.
- An override that can no longer apply (the note before it was deleted)
  is kept, and works again once it can.
- A Tie chain's override is on its first note; the pieces the meter
  splits it into beam automatically.
- Join to previous across a Beat group joins the two groups' beams into
  one; Break before inside a group splits it in two.
- alphaTex: Break before on a note is `{beam split}` on the Column
  before it, Join to previous `{beam merge}` there, as alphaTab reads
  them. An imported `{beam splitsecondary}` (break only the inner beams)
  is kept as written and drawn as Automatic; `{beam up|down|invert}`
  (stem direction) is kept as written, as now.

## Setting an override (Q8, Q9, Q10)

- The Rail's Rhythm group has two tools: **Break the beam before this
  note** and **Join the beam to the note before**. The one set on the
  picked note is lit; for Automatic neither is. Pressing the lit one puts
  the note back to Automatic; pressing the other switches to it. On a
  note that can't take one (Q11) they do nothing and light nothing. No
  key.
- A right-click with the cursor or selection on notes that can take one
  adds **Break beam before** and **Join beam to previous** to the bar's
  menu, after Insert paste, each ticked when set. Choosing a ticked one
  puts the note back to Automatic. On anything else they aren't shown.
- On a selection, as Dorico's Beam together and Unbeam: Join goes on
  every selected note except the first, so the selection is one beam
  (still broken at rests, grace notes and longer notes); Break goes on
  every selected note, so none of them is beamed. A tool is lit, or its
  menu item ticked, when every selected note that can take one has it;
  pressing it then puts them all back to Automatic.

## When an override drops (Q12)

An override drops when its note's own length changes (value, dot,
tuplet), when the note is written over, and when it is deleted. It stays
through fret, string and mark changes, the meter's re-spelling, a
grouping change, Insert, Ctrl/⌘+Delete, and cut or copy and paste, which
carry it with the note.

## Exports and what doesn't change (Q13)

- alphaTex as above; Guitar Pro carries both through alphaTex (alphaTab's
  writer keeps the bar's beam groups and each beat's beaming).
- MusicXML: the `<beam>` elements come from the same groups and
  overrides; the time signature stays `<beats>7</beats>`.
- ASCII tab has no beams: unchanged. PNG and SVG are as drawn.
- Playback and the metronome are unchanged (accents by group would fit
  issue #148).
- No Preference is added or removed; no key is added or changed.
- `public/tab-alphatex.txt` gains a short Beat groups and beams section;
  `public/skills/frets-tab/SKILL.md` one line on `\beaming` and
  `{beam split|merge}`.

## How

- `clip.ts`: `MasterBar.beatGroups?: number[]` (counts in the time
  signature's lower number) and `Column.beam?: 'break' | 'join'`, with
  their parsers; `beatGroupsAt(clip, bar)` gives a bar's groups in ticks.
- `alphatexRead.ts`: `\beaming` read onto the master bar, `{beam split}`
  and `{beam merge}` read onto the next Column's `beam`; `alphatex.ts`
  writes them back as above.
- `beams.ts`: `beamGroups` takes the bar's Beat groups and the overrides;
  `layout.ts` hands both on (in place of `beat` and `halfBars`), and
  `musicxml.ts` uses the same.
- `sounding.ts`, `rewrite.ts`, `timeline.ts`: the writer's `groupsOf`
  from the master bars; a Sounding note carries its start's `beam`, and
  a length change drops it.
- `barEdits.ts`: `setBeatGroups` (a time signature change with a
  grouping, re-written as Q5); `BarTimePanel.tsx`: the Beat groups field.
- `noteEdits.ts`: `setBeam` for a picked note or selection; `tools.ts`:
  the two tools, lit as Q8 and Q10; `TabPage.tsx`: the menu items.
- `editing_tests/`: add `beat-groups.atex` and `beam-overrides.atex`.

## Tests

`src/__tests__/tab/` (pure tests in `beams.test.ts` and next to it, page
tests in `page/`):

- Seven eighths in 7/8 are beamed 2+2+3, five in 5/8 3+2, six in 6/8
  3+3; fourteen sixteenths in 7/8 beam in fours, fours and six; eight
  eighths in 4/4 in two fours; six eighths in 3/4 and four in 2/4 in
  pairs; sixteenths in 4/4 by the beat.
- The Beat groups field shows for 5/8, 6/8, 7/8, 5/4 and 7/4, not for
  4/4, 3/4 or 2/4; it shows for a 4/4 bar read with `\beaming (8 3 3 2)`.
- Typing `3+2+2` in 7/8 bar 1's field beams its eighths 3+2+2 in every
  bar to the next time signature, and writes `\beaming (8 3 2 2)`;
  `2+2+2` gives a ⚠ whose tip is "Adds up to 6; the bar has 7", keeps the
  text and changes nothing; a double-click puts back `2+2+3` and removes
  `\beaming`.
- In a run of 7/8, typing `3+2+2` in bar 3's panel adds a 7/8 change
  there that is drawn; "Remove the change" takes it away; setting it back
  to `2+2+3` takes the change away too.
- A quarter starting on the third eighth of 7/8 is one quarter as 2+2+3
  and two tied eighths as 3+2+2 (split where the groups meet), in every
  Track; Undo restores it in one step.
- A 7/8 grouping followed by a 4/4 change writes the 4/4 bar's default
  `\beaming` too; alphaTex in and out of both is unchanged.
- `\beaming (16 6 4 4)` in 7/8 reads as 3+2+2; `\beaming (8 2 2 2)` in
  7/8 is kept as written and the bar beamed 2+2+3.
- Break on the third of four eighths in a 4/4 half bar draws two beams of
  two and writes `{beam split}` on the second; Join on the first eighth of
  beat 2 in 3/4 joins it to beat 1's pair and writes `{beam merge}` on
  the note before.
- Join after a rest, after a grace note or on a bar's first note, and
  either tool on a quarter, leave the Clip unchanged and light nothing.
- The tools light for the picked note's override; pressing the lit one
  makes it Automatic, the other switches. The menu shows both items,
  ticked as set, on an eighth and neither on a quarter or a rest.
- Join on four selected eighths across beats 1 and 2 of 3/4 makes one
  beam; Break on them unbeams all four; pressing the lit tool again puts
  all back to Automatic.
- An override survives a fret change, Insert before it, a grouping change
  and copy and paste; it drops when the note's length or dot changes and
  when the note is written over. Deleting the note before a Join leaves
  the Join on the note, drawing no beam over the rest.
- MusicXML of a 7/8 bar in 2+2+3 and of a Break and a Join has beams in
  the same groups as drawn; Guitar Pro of the same writes the bar's beam
  groups and the beats' beaming.
