# Tab: every Voice drawn, exported and edited

Step 9 of the build order in the Tab editing principles
(`docs/tab-editing-principles.md`, choice A2, with P13
and §11; the last step). Jeremy settled the questions below on
2026-11-04 (Q1–Q22 in the thread "Build Tab editor step 9: voices", run
with /grill-with-docs; the rounds, with what Dorico, MuseScore and Guitar
Pro 8 do for each, are on the page
https://claude.ai/artifact/6XRm5ES6RKjtMZAkfUbvDb).

Step 2 (`2026-11-03-tab-voices-design.md`) put up to four Voices in each
Track, read and written as alphaTex `\voice`, and played them all, but
drew and edited Voice 1 only. This step draws every Voice, carries them
into every export, and edits any Voice, one at a time: the Active voice.

**Music with one Voice is unchanged**: its drawing, editing and every
export stay as they are.

## The Part stays one Voice (Q1)

`docs/adr/2026-11-03-part-is-one-voice.md` stands. Edits keep working on
one Voice's Part; an edit on a selection that covers several Voices runs
Voice by Voice and commits once. Only layout and drawing see every Voice
at once. The ADR gains a line saying so.

## Laying out several Voices (Q1)

Every Voice of a bar is laid out on one time line: a spot for each
moment any present Voice starts a note or a rest, each spot as wide as
the shortest length starting there needs (and its widest note), so notes
that sound together line up, on the staff and on the tab. A bar with
only Voice 1 is laid out as now.

## The staff (Q2, Q3)

- In a bar where two or more Voices are present, Voices 1 and 3 stem up
  and Voices 2 and 4 stem down. In a bar with only Voice 1, stems go by
  pitch, as now.
- Each Voice beams by itself, by the Beat groups and its own Beam
  overrides.
- Rests: a present Voice's Gaps are drawn as rests, as Voice 1's are
  (Q3). In a bar with two or more Voices, the up-stem Voices' rests move
  up and the down-stem Voices' down, clear of the other's notes. An
  absent Voice draws nothing; a Whole-bar rest is drawn only for Voice 1.
- Ties, tuplet brackets and staff articulations go on each Voice's stem
  side.
- Note heads a second apart at the same time sit side by side, the
  up-stem one on the right. The same pitch in two Voices (on two
  strings) shares one head when both heads are the same kind (both black
  or both white); otherwise they sit side by side.

## The tab (Q4, Q13)

- Every Voice's frets go on the tab at their time; Voices starting at
  the same moment share one column.
- With the staff off (the tab carries the rhythm): in a bar where two
  Voices are present, Voice 1's stems, beams and rests go above the tab
  and Voice 2's below, as fingerstyle tab books print them; Voice 3 goes
  with Voice 1 and Voice 4 with Voice 2. A bar with only Voice 1 keeps
  its stems below the tab, as now. With the staff on, the tab carries no
  stems, as now.
- Words over a column (chord names, text) belong to the Column they were
  put on, in whichever Voice, and are drawn at its time in the rows they
  use now. Spans (let ring, P.M., vibrato, octave lines, hairpins) on
  another Voice's notes are drawn in the same rows, one Span per Voice's
  run.

## The Active voice (Q5–Q7, Q22)

- The **Active voice** (`GLOSSARY.md`) is the Voice the cursor types into
  and the Voice-by-Voice edits act on.
- The Rail's Notes panel gets a **Voice** row: four buttons, 1 2 3 4, the
  Active voice lit (`aria-pressed`). A button makes that Voice active at
  the cursor's time. Its tip names the key ("Voice 2 (Alt+2)"); where the
  Voice has no notes at the cursor, the tip adds "type to add notes in
  it" (Q17).
- The cursor shows a small number for the Active voice beside it ("2")
  when it isn't Voice 1.
- A press on a note, rest or Mark of any Voice picks it and makes its
  Voice active. Note input mode starts in the Active voice.
- When the cursor leaves the tab (Esc, or a press elsewhere), the Active
  voice goes back to Voice 1.
- **The other Voices muted (Q6 b, Q22):** while the cursor or a pick is
  on the tab, in normal mode and in note input mode, on the staff and on the
  tab, the Active voice's notes, rests and Marks are drawn in ink and
  the other Voices' in `--line-strong` (lighter than `--ink-muted`).
  Notes selected in other Voices are still drawn selected, in
  `--select`. With nothing on the tab every Voice is in ink. Exports, PNG and SVG are always in ink. A clip with
  one Voice never mutes anything.

## Keys (Q8, Q17)

- **Alt+1–4**: with nothing picked or selected, or in note input mode, make
  that Voice active at the cursor's time (the cursor moves to the same
  time in it, as `cursorAtTime` places it). With notes picked or
  selected in normal mode, move them into that Voice (below).
