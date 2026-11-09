# Tab: strums and rolled chords

Asked 2026-11-09 (Jeremy): "Let's add palette buttons for strum and
rolled chords", which is issue #384 (draw and edit `bd`/`bu`/`ad`/`au`).
Frets read these alphaTex beat properties but only kept them as written
("Kept but not drawn yet"), so they played (issue #385 sets how much they
roll) but couldn't be seen or edited.

Editing follows Dorico first (`docs/tab-editing-principles.md`).

## What

- **What they are.** A Column's Strum (alphaTex `bd` strum down, `bu`
  strum up) or Rolled chord (`ad` down, `au` up): one or the other,
  since alphaTab keeps one per beat. "Down" starts on the low string, as
  alphaTab plays it and Guitar Pro names it. A length written in ticks
  (`bd 60`) is kept and played as written; without one, Settings ›
  Playback sets it (issue #385). A Pick stroke (⊓ / V) is separate and
  can stand on the same chord (`{sd bd}`).
- **Drawn.** A vertical sign left of the chord, from its highest note to
  its lowest and a little past, with an arrowhead at the end the roll
  finishes on: straight for a Strum, wavy for a Rolled chord. A roll
  down points up, toward the high strings, on the staff and the tab
  alike. This is how alphaTab and Guitar Pro 8 draw them ("Stroke" and
  "Arpeggio"), and how Dorico and MuseScore draw an arpeggio sign with an
  arrowhead (MuseScore's "straight arpeggio" is the straight one).
  Beside a single note the sign is still drawn 20 units long.
  - **On the staff and the tab.** alphaTab and Guitar Pro draw a Strum on
    the tab only; Frets draws both signs on whatever is shown (left of
    the heads and their accidentals, and left of the numbers), so a
    Strum still shows in Staff view.
  - **Room.** A column with a sign is 14 units wider, the room left of
    its notes, so the sign never touches the column before.
- **Entered.** Four buttons in Articulations › Techniques, after Down
  stroke and Up stroke, each drawn as its sign beside three numbers:
  "Strum down: low string first", "Strum up: high string first",
  "Rolled chord down: low string first", "Rolled chord up: high string
  first". A button puts its sign on the cursor's column or the
  selection's columns, in place of any other Strum or Rolled chord (and
  of one kept as written); pressed again on a column that has it, it
  takes it away. A rest has no strings to roll, so a button leaves rests
  as they are. A button lights while the cursor's column has its sign.
  No keys yet: D and U are the Pick strokes.
- **Picked.** A press on a sign, on the staff or the tab, picks it,
  blue, and lights its button. Delete takes it away; right-click has
  Delete. A sign has nothing to edit, so it has no Edit.
- **Notes, not time.** A sign belongs to the chord's notes, as a Pick
  stroke does: deleting the notes takes it away; a split keeps it on the
  first piece.
- **Written.** As alphaTex `bd`, `bu`, `ad` or `au` after the Pick
  stroke, with the length when one was read (`bd 60`). Two on one beat,
  or a length that isn't a whole number of ticks, stay kept as written.
- **Exported.** MusicXML has no strum, so both write
  `<arpeggiate direction="up">` (low first) or `"down"` on each note of
  the chord. ASCII tab leaves them out.

## Tests

- `{bd}`, `{bu}`, `{ad}`, `{au}` read as `roll` `{ sign, direction }`
  with no "Kept" warning; `{bd 60}` reads with `length: 60`; `{bd au}`
  stays in `extra`.
- A clip with each writes `sd bd`, `bu`, `ad`, `au`, `bd 60` back, and
  reads back the same.
- The Strum down button puts `{ strum, down }` on the cursor's column and
  on every column of a selection; pressed again it takes it away; Rolled
  chord up on a column with a Strum replaces it; a kept `bd 60` in
  `extra` goes when a button sets one; a selection of a rest and a chord
  puts it on the chord only.
- `isOn`: Strum down lights for a column with a Strum down, not for a
  Strum up or a Rolled chord down.
- The sign: a roll down's arrowhead is at the top, a roll up's at the
  bottom; a Strum's line is straight, a Rolled chord's wavy; beside one
  note it is 20 long.
- Layout: a column with a sign is 14 wider than without, and its notes
  stand 14 further right, in Tab and in Both view.
- A press on the drawn sign picks `{ mark: 'roll' }`, on the tab and on
  the staff; `markTool` names its button; Delete (`removeMark`) takes it
  away.
- Deleting a column's notes takes its sign away.
- MusicXML: `<arpeggiate direction="up"/>` on each note of a Strum down.
- Playback: a written `bd 60` keeps its length whatever the settings.
- A built-in arrangement draws them and writes back exactly.

## How

- `clip.ts`: `Roll`, `Column.roll`, its check in `isColumn`.
- `alphatexRead.ts` (`rollOf`, in `beatReads`) and `alphatex.ts`
  (`rollTex`).
- `rollSign.ts`: the sign's shape (`rollSign`, `rollSpan`) and its place
  on the tab (`tabRollPlace`); `widths.ts` `ROLL_ROOM`, `rollRoom`;
  `layout.ts` moves the notes right of it.
- `ClipMarks.tsx` draws it on the tab, `staffMarks.ts` /
  `StaffDrawing.tsx` (`RollSign`) on the staff; `marks.ts` picks it
  (`DrawnMark` `roll`, `markTool`); `noteEdits.ts` `toggleRoll` and
  `removeMark`.
- `tools.ts`: the four tools; `TabPalette.tsx` their icons.
- `sounding.ts`: a point mark of the column; `rolls.ts` keeps a written
  length.
- `musicxml.ts`; `public/tab-alphatex.txt`; `GLOSSARY.md` (Strum, Rolled
  chord: drawn now).
