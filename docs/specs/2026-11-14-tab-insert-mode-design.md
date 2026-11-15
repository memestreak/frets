# Tab: Insert mode

Issue #482, phase 2 (Jeremy, 2026-11-14). While transcribing, a 16th
missed four bars back means reworking every bar after it, because the
only way to add time without writing over music is the Insert key (a
Gap). Insert mode is Dorico's toggle: while it is on, entering a note, a
longer note, a dot and paste push the music after them later, and
Delete, a shorter note and cut pull it back, with no Gap left. Phase 1
was Re-bar by time signature on import
(`2026-11-14-tab-rebar-import-design.md`). Phase 3 adds Anchors, which
stop a push. Until then **every push and pull runs to the clip's end**,
as the Insert key's does.

Words used here, from `GLOSSARY.md`: Note input mode, Normal mode, Input
length, Gap, Voice, Active voice, Track, Tie chain, Sounding note, Column
Mark, Bar Mark. New: **Insert mode** (avoid "ripple mode", "insert
method") and **Overwrite**, its opposite and the default. Neither is in
the glossary yet (the PR says so).

Principles: P1 (bars always full) stays. P2 and A11 in
`docs/tab-editing-principles.md` are rewritten to cover Insert mode.

## What the person sees

### Turning it on and off

- **I** turns Insert mode on and off, as Dorico's I does, on the tab and
  anywhere else on the page but a field, a dialog or a menu (as N does
  for note input mode).
- The **Insert mode** button sits in the Notes palette's Input group,
  after the pencil and the Grid button (the Grid stays right after the
  pencil, issue #449). It is lit while Insert mode is on, and its tip
  names I.
- While it is on, the cursor has **▼ ▲ notches**, one above its Column
  and one below, as Dorico's caret does, in both note input mode and
  normal mode, on the tab and on the staff. Over a staff they go round the
  notes that reach past its lines, so a high or low note never hides them.
  The editor's label for screen
  readers ends "Insert mode: entries push the music after them on, Delete
  pulls it back; I to turn it off".
- It works the same in note input mode and normal mode, as Dorico's does.
  Going in and out of note input mode leaves it as it is.
- **Every visit starts in Overwrite.** It is not a Preference, and it is
  not saved, as note input mode isn't (Jeremy, 2026-11-14, Q4).
- **Let ring moves to Alt+I**, read by the key's place, as Tap went to
  Alt+T when T became Tie (Jeremy, 2026-11-14, Q3). The `?` overlay and
  the tool's tip say so.

### What pushes

Each push puts a Gap in at a time and moves everything after it later, in
**every Voice of the Track** (the Active voice and the others it
carries), by the time the edit adds. Other Tracks don't move: they keep
their Columns, and get bars of rests at the end if this Track grows.
Bars are laid out again by the meter, so notes that cross a bar line are
split and tied (P1, P5). A note of another Voice that the push's time falls
inside is cut in two, as the Insert key cuts it: its first part, the Gap,
then the rest of it played again (Voice 2's half note under a quarter
pushed an 8th: `0.6.4 r.8 0.6.8 -.6.8`).

- **A fret typed** in note input mode, on a rest or on a string with a
  note: room for a note of the Input length is made at the caret, then the
  note goes in it. On a note of a Tie chain the room is made before the
  chain.
- **A letter or Enter on the staff** caret: the same, at the caret.
- **`,`** in note input mode: a Gap of the Input length, the music after
  it pushed on, the caret past it.
- **T** in note input mode (a tied note after the caret's): room for the
  tied note first.
- **The Chords panel's Insert** in note input mode: room for its Column
  first.
- **A longer note** (=, W, +), a length set (a digit, Shift and a digit's
  key, a Duration button) and **a dot** (.): the music after the note (or
  the selection's last Column) moves later by what it adds. In Insert
  mode a length changes only the Active voice's notes, and every Voice
  moves with them.
- **Paste** is Insert paste: the copy goes in before the cursor, the
  music after it pushed on.
- **Tuplet entry**: the first note of a new tuplet makes room for the
  tuplet's whole time; the notes typed into its Gap after that push
  nothing.

What doesn't push, and goes in as in Overwrite:

- **A fret on an empty string of a Column that has notes**, with the
  caret at its start: it joins the chord. That is how chords are typed on
  the tab, since the caret stays on a fret typed.
- **A fret typed again straight away** on the note the last fret went
  into, before any other key: it retypes that note, as two digits make a
  two-digit fret. ↑ ↓ or any other key ends this.
- **Enter on the staff at a pitch the caret's Column already sounds**: it
  takes that note away, as in Overwrite.
- **Inside a tuplet**, and with **Grace entry** on: no time can be put in a
  tuplet, and a grace note takes none.
- Normal mode's ↑ ↓ (pitch) and the palette's marks change no time, so
  they work as always.

### Moving in time

Alt+← → and a sideways drag (`2026-11-13-tab-move-in-time-design.md`)
write nothing over in Insert mode (Jeremy, 2026-11-15):

- **Later** (Alt+→, a drag right): a Gap of the step goes in before the
  picked note, chord or selection, so it and all the music after it move
  on in every Voice of the Track. With `5 7 5 7 |` and the first 5 picked,
  Alt+→ gives `r.4 5 7 5 | 7 …`: nothing is lost.
- **Earlier** (Alt+←, a drag left): the time before it is taken out,
  pulling it and the music after it back, but only when that time is
  quiet in every Voice (rests and Gaps, with no note sounding into it and
  no mark on them). Over a note, or before the clip's start, nothing
  moves, as a move that can't be made does today.
- The whole Column moves, a note picked alone too, since the time is the
  Track's. A rest alone, a grace note and a note in a tuplet don't move,
  as in Overwrite; a push that would put a tuplet across a bar line is
  refused.
- As with Delete, a pull leaves the bars it empties at the end: Alt+→ then
  Alt+← gives the music back, with a bar of rest after it.

### What pulls

- **Delete** (and Backspace, and `,` in normal mode) takes the time away,
  as Ctrl/⌘+Delete does: a selection, a rest, a Column picked whole, a
  note that is the only note in its Column (its whole Tie chain), and
  off the tab the Column before the playback line. The music after it is
  pulled back in every Voice, and a Gap opens at the end of the clip's
  last bar, as Ctrl/⌘+Delete leaves it. No bar comes off the end.
- **One note of a chord** goes alone and pulls nothing, as the chord's
  other notes keep the time. A grace note goes as always.
- **A shorter note** (−, Q, a shorter value): the music after it is pulled
  back by what it loses, so no Gap is left after it.
- **Cut** copies, then takes the time away, as Delete does.
- A pull takes that time from every Voice of the Track: what another Voice
  has in that stretch goes with it, as with Ctrl/⌘+Delete.

### At the clip's end

- A push past the clip's end adds bars for the notes it moves there. The
  Gap at the end isn't music, so **no bar of rests is added for it**: in a
  new empty arrangement, typing in Insert mode gives the same bars as
  Overwrite (the Whole-bar rest is not pushed into a second bar).
- With no Anchor yet, nothing stops a push, so a note typed in bar 9 also
  moves bar 13 and everything after it. Phase 3's Anchors stop it.

### When a push is refused

- A push that would carry a tuplet across a bar line is refused, and the
  line under the clip says "That would put a tuplet across a bar line.",
  as the Insert key's does today. Nothing changes. The Gap before the
  tuplet doesn't absorb it (issue Q5): that waits for Anchors, where Gaps
  absorb pushes.
- A length change refused this way changes nothing, as in Overwrite.

### Bar Marks stay, Column Marks move

A push moves Columns, so what sits on a Column moves with its notes:
chord names, Text, Lyrics, dynamics and the marks on notes. Bar Marks
(section, tempo, repeats, endings, double bar, key and time signature)
stay on their bar, as the Insert key leaves them, but for a paste of whole
bars at a bar line: it keeps its key, meter and tempo, the bars it slides
on keep theirs and slide on with their labels
(`2026-11-15-tab-paste-keeps-key-meter-tempo-design.md`).

### The example (the issue's bars 9 to 13, without the Anchor)

4/4, one string. In Insert mode, with the caret on bar 9's beat 2 and the
Input length a 16th, 9 gives: everything from beat 2 a 16th later, the 7
at the end of bar 9 tied into bar 10, each bar after starting with the
tied-on 16th, bar 12's dotted half and quarter rest a 16th later, and bar
13's 0 a 16th late (phase 3's Anchor would stop the push at bar 13, the
rest absorbing it). In Overwrite the same keys write the 9 over the 7's
first 16th, the rest of it a Gap, and nothing moves.

## What the others do

| | Insert mode | Its key | What moves | Its look |
|---|---|---|---|---|
| Frets | A toggle, in note input mode and normal mode | I (Let ring to Alt+I) | Every Voice of the Track; bars re-laid by the meter | Lit button, ▼ ▲ notches on the cursor |
| Dorico Pro 6 | A toggle, in note input and selections | I | By scope: Player (the default), Voice, or Global; up to the stop position | Lit button; the caret's notches; the stop position a red line |
| MuseScore 4 | Insert is a note input method picked from the Note input button's menu; Ctrl/⌘+Shift+note inserts one note | None by default | The bar grows, irregular (+/− over it); not re-barred | The Note input button shows the method |
| Guitar Pro 8 | None; Insert / Delete a Beat only | Insert | The beat; the bar runs over, drawn red | — |

Frets follows Dorico (ADR `2026-11-05-tab-editing-follows-dorico-musescore-gp8`):
its key, both modes, the Player scope (every Voice of the Track), and the
caret's notches. Like Dorico and unlike MuseScore, no bar is ever short or
overfull (P1).

## Tests

- I turns Insert mode on and off in normal mode and note input mode; the
  Insert mode button's `aria-pressed` follows it, the cursor has the
  notches (`insert-notches`) only while it is on, and the editor's label
  says so. Going in and out of note input mode leaves it on.
- On the staff, the notches go round a high E two octaves up and a low E
  under the staff: their span is more than the staff's own.
- The button sits in the Input group after the pencil and the Grid, its
  tip ending "(I)"; pressing it does what I does. A fresh page starts with
  it off.
- I alone puts no let ring on; Alt+I (code `KeyI`) does. The `?` overlay
  lists I as "Insert mode on or off…" and Let ring as Alt+I.
- The issue's example (bars 1–5 here): a 16th 9 on bar 1 beat 2 gives
  `5.1.4 9.1.16 7.1.16 -.1.8 -.1.16 5.1.16 -.1.8 -.1.16 7.1.16 -.1.8 |`
  then each later bar starting with its tied-on 16th, bar 4
  `-.1.16 5.1.16 -.1.8 -.1.4 -.1.4 -.1.16 r.16 r.8 |`, bar 5
  `r.16 0.1.16 -.1.8 -.1.16 r.16 r.8 r.2 |`; one undo step undoes it all.
- Overwrite, the same keys: bar 1 `5.1.4 9.1.16 r.16 r.8 5.1.4 7.1.4 |`,
  every other bar unchanged.
- A fret typed straight away on the note just entered retypes it (no
  second push); ↓ then a fret on the empty string joins the chord, no push.
- A new empty arrangement, note input mode, I, then 5 → 7 → 8: `5.1.4
  7.1.4 8.1.4 r.4 |`, one bar.
- `,` with an 8th Input length on the 7 of `5.1.4 7.1.4 5.1.4 7.1.4 |`:
  `5.1.4 r.8 7.1.8 -.1.8 5.1.4 7.1.8 | -.1.8 r.8 r.4 r.2 |`.
- Voice 2 moves with Voice 1, and a chord name and a Text move with their
  notes.
- On the staff, C then D with an 8th Input length go in before the 7, the
  caret going on with the music.
- T in note input mode makes room for the tied note.
- Tuplet entry: the first note of a triplet makes room for its quarter;
  the next note goes in its Gap and pushes nothing.
- Two Tracks: a push in the first leaves the second's Columns as they
  were (bars of rests added at its end); a section and a tempo stay on
  their bar.
- A push that would put a tuplet across a bar line: refused, the line
  under the clip says "That would put a tuplet across a bar line.", the
  Clip unchanged.
- Normal mode: = on a quarter pushes, − twice pulls back, . pushes a dot's
  worth; Shift and a digit's key pushes; a two-note selection made longer
  pushes by both notes' extra; the Overwrite results are as before.
- Alt+→ on the first 5 of `5.1.4 7.1.4 5.1.4 7.1.4 |` twice over gives
  `r.4 5.1.4 7.1.4 5.1.4 |`, `7.1.4 5.1.4 7.1.4 5.1.4 |`, `7.1.4 r.4 r.2 |`;
  Alt+← brings it back (with `r.1 |` after it); out of Insert mode Alt+→
  writes it over the 7 (`r.4 5.1.4 5.1.4 7.1.4 |`).
- `shiftInTime`: later keeps the cursor and a selection on the same notes;
  earlier over rests pulls back (an 8th: `r.4 r.8 5.1.8 -.1.8 7.1.4 r.8 |`),
  and is refused over a note, another Voice's note or the clip's start; a
  rest alone doesn't move.
- Paste is Insert paste; Delete on a lone note pulls back and leaves a
  Gap at the end; Delete on one note of a chord takes only it; cut takes
  the time. Out of Insert mode Delete leaves rests as before.
- `deleteTakesTime`: yes for a lone note, a rest, a Column picked whole
  and a selection; no for one note of a chord, a grace note, and a Tie
  chain one of whose Columns holds another note.
- `withoutAddedRests` drops the rest-only bars a push added at the end,
  never one that was there, and keeps an added bar with a note or a mark.

## How

- `useEditorState.ts`: `insertMode` (React state, never saved).
- `editorKeys.ts`: I in `spaceOrNKeyDown`; `deleteAtCursor` takes the time
  when `deleteTakesTime` says; the length keys and digits pass `insert`;
  `restKey` and `writeAtInput` make room first; `lineKeyDown` takes
  `insertMode` for Delete off the tab.
- `noteInputModeKeys.ts`: `fretKey` and `enterAtCaret` work on the editor
  `fretEditor` / `staffEditor` give, with room made.
- `insertMode.ts` (new): `withRoom` (an `insertTime` on the editor's
  clip, the caret on the Gap, rest-only bars added at the end dropped),
  `fretEditor`, `staffEditor`, `restEditor`, `deleteTakesTime`.
- `noteEdits.ts`: `changeLength` takes `insert`; `writeLength` pushes at
  the old end by what the change adds before writing, or pulls the Gap it
  leaves after. `stepDuration`, `setValue`, `cycleDots` and `applyTool`
  pass it on (`isLengthTool`).
- `ties.ts`: `tieOnInput` takes `insert`.
- `timeMoves.ts`: `shiftInTime`, Insert mode's move (`pushTime` later,
  `pullTime` earlier over quiet time), used by Alt+← → (`editorKeys.ts`)
  and the drag (`useTabPicking.ts`).
- `timeline.ts`: `withoutAddedRests`.
- `TabPage.tsx`: paste is Insert paste in Insert mode, cut takes the time,
  the palette's length tools skip the every-Voice edit, `highlight.insert`,
  the editor's label. `usePageKeys.ts`: I off the tab. `TabPalette.tsx`:
  the button. `TabClip.tsx`: the notches, over the staff's `above` and
  under its `below` (`rows.ts`).
- `tools.ts`: Let ring on Alt+I. `shortcuts.ts`: I.
- The test arrangement `editing_tests/insert-mode.atex`; the how-to
  `let-ring-and-palm-mute.atex` names Alt+I.

## Sources

- Dorico Pro 6.2:
  [Insert mode](https://www.steinberg.help/r/dorico-pro/6.2/en/dorico/topics/write_mode/write_mode_insert_mode/write_mode_insert_mode_c.html),
  [scopes](https://www.steinberg.help/r/dorico-pro/6.2/en/dorico/topics/write_mode/write_mode_insert_mode/write_mode_insert_mode_scope_r.html),
  [caret](https://www.steinberg.help/r/dorico-pro/6.2/en/dorico/topics/write_mode/write_mode_caret/write_mode_caret_r.html)
- MuseScore 4:
  [alternative note input methods](https://handbook.musescore.org/basics/alternative-note-input-methods)
- Guitar Pro 8: [bars](https://www.guitar-pro.com/docs/gp8/score/bars),
  [note input](https://www.guitar-pro.com/docs/gp8/score/note/note-input)