- V stays Vibrato. There is no Shift+V and no other way to create a
  Voice: making an absent Voice active and typing creates it (Q17).
- The `?` overlay lists Alt+1–4 under "Note input mode" ("Make voice 1–4
  active") and under "Selected notes and rests" ("Move to voice 1–4").

## Typing into an absent Voice (Q9)

In a bar where the Active voice is absent, the cursor and the Grid move
through the bar as through an empty bar, with nothing drawn. The first
note typed makes the Voice present in that bar, its Gaps drawn as rests.
Taking away its last note in a bar makes it absent there again, rests
and all. Voice 3 may be present where Voice 2 isn't.

## Two Voices on one string (Q10)

An edit that would sound a string while another Voice is still sounding
it there (typing a fret, a drag to another string, a move into a Voice,
a paste, a longer length, a tie) does nothing, and the line under the
clip says "String 2 is sounding in voice 1 there." (strings numbered as
tab numbers them, 1 the high e). An edit on a selection is refused whole.
A clash that came in with an import still shows step 2's "Bar 3 has two
voices on string 2."

## Moving notes into another Voice (Q11)

Alt+1–4 on picked or selected notes, or the right-click menu's
"Move to voice ›" 1–4:

- the notes go, whole Tie chains and all, leaving a Gap in their Voice;
- they write over the same time in the other Voice, as a paste does,
  bars staying full in both;
- their Marks and joins go with them; a join to a note left behind is
  dropped;
- the notes stay picked or selected, now in the new Voice, which becomes
  active;
- one undo step; a string clash refuses it (Q10).

## Selections (Q12, Q18–Q21, as Dorico)

- A press picks one note, in its Voice.
- A selection (Shift+← →, a drag, Shift+drag, Shift+press, Ctrl/⌘+A)
  covers every Voice's notes in its time, all drawn selected. Shift+← →
  grow it by the Active voice's columns.
- **On every Voice of a selection** (Q19), Voice by Voice, as one undo
  step: Delete, cut, copy, paste, the Marks (the palette's techniques and
  articulations), the length keys (each Voice's run laid out again from
  its start, A8) and Alt+1–4.
- **On the Active voice only:** ties (T), tuplets (;), grace notes (/)
  and the Beam overrides.
- **Copy and paste (Q20):** copy writes every Voice of the selection
  (alphaTex with `\voice`). Paste puts each copied Voice into the same
  Voice from the cursor's time, writing over and keeping bars full;
  Insert paste pushes every Voice. A paste that would put two Voices on
  one string does nothing (Q10). Step 2's "Pasted voice 1 only." goes.
- **Select only voice (Q21):** the right-click menu on a selection has
  "Select only voice ›" 1–4: the selection keeps that Voice's notes, and
  that Voice becomes active.
- Insert and Ctrl/⌘+Delete push and pull every Voice, as now.
- Ctrl/⌘+Alt+← → visit every Voice's notes and Marks by time, Voice 1 first at
  the same time (Q13).

## Exports (Q14)

- **PNG and SVG:** as drawn, in ink.
- **ASCII tab:** every Voice's frets on the one tab at their times; a
  moment where two Voices start shares one column. Reading ASCII stays
  one Voice.
- **MusicXML:** the staff's Voices as `<voice>` 1–4, with `<backup>`
  between them, and the tab staff's as 5–8; stems and rests placed as
  drawn.
- **alphaTex and Guitar Pro:** unchanged (they carry every Voice
  already).
- The export dialog's "Voice 1 only; other voices aren't in this format
  yet." goes.

## Under the clip and on import (Q15)

"Bars 3–8 have a second voice, not drawn yet." and its "more voices"
form go, under the clip and on import. "Bar 3 has two voices on string
2." and "Bar 4's voice 2 doesn't add up to 4/4: 1 beat short." stay.

## Knock-on work (Q16)

- `GLOSSARY.md`: Active voice.
- `docs/adr/2026-11-03-part-is-one-voice.md`: a line saying step 9 kept
  it (layout sees every Voice; selections run Voice by Voice).
- `shortcuts.ts`: Alt+1–4 (above).
- `editing_tests/`: `voices-drawn.atex` (a bass under a melody: stems,
  rests, shared heads, tab stems with the staff off), `voice-typing.atex`
  (Alt+2, typing into an absent Voice, taking its last note away),
  `voice-move.atex` (Alt+2 on a selection, a string clash refused,
  Select only voice).
- A built-in arrangement with `\voice`, so the round-trip tests cover a
  drawn second Voice.
- `public/tab-alphatex.txt` and `public/skills/frets-tab/SKILL.md`: the
  page draws every Voice; "give held notes as ties in voice 1 where you
  can" and "Frets draws only voice 1 for now" go; a bass held under a
  melody goes in Voice 2.
- No Preference is added or removed.
- All in this one PR.

## How

- `layout.ts`: `layoutClip` places every present Voice's Columns on the
  bar's shared time line (spots by start time); `PlacedColumn` gains
  `voice`, and a `PlacedBar` holds every Voice's placed columns, the
  Part's own Voice still in `columns` order for the edits' indexes.
- `staffGeometry.ts` / `StaffDrawing.tsx`: stem direction per Voice in a
  bar with several, beams per Voice, rests moved up or down, shared and
  side-by-side heads, ties, brackets and articulations on the stem side.
- `TabStems.tsx`: Voice 1 above and Voice 2 below in a bar with two.
- `TabClip.tsx` / `TabColumn.tsx`: every Voice's frets; the muted Voices
  (`tabLook.ts` gains the muted ink); the Active voice's number beside
  the cursor.
- `hitTest.ts`, `marks.ts`, `elements.ts`, `attachment.ts`: a hit says
  its Voice; Ctrl/⌘+Alt+← → by time across Voices.
- `useEditorState.ts`: the Active voice (`voice`, from 0), reset to 0
  when the cursor leaves the tab; `partOf(clip, track, voice)` for it.
- `voices.ts` (new): moving notes into another Voice (`moveToVoice`),
  the string clash check (`clashAt`), a selection's notes per Voice,
  and running an edit Voice by Voice (`perVoice`).
- `editorKeys.ts`: Alt+1–4. `TabRail.tsx`: the Voice row. `TabPage.tsx`:
  the menu's "Move to voice ›" and "Select only voice ›", the refusal
  line, the paste notice going.
- `editing.ts` / `alphatex.ts`: copy writes every selected Voice
  (`sliceClip` keeps them); paste puts each into its own Voice.
- `ascii.ts`, `musicxml.ts`: every Voice. `TabExportDialog.tsx`: the ⚠
  goes. `clip.ts`: `hiddenVoicesMessage` goes; `alphatexRead.ts`: the
  "not drawn yet" warnings go.

## Tests

`src/__tests__/tab/voicesDrawn.test.ts` (layout, drawing, exports, the
pure edits) and `src/__tests__/tab/page/voicesEdited.test.tsx` (the
page), with the existing round trips:

- A one-Voice clip lays out, draws and exports exactly as before (every
  built-in arrangement's layout and exports unchanged).
- Layout: a Voice 1 half note over Voice 2 quarters gives two spots,
  the second at Voice 2's second quarter; notes starting together share
  an x.
- Staff: in a two-Voice bar Voice 1 stems up and Voice 2 down; in a
  bar with Voice 1 alone stems go by pitch; Voices 3 and 4 stem up and
  down.
- Staff: Voice 2's rests sit lower and Voice 1's higher in a two-Voice
  bar; an absent Voice draws no rest; a Whole-bar rest only for Voice 1.
- Staff: heads a second apart sit side by side, the up-stem one right;
  the same pitch in two Voices with both black heads shares one head; a
  white and a black head sit side by side.
- Tab with the staff off: in a two-Voice bar Voice 1's stems are above
  the tab and Voice 2's below; a Voice 1-only bar's stems stay below.
- The page: the Voice row lights the Active voice; Alt+2 lights 2 and
  shows "2" by the cursor; Esc puts it back to 1.
- The page: a press on a Voice 2 note makes Voice 2 active.
- The page: with the cursor on the tab the other Voice's numbers are
  drawn in `--line-strong`; with nothing on the tab they are in ink; a PNG
  or SVG export is all ink; a one-Voice clip mutes nothing.
- The page: typing in an absent Voice 2 creates it with its rests;
  deleting its last note makes it absent again.
- Clash: typing on a string Voice 1 is sounding refuses it and says
  "String 2 is sounding in voice 1 there."; a move or a paste that would
  clash is refused whole.
- Move: Alt+2 on selected Voice 1 notes leaves a Gap in Voice 1, writes
  over Voice 2 at the same time, keeps a Tie chain whole, drops a join
  to a note left behind, leaves them selected in Voice 2; one undo step.
- Selection: Shift+→ over a two-Voice bar selects both Voices' notes;
  Delete makes rests in both; the length keys lay out each Voice's run;
  T, ; and / act on the Active voice only.
- Copy and paste: copying two Voices writes `\voice`; pasting puts each
  back in its own Voice; the "Pasted voice 1 only." notice is gone.
- Select only voice 2 keeps Voice 2's notes and makes it active.
- Ctrl/⌘+Alt+← → visit Voice 1's note, then Voice 2's at the same time.
- ASCII: a two-Voice bar writes both Voices' frets, sharing a column
  where they start together.
- MusicXML: a two-Voice bar has `<voice>1</voice>`, a `<backup>`, then
  `<voice>2</voice>`, stems up then down; the tab staff's are 5 and 6.
- The export dialog shows no "Voice 1 only" ⚠.
- The "not drawn yet" sentences are gone from the line under the clip
  and the import warnings; the string clash and short-voice sentences
  stay.
- The `?` overlay lists Alt+1–4 in both groups.

## Settled while building

- **Accidentals are worked out Voice by Voice** in a bar, as Dorico and
  MuseScore do; where Voices start together their heads still line up,
  each Voice leaving room for the widest accidental at that moment.
- **One copied Voice pastes into the Active voice.** A selection whose
  notes are all in one Voice is copied as plain alphaTex (no `\voice`),
  so it pastes wherever the cursor's Voice is; two or more Voices keep
  their numbers (Q20).
- **Alt+3 is Move to voice 3**, no longer one of the keys that do
  nothing on a selection (step 6's test is changed to match).
- **The Bend, Ottava and Whammy panels act on the Active voice only**,
  as the ties and tuplets do: each is set on one note or run.
- **Delete with the cursor off the tab** (on the playback line) acts on
  the Active voice only, since there is no selection to cover the
  other Voices.
- **The built-in with `\voice` is the `voices-drawn` editing test**, so
  the round-trip tests read and write a drawn second Voice; no song
  arrangement was added.
- **A Select only voice selection lapses after an edit**: the next
  selection covers every Voice again.
- **A right-click inside the selection keeps it** for the menu, as
  Dorico, MuseScore and GP8 do; outside it, it picks what it lands on,
  as before. Without this the menu's Move to voice and Select only voice
  could only be reached on a selection from the keys (Shift+F10).
- **Menus light one item at a time:** a hover moves the keys' focus to
  the item, an open submenu keeps its item lit, and a hover on a plain
  item shuts the submenu.
- **Moving a note into a Voice that has a note there writes over it**,
  as a paste does (Q11): moving Voice 1's first quarter into a Voice 2
  that holds a half note there leaves Voice 2 a quarter and a rest.
