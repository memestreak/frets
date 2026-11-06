# Tab editing principles

The rulebook for how notes, rests, lengths, ties, beams, marks and Voices behave when you edit the
Tab page, with Dorico 5, MuseScore 4 and Guitar Pro 8 compared. Every Tab editing spec since
2026-11-03 cites this file: **P1–P14** are the principles below, **A1–A15** Jeremy's choices they
were built from. The ground rules and the order in which the other editors break ties are an ADR,
`docs/adr/2026-11-05-tab-editing-follows-dorico-musescore-gp8.md`.

Written 2026-11-02 and 2026-11-03 as a page outside the repo, then built in nine steps, one PR and
spec each (2026-11-03 to 2026-11-04, listed under [Build order](#build-order)). Moved here on
2026-11-05, when the page stopped being updated. Frets is described as of `9444da8` (step 9).

A change to how Tab editing behaves either follows these principles or changes one here, in the same
PR as its spec. A new principle takes the next number; a removed one keeps its number, struck
through, so old specs still read.

## Contents

- [The principles](#the-principles) (P1–P14)
- [The choices](#the-choices) (A1–A15)
- Topics, each with the rule and how the editors compare:
  [overwrite or insert](#1-editing-model-overwrite-or-insert),
  [note entry, input length and grid](#2-note-entry-input-length-and-grid),
  [rests](#3-rests-and-how-they-are-written),
  [full bars](#4-full-bars-and-filling-with-rests),
  [changing a note's length](#5-changing-a-notes-length),
  [ties](#6-ties-and-automatic-ties),
  [beams](#7-beams),
  [changes and their neighbours](#8-note-and-rest-changes-and-their-neighbours),
  [tuplets and grace notes](#9-tuplets-and-grace-notes),
  [delete, cut, paste](#10-delete-cut-paste-and-taking-time),
  [chords and voices](#11-chords-voices-and-one-length-per-column),
  [settings](#12-what-each-program-lets-you-configure)
- [Build order](#build-order)
- [Sources](#sources)

In the comparisons, **(m)** marks a claim checked in that program's manual, **(u)** one from how the
program is commonly known to behave, not checked in its manual: worth confirming in the app before
building on it. Each principle says which programs it agrees with: ✓ yes, ½ in part, ✗ no.

## The principles

**P1 · Bars are always full.** No edit makes a bar short or too long. Typing, length changes,
Delete, tuplets and grace notes all keep the bar's time. Adding or taking time (Insert, Insert
paste, Ctrl/⌘+Delete) pushes or pulls the following music across bar lines. A short first bar is a
Pickup bar set on purpose. (A10, A11)
✓ Dorico · ✓ MuseScore · ✗ Guitar Pro (bars run over)

**P2 · Write over by default.** Note input writes over what is at the cursor; nothing moves unless
the action says it adds or takes time. An Insert mode toggle may come later; nothing here blocks
it. (A11)
✓ Dorico · ✓ MuseScore · ✗ Guitar Pro

**P3 · Edit what sounds, store what is written.** Edits work on each Sounding note's start and
length; the Clip still stores written Columns. A Tie chain is one note while editing. After each
edit the bar is written out again by the meter. alphaTex, links and saves don't change. (A1;
`docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`)
✓ Dorico · ½ MuseScore (written notes) · ✗ Guitar Pro (written beats)

**P4 · Rests are gaps.** A rest is only the time between notes (a Gap), always written by the
meter. A rest's length can't be set. `,` in note input moves on and leaves a gap; in normal mode it
is Delete. An empty bar is one Whole-bar rest. (A3, A13)
✓ Dorico (without forced rests) · ½ MuseScore (rests are objects) · ✗ Guitar Pro

**P5 · Split by the meter.** Notes and rests are split and tied where bar lines and Beat groups
meet. Common syncopations stay whole. Every route that makes a note long (typing, length keys,
paste, drag) splits the same way. (A4)
✓ Dorico · ½ MuseScore (bar lines only) · ✗ Guitar Pro

**P6 · Beat groups from the time signature.** Frets picks the Beat groups; ambiguous meters can
change them per bar. The groups drive beams, splits and rests, saved as `\beaming`. In meters
counted in quarters, the groups split notes and rests but beams still go by the beat. (A5)
✓ Dorico · ✓ MuseScore · ½ Guitar Pro

**P7 · Longer writes over, shorter leaves a gap.** Changing the length of one note or a run keeps
its start and keeps the bar full. A run is laid out again in order from its start. Typing a fret on
a picked rest makes a note of that rest's length. (A8, A12)
✓ Dorico · ✓ MuseScore · ✗ Guitar Pro

**P8 · Ties go forward.** T ties the picked note to the next one on its string; in note input it
adds a tied note. Hand-made and automatic ties alike become one note for picking, Delete and
length. Each written note of a chain keeps its own marks (a bend held and pushed higher, a chord
name over a held note); Alt+press picks one for that. (A7; step 1 spec, Q1)
✓ Dorico · ✓ MuseScore · ✗ Guitar Pro (ties back)

**P9 · Beams follow the Beat groups, with overrides.** Automatic beams, plus Break before and Join
to previous per note (Beam overrides). Overrides belong to the arrangement and drop when the note's
length changes. Flat beams, never over rests. (A6)
✓ Dorico · ✓ MuseScore · ✓ Guitar Pro

**P10 · One pattern for tuplets and grace notes.** Normal mode applies them without moving time;
note input turns on a lit entry mode (Tuplet entry, Grace entry). A tuplet takes a note's span;
Grace adds a grace note before the picked note. (A9, A14)
✓ Dorico · ½ MuseScore (no entry toggles) · ✗ Guitar Pro

**P11 · Marks never move time.** Frets, strings, techniques and Marks never touch the notes around
them. Joins (tie, hammer-on, slide) stay true, as normalize keeps them.
✓ Dorico · ✓ MuseScore · ✓ Guitar Pro

**P12 · Two modes, one set of keys.** Normal mode picks and changes; note input enters. The length
keys mean the same in both. The Grid follows the Input length by default, or is fixed (Alt+G,
Alt+[ ]); Space always plays, Shift+Space moves on by the Input length. `=` and `−` make a note
longer and shorter, as Dorico's.
½ Dorico (Space moves the caret) · ✓ MuseScore · ½ Guitar Pro (no modes)

**P13 · Every Voice.** The Clip, alphaTex and the Sounding-note layer hold up to four Voices, one
length per Column per Voice. Every Voice is drawn, played and exported (ASCII merged, MusicXML
`<voice>`), and edited one at a time as the Active voice. (A2;
`docs/adr/2026-11-03-part-is-one-voice.md`)
✓ Dorico · ✓ MuseScore · ✓ Guitar Pro

**P14 · Every mark can be picked.** Every Mark, line and symbol in the notation can be picked on its
own: articulations, techniques, text, bar-line marks, ties and Spans such as let ring and palm mute.
A picked Mark lights blue and has a right-click menu; a Span has a Handle at each end, and dragging
one changes only how far the Mark reaches, never the notes' time (P11). A dotted Attachment line
runs from a picked Mark to its notes (the first and last for a Span), and those notes get a soft
tint. What is drawn from the notes (beams, stems, rests written by the meter) picks its note or
gap; editor aids (the Grid, the cursor, ⚠) can't be picked. A Tie chain still picks as one note
(P8). (A15)
✓ Dorico (attachment lines) · ½ MuseScore (anchor line only while dragging) · ✗ Guitar Pro (picks
by beat)

## The choices

Jeremy's round-2 answers (2026-11-03) and later additions, each with how a step refined it. The
ground rules they answer are in the ADR.

- **A1 Rhythm model.** Edits work on what sounds (each note's start and length, a Tie chain as one
  note); the Clip keeps storing written Columns, so alphaTex, links and saves don't change. After
  each edit the bar's rests and ties are written out by the meter (A3 settled that nothing is kept
  as forced).
- **A2 Voices.** The Clip, alphaTex reading and writing, and the Sounding-note layer with its rules
  (per Voice) support more than one Voice from the start, and drawing, playback and exports are
  built expecting them. Step 2: playback and the alphaTex and Guitar Pro exports carry every Voice.
  Step 9: every Voice is drawn, exported and edited.
- **A3 Rests.** A rest is only the gap between notes, always written by the meter (Dorico). A
  rest's length can't be set; the rest-length keys from PR #294 went. Rests in an imported or
  linked bar stay as written until an edit changes that bar's rhythm; marks, frets and strings
  don't rewrite its rests (step 3). On a picked rest the length keys and Duration buttons do
  nothing.
- **A4 Splitting notes and rests.** By the meter, as Dorico's defaults: at bar lines and where the
  bar's Beat groups meet (the middle of 4/4, each dotted quarter in 6/8), keeping common
  syncopations such as eighth, quarter, eighth whole. Rests split at the same Beat groups but take
  none of the syncopations, so they always show the beat (step 1 spec, Q2).
- **A5 Beat groups.** Frets picks a grouping for each time signature (5/8 = 3+2, 7/8 = 2+2+3).
  Meters with more than one sensible grouping get a Beat groups field in the time signature panel,
  saved in alphaTex's `\beaming`. The Beat groups drive beams, note splits and rests.
- **A6 Beam overrides.** Per note: Automatic, Break before, Join to previous. Saved with the
  arrangement; dropped when that note's length changes. No beams-over-rests or slant options. Step
  7: two tools in the Rail's Rhythm group, Break and Join, the lit one pressed again being
  Automatic, and the same two in the right-click menu; on a selection Join beams it as one and
  Break takes its beams away, as Dorico's.
- **A7 Ties.** Ties go forward, as Dorico and MuseScore. Step 5: T ties (Dorico's key), the next
  note takes the fret, a rest becomes a tied note, a selection ties only matching frets; Tap is
  Alt+T, `=` and `−` are longer and shorter.
- **A8 Length of a run.** Changing the length of several notes lays the run out again from its
  start, in order, each with its new length; past the run's old end it writes over what follows,
  or leaves a gap if shorter. The bar stays full. One note is a run of one.
- **A9 Tuplets.** In normal mode a tuplet is applied over a span: a picked note's time becomes the
  tuplet (the note, then a gap). In note input, a tuplet turns on Tuplet entry, lit while on, until
  turned off (Dorico). Bars stay full. Step 6: a selection is squeezed into the tuplet, as
  Dorico's; taking a tuplet away lays its notes out plain; `;` opens the Tuplet panel at the
  cursor.
- **A10 Bars always full.** No bar is ever short or too long from editing. Ctrl/⌘+Delete pulls the
  following music back across bar lines. A short first bar is a Pickup bar set on purpose
  (alphaTex `\ac`). An imported Uneven bar keeps its quiet ⚠ with Move extra into next bar. The
  "Fill short bars with rests" setting went.
- **A11 Adding time.** Explicit actions only. Insert adds a gap at the cursor (the Input length in
  note input, else the picked note's length); Insert paste puts the clipboard in. Both push the
  following music forward across bar lines. Later, maybe: a Dorico-style Insert mode toggle, under
  which typing, length changes and Delete push and pull instead of writing over. Nothing here
  blocks adding it.
- **A12 Typing on a rest** (normal mode): the rest becomes a note of that length (MuseScore,
  Guitar Pro). Picking a rest and typing changes pitch, not rhythm.
- **A13 Rest key.** In note input it moves on by the Input length and leaves a gap (MuseScore's 0,
  Dorico's rest entry); in normal mode it turns the picked notes into a gap, the same as Delete. No
  rest is stored. Step 6: the key is `,`, as Dorico's; R does nothing for now (Dorico's
  repeat is issue #344).
- **A14 Grace notes.** In normal mode, Grace adds a grace note before the picked note, at the same
  fret, moving nothing (MuseScore). In note input, Grace entry, lit while on: typed notes go in as
  grace notes before the next normal note until it is turned off (Dorico). Step 6: the key is `/`
  (the slide moved to Alt+/); grace values by count (an eighth, two sixteenths, thirty-seconds);
  Delete removes one with no gap.
- **A15 Picking marks** (2026-11-04). Every mark, line and symbol can be picked, as P14. The
  Attachment line was chosen as Dorico's; step 8 added the soft tint behind the Mark's notes, which
  stay in ink so they don't look picked. Time and key signatures are picked like words (a press no
  longer opens their panel); Alt+Shift+← → move a picked Span's end, as Dorico's.
- **Note input grid** (PR #299, `docs/specs/2026-11-01-tab-note-input-grid-design.md`). The Grid
  follows the Input length by default, with a fixed grid on demand; Space always plays. It is drawn
  as a ruler over the staff by default, lines across the bar as a setting, and marks only where a
  note can go; a press in an empty bar snaps to it like any rest. Entering inside a note is issue
  #332.

## 1. Editing model: overwrite or insert

When you enter or change something, does the music after it stay where it is (overwrite) or move
along (insert)?

**Rule (P1, P2; A10, A11).** Overwrite is the only default. Insert (a gap at the cursor) and Insert
paste push the following music forward across bar lines; Ctrl/⌘+Delete pulls it back. Bars stay
full. Later, maybe: a Dorico-style Insert mode toggle.

- **Unit of time.** Dorico: notes in voices; gaps are implicit rests Dorico draws for you (m).
  MuseScore: chord or rest per voice, 4 voices per staff; voice 1 always fills the bar (m). Guitar
  Pro: the beat, one length per beat per voice, up to 4 voices (u). Frets: the Column, one length
  per Column per Voice, up to 4 Voices, edited one at a time; close to Guitar Pro's beat.
- **Default when entering.** Dorico: overwrites unless Insert mode is on (m). MuseScore:
  overwrites, "Note input in MuseScore overwrites existing notes or rests" (m). Guitar Pro: edits
  the beat in place; changing its length pushes the rest of the bar along, and the bar can run over
  (u). Frets: overwrites; a long note writes over what follows, split and tied by the meter.
- **Insert.** Dorico: Insert mode (I), new notes push later ones; shortening or deleting pulls them
  back (m). MuseScore: Insert input mode, or Ctrl/⌘+Shift with a note (m). Guitar Pro: Insert adds
  an empty beat before the cursor; Delete beat removes one (m). Frets: Insert adds a gap; Insert
  paste (Ctrl/⌘+Shift+V) and Ctrl/⌘+Delete add or take time. No Insert mode.

Agrees: ✓ Dorico, ✓ MuseScore (overwrite by default, Insert mode separate); ✗ Guitar Pro (edits
push the bar along).

## 2. Note entry, input length and grid

When is the length chosen, where can a note start, and how does the cursor move?

**Rule (P2, P12, P4; A13, the note input grid).**

- The Input length is chosen before the note in note input.
- The Grid sets where a note can start; it follows the Input length unless you fix it.
- A press snaps to the Grid in every rest, an empty bar's Whole-bar rest included; normal mode
  still picks the whole bar.
- The drawn Grid marks only where a note can go: each note's start and the grid lines inside
  rests, never inside a note's length, which the same Voice can't take.
- The pointer moves the caret: over the staff or the tab it goes where a press would put a note,
  only its ghost showing, and the arrow keys move it on from there; off them it stays put and its
  mark shows. The Grid is always over the caret's bar (issue #396). Departs from Dorico and MuseScore,
  whose pointer only shows a shadow note, for one place the pointer, keys and Grid all agree on.
- Later: entering inside a note shortens it to that point, as Dorico does with Insert mode off
  (issue #332).
- A note longer than the room before the next note writes over it, split and tied by the meter.
- `,` in note input moves on by the Input length and leaves a gap.
- Space always plays.

Comparison:

- **Length chosen.** Dorico: before the note, from the Notes panel or 1–9 (u). MuseScore: before
  the note, 1–9 pick 64th to longa, `.` a dot (m). Guitar Pro: on the beat you're on, before or
  after the fret (+ / − on the keypad); moving right past the bar's end makes a new beat as long as
  the last (m). Frets: note input, before, as MuseScore (staff digits, tab Shift+digit, `=` / `−`
  or W/Q, `.`); normal mode changes what's picked.
- **Where a note can start.** Dorico: at any point of the rhythmic grid (Alt+[ ]); the caret moves
  by the grid through empty time (u). MuseScore: at a chord or rest; the cursor steps by notes and
  rests (u). Guitar Pro: at a beat; empty space needs rests typed in first (u). Frets: at a note's
  start, or on a grid line inside a rest (an empty bar's Whole-bar rest too); ← → stop at each grid
  line inside a rest and once per note; a press snaps to the nearest; not inside a note's length
  (issue #332).
- **Entering a rest.** Dorico: rests are implicit; one can be entered on purpose (`,`) (u).
  MuseScore: 0 enters a rest of the input length and moves on (m). Guitar Pro: R makes the beat a
  rest (m). Frets: `,` in note input writes a gap of the Input length and moves on; in normal mode
  it is Delete.
- **Moving on after a note.** Dorico: automatically, by the note's length; Space advances by the
  grid (u). MuseScore: automatically after each note (u). Guitar Pro: right arrow; a new beat at the
  bar's end (m). Frets: the cursor stays; → moves on, Shift+Space moves on by the Input length.

Agrees: ½ Dorico (length first, grid, rest entry; but Space moves the caret); ½ MuseScore (length
first, 0 enters rests, Space plays; no grid); ✗ Guitar Pro (length set on the beat; no grid).

## 3. Rests and how they are written

When the program makes rests for you, which rests does it choose?

**Rule (P4, P5; A3, A4, A13).**

- A rest is only a Gap; it is always written by the meter, split where Beat groups meet.
- An empty bar is one Whole-bar rest, whatever the meter: one whole rest centred in the bar on the
  staff, under the tab and in PNG and SVG, and a measure rest in MusicXML. alphaTex and Guitar Pro
  keep the stored rests (`rh.` in 3/4, `rq. rq` in 5/8); ASCII draws no rests.
- Rests in an imported or linked bar stay as written until an edit changes that bar's rhythm (a
  note added or removed, a length changed). Marks, frets and strings leave its rests alone.
- On a picked rest the length keys and Duration buttons do nothing, and the Duration group lights
  nothing.

In 4/4, an eighth note on beat 1 with the rest of the bar empty is written as eighth note, eighth
rest, quarter rest, half rest (each beat can be counted), not eighth note and double-dotted half
rest (the fewest rests, as Frets wrote it before step 3).

Comparison:

- **Who writes rests.** Dorico: "Implicit rests automatically fill the gaps between the notes you
  input" (m). MuseScore: whenever notes are removed or shortened, and on Delete of a range, "the
  correct rests according to the meter" (m). Guitar Pro: you do, rests are beats like notes; Bar
  Arranger adds the missing ones (m). Frets: Frets, after every edit that changes a bar's rhythm.
- **Rest spelling.** Dorico: by meter, with Notation Options for rest grouping; any rest can be
  forced to another length (m). MuseScore: by beat; a whole empty bar is one bar rest in any meter
  (u). Guitar Pro: as entered (u). Frets: by the meter; an empty bar is one Whole-bar rest;
  imported bars keep their rests until edited.
- **Hiding rests.** Dorico: implicit rests can be removed per passage (u). MuseScore: voice 1 rests
  can't be deleted; voices 2–4 can (m). Guitar Pro: "Hide unnecessary rests in standard notation"
  in the stylesheet (m). Frets: each Voice's rests are written by the meter; a Voice with no notes
  in a bar is absent there, drawn with no rests.

Agrees: ✓ Dorico (rests are gaps written by the meter); ½ MuseScore (writes rests by the meter on
Delete, but rests are objects); ✗ Guitar Pro (rests stay as typed).

## 4. Full bars and filling with rests

Can a bar be short or too long, how do you find out, and who fills it?

**Rule (P1; A10).** No bar is short or too long from editing. A short first bar is a Pickup bar set
on purpose (alphaTex `\ac`). An imported Uneven bar keeps a quiet ⚠; pressing it offers Move extra
into next bar, Fill with rests and, on bar 1, Make pickup bar. There is no "Fill short bars with
rests" setting.

Comparison:

- **Short or long bars.** Dorico: can't be; gaps are rests, and bars come from the time signature
  (m). MuseScore: voice 1 can't be short; a bar's own "actual duration" makes pickups and odd bars
  on purpose (u). Guitar Pro: allowed; they "appear in red" (except the one being edited), and an
  LCD shows what's left (m). Frets: only from an import or a link, marked by a ⚠ under the bar.
- **Filling.** Dorico, MuseScore: not needed. Guitar Pro: Bar Arranger adds rests to short bars and
  moves extra notes on; Check Bar Duration lists uneven bars (m). Frets: the Uneven bar's ⚠ fixes one
  bar.
- **Where short bars come from.** Dorico: nowhere (m). MuseScore: only explicit actions, Ctrl/⌘+Delete
  (remove selected range) or a bar's own length set on purpose (m). Guitar Pro: typing, length
  changes, deletes. Frets: only an import or a link.

Agrees: ✓ Dorico (bars always full); ✓ MuseScore (always full in voice 1); ½ Guitar Pro (its red
bars and Bar Arranger match the ⚠ and its fixes, but it allows short bars).

## 5. Changing a note's length

You pick a note (or a run) and make it longer or shorter. What happens to what follows?

**Rule (P7; A8, A12).** One rule for keys, buttons and any future drag handle: notes keep their
start; longer writes over what follows, split and tied by the meter; shorter leaves a gap. A run is
laid out again from its start, in order, each note with its new length. Typing a fret on a picked
rest makes a note of that rest's length.

Comparison:

- **One note, longer.** Dorico: writes over (Insert mode off), by the grid with Alt+Shift+→; past
  bar lines Dorico ties it (u). MuseScore: writes over what follows; past the bar line it's split
  and tied (u). Guitar Pro: pushes the rest of the bar along; the bar runs over and turns red (u).
  Frets: writes over what follows, split and tied by the meter.
- **One note, shorter.** Dorico: leaves implicit rests; in Insert mode pulls later notes in (m).
  MuseScore: leaves rests (u). Guitar Pro: pulls the rest of the bar in; the bar goes short (u).
  Frets: leaves a gap, written by the meter.
- **A run of notes.** Dorico: each note changes; time follows the overwrite rule (u). MuseScore:
  W / Q double or halve the range, keeping the bar full (m). Guitar Pro: each beat changes; the bar
  runs over or under (u). Frets: laid out again from its start; the bar stays full.
- **Notes in a tuplet, grace notes.** Dorico, MuseScore: within the tuplet only (u). Frets: within
  the tuplet only (longer writes over its later notes, shorter leaves a gap in it); grace notes
  take no length change.
- **Drag to resize.** Dorico: in Play mode (piano roll) only (u). MuseScore, Guitar Pro: no.
  Frets: not yet; it would follow the same rule.

Agrees: ✓ Dorico (longer writes over, shorter leaves gaps, Insert mode off); ✓ MuseScore (the same,
and W/Q on a range keep the bar full); ✗ Guitar Pro (longer pushes the bar along).

## 6. Ties and automatic ties

How are ties made, when does the program make them for you, and how does a Tie chain behave when
edited?

**Rule (P3, P5, P8; A1, A4, A7).**

- T ties the picked note forward to the next note on its string, which takes its fret (a rest
  becomes a Tied note); with several Columns selected, only where the fret already matches; in note
  input it adds a Tied note of the Input length.
- Notes are split and tied by the meter, whatever made them long.
- A Tie chain is one note for picking, Delete and length. Each written note of it keeps its own
  marks, and one with marks of its own stays a written note of its own (Sweet Child bends and
  re-chords on tied notes). When a note is split, palm mute, let ring, vibrato, tremolo picking,
  octave lines and hairpins go on every piece; attack marks (hammer-on, slide in, accent, ghost,
  tap, harmonic) stay on the first (step 1 spec, Q1).
- Keys as Dorico's: T ties; Tap is Alt+T; `=` and `−` are longer and shorter.
- A tie is taken away by picking its arc and pressing Delete or T.

Comparison:

- **Manual tie.** Dorico: T ties to the next note of the same pitch, or enters one (u). MuseScore:
  T in normal mode ties to the next note of the same pitch (both must exist); + in note input adds
  a tied note (m). Guitar Pro: L ties the note to the previous one on the same string (u). Frets: T
  ties forward, as Dorico's.
- **Automatic ties.** Dorico: always; notes are split and tied by the meter, and re-notated when the
  music around them changes (m). MuseScore: a note longer than the bar's remaining time is split
  and tied over the bar line (u); Regroup rhythms re-ties by beat on request (m). Guitar Pro: none
  on entry; Bar Arranger splits notes across bar lines (u). Frets: every edit; a bar is written
  again when its rhythm changes, so a tied pair inside a bar that fits one value becomes one note.
- **A Tie chain when edited.** Dorico: "Tie chains are treated as single notes" (m). MuseScore:
  separate notes; pitch changes follow the tie (u). Guitar Pro: separate notes (u). Frets: one
  note; Alt+press picks one Tied note for its own marks.
- **Tied notes on the tab.** Dorico: not a tab-first program. MuseScore: a style setting (show,
  brackets, hide) (u). Guitar Pro: "Always show tied notes in tablature" (m). Frets: the fret is
  named only where a bar starts (and after slides, under vibrato and similar, from the book work).

Agrees: ✓ Dorico (ties forward, chains are one note, split by the meter); ½ MuseScore (ties forward,
splits at bar lines only, chains are separate notes); ✗ Guitar Pro (ties back, no automatic ties).

## 7. Beams

Which notes are joined by a beam, and can you change it?

**Rule (P6, P9; A5, A6).**

- Beams follow the Beat groups in meters counted in eighths or shorter (7/8 as 2+2+3, or as set);
  otherwise by the beat, with 4/4's plain eighths four together.
- Meters of 5 beats or more get a Beat groups field in the time signature panel, saved as
  `\beaming (8 3 2 2)`, written in eighths or shorter since alphaTab 1.8.4 misreads a quarter unit.
- Two tools in the Rail's Rhythm group, Break the beam before this note and Join the beam to the
  note before (the lit one pressed again is Automatic), and the same two in the right-click menu,
  saved as `{beam split|merge}` on the note before and dropped when the length changes.
- Flat beams; no beams over rests; no beaming settings. Rests and grace notes break beams.

Comparison:

- **Automatic grouping.** Dorico: from the meter; custom groups by writing the time signature as
  [2+2+3]/8 (u). MuseScore: from the time signature's beam groups, 16ths by beat, 8ths by two beats
  in 4/4 (m). Guitar Pro: by beat (u).
- **Per-note override.** Dorico: beam together, unbeam, split beam, make into single beam (u).
  MuseScore: Beam palette, auto, no beam, break left, break inner beams, join (u). Guitar Pro:
  Automatic, Force beaming, Break beaming, Break secondary beaming (m).
- **Beams over rests.** Dorico: option per flow (u). MuseScore: by joining beams across rests (u).
  Guitar Pro: "Show beams on rests in tablature" (m). Frets: never.
- **Slant.** Dorico: by engraving rules. MuseScore: slanted, editable. Guitar Pro: "Force horizontal
  beams" (m). Frets: always flat.

Agrees: ✓ Dorico (meter-based beams, grouped time signatures, overrides); ✓ MuseScore (beam groups
from the time signature, overrides); ✓ Guitar Pro (beams by beat, Break and Force beaming per note).

## 8. Note and rest changes and their neighbours

Which changes to a note or rest reach the notes around it?

**Rule (P11, P7, P14; A3, A12, A13, A15).**

- Frets, strings, techniques and Marks stay local; joins stay true.
- Dots, values, tuplets and grace notes follow P1 and P7.
- A note turned into a rest (Delete or `,`) becomes a gap; the gaps around it are written again by
  the meter. A grace note goes with no gap.
- Every Mark can be picked on its own, as P14.

Comparison:

- **Fret, string, pitch, techniques.** Local in all four; in Frets, joins (tie, hammer-on, slide)
  on the next note are kept true by normalize.
- **Dot added or removed.** Dorico: as a length change; in Insert mode, pushes or pulls (m).
  MuseScore: as a length change, writes over or leaves rests (u). Guitar Pro: the beat grows or
  shrinks; the bar runs over or under (u). Frets: as a length change (P7).
- **Rest turned into a note.** Dorico: note input at the caret, by the input length (u). MuseScore:
  normal mode, the note takes the rest's length; note input, the input length, writing over (u).
  Guitar Pro: a fret on a rest beat makes it a note of the same length (u). Frets: as MuseScore.
- **Note turned into a rest.** Dorico: Delete, implicit rests, re-spelled (u). MuseScore: Delete, a
  rest of the same length (m). Guitar Pro: R, a rest of the same length (m). Frets: Delete or `,`,
  a gap, then the bar's rests are written again by the meter; an emptied bar is one Whole-bar rest.
- **Picking a mark.** Dorico: every item can be selected on its own; a selected item shows a dotted
  attachment line to the rhythmic position it belongs to (u). MuseScore: every element can be
  selected; lines get end handles; an anchor line shows while dragging (u). Guitar Pro: selection is
  by beat; marks are set on the beat, not picked on their own (u). Frets: P14.

Agrees: ✓ Dorico (marks local, rests re-spelled); ✓ MuseScore (marks local, a note on a picked rest
takes its length); ½ Guitar Pro (marks local, but rests aren't re-spelled).

## 9. Tuplets and grace notes

Making a tuplet changes how long each note is. Who absorbs the difference?

**Rule (P10; A9, A14).**

- Normal mode: on one note, the tuplet takes its time (a quarter becomes a triplet eighth, then a
  triplet quarter rest); on a selection, the notes are squeezed into the tuplet, as Dorico's.
- Normal mode: Grace adds a grace note before the picked note, at the same fret; nothing moves.
- Note input: Tuplet entry and Grace entry turn on, lit while on, until turned off.
- Taking a tuplet away (the same tuplet, None, or Delete on its number) lays the notes out plain
  from its start, writing over or leaving a gap.
- Keys as Dorico's: `;` the Tuplet panel at the cursor, `/` Grace, Alt+/ slide.

Comparison:

- **Making a tuplet.** Dorico: enter the tuplet (`;`) then its notes; the span is the input length
  (u). MuseScore: the picked note's length becomes the tuplet's span (a quarter: three triplet
  eighths, the note then two rests) (u). Guitar Pro: the beat becomes a tuplet note; typing on
  fills the tuplet, and the bar is short until it's done (u).
- **Undoing a tuplet.** Dorico: delete the bracket; notes re-spelled (u). MuseScore: delete the
  tuplet; its span becomes a rest (u). Guitar Pro: toggle off; the bar runs over (u).
- **Grace notes.** Take no time in all four.

Agrees: ✓ Dorico (tuplet and grace entry modes in note input); ½ MuseScore (tuplet over a span,
grace added before; no entry toggles); ✗ Guitar Pro (the bar runs short until a tuplet is filled).

## 10. Delete, cut, paste and taking time

What do the clipboard and the delete keys do to time?

**Rule (P1, P4; A3, A10, A11).** Delete and cut leave gaps; paste writes over, splitting and tying at
bar lines; all keep Tie chains whole. Ctrl/⌘+Delete and Insert paste pull or push the following
music across bar lines.

Comparison:

- **Delete.** Dorico: implicit rests; in Insert mode, the gap closes (m). MuseScore: a rest of the
  same length; a range becomes "the correct rests according to the meter" (m). Guitar Pro: Delete
  removes notes; Delete beat removes time (m). Frets: rests written by the meter, as MuseScore's
  range delete; a bar emptied is one Whole-bar rest. The rests keep the column's text, chord name
  and other marks of its time, and a note written over that time takes them; only Ctrl/⌘+Delete
  removes them (issue #393).
- **Take time away.** Dorico: Insert mode + Delete (m). MuseScore: Ctrl/⌘+Delete, "Remove selected
  range" (m). Guitar Pro: Delete beat / bar (m). Frets: Ctrl/⌘+Delete.
- **Cut.** Dorico, MuseScore: leaves rests (u). Guitar Pro: single track copies; multitrack cut
  removes bars (m). Frets: leaves rests.
- **Paste.** Dorico: writes over, or pushes in Insert mode (m). MuseScore: writes over from the
  cursor (u). Guitar Pro: onto the selection, adding bars as needed (m). Frets: writes over; Insert
  paste adds time.

Agrees: ✓ Dorico (Delete leaves gaps, paste writes over); ✓ MuseScore (Delete leaves rests,
Ctrl/⌘+Delete takes time, paste writes over); ½ Guitar Pro (its paste is Frets' Insert paste).

## 11. Chords, voices and one length per column

What happens when notes sounding together need different lengths?

**Rule (P13; A2).** One length per Column within a Voice, as Guitar Pro's beat and alphaTex have
it. The Clip, alphaTex (`\voice`) and the Sounding-note layer hold up to four Voices; every Voice is
drawn, played, exported and edited, one at a time as the Active voice. A selection covers every
Voice in its time, as Dorico's; one string can't sound in two Voices at once.

Comparison:

- **Notes at the same time.** Dorico: chord mode (Q); any number of voices (u). MuseScore: share
  their chord's length; up to 4 voices (m). Guitar Pro: share their beat's length; a second voice
  for anything else (u). Frets: share their Column's length; up to 4 Voices, chosen with the
  Rail's Voice row or Alt+1–4. A note added to a Column takes its length.
- **Ringing open string under a melody.** Dorico: a second voice (u). MuseScore: voice 2, or let
  ring (u). Guitar Pro: let ring, or voice 2 (u). Frets: Voice 2, or let ring.

Agrees: ✓ Dorico (voices); ✓ MuseScore (up to 4 voices); ✓ Guitar Pro (up to 4 voices, one length
per beat).

## 12. What each program lets you configure

Settings and per-score options that change editing or rhythm notation.

**Rule (A5, A6, A10).**

- Preferences (Settings › Tab › Editing): only the note input Grid and how it is drawn.
- In the arrangement: Beat groups for ambiguous meters, Beam overrides, Pickup bars.
- Commands: the Uneven bar ⚠'s fixes.
- House style, no option: rests and ties by the meter, flat beams, no beams over rests.

Comparison:

- **Editing behaviour.** Dorico: Insert mode and its scope; rhythmic grid; chord mode; lock to
  duration (u). MuseScore: note input modes (step, insert, re-pitch, rhythm, real-time) (m). Guitar
  Pro: score errors preference (red bars on or off) (m). Frets: the Grid (Input length or fixed,
  16th by default) and how it is drawn (ruler or lines).
- **Rhythm notation.** Dorico: Notation Options per flow, note, rest and beam grouping,
  syncopation rules (m). MuseScore: time signature properties, beam groups; style, ties and rests in
  tab (u). Guitar Pro: stylesheet, horizontal beams, beams on rests in tab, hide unnecessary rests,
  tuplet brackets, tied notes in tab, tab rhythm position (m). Frets: Beat groups per time
  signature; view options (bar numbers, line breaks, header, tuning); no rhythm notation options.
- **Repair tools.** Dorico: reset to default grouping; force duration (m). MuseScore: Regroup
  rhythms (m). Guitar Pro: Bar Arranger, Check Bar Duration (m). Frets: the Uneven bar ⚠.

Agrees: ½ Dorico (grid as a setting, grouping in the score, but many more Notation Options); ½
MuseScore (beam groups in the score, but many style settings); ½ Guitar Pro (repair commands, but a
configurable look).

## Build order

The architecture came first, so later steps never had to undo it. Each step was one PR with its
spec; the glossary gained its terms in the same PR.

| Step | What | Choices | Spec (`docs/specs/`) | PR |
| --- | --- | --- | --- | --- |
| 1 | Sounding-note layer, Voice-ready | A1, A2, A4, A5 | `2026-11-03-tab-sounding-notes-design.md` | #328 |
| 2 | Voices in the arrangement | A2 | `2026-11-03-tab-voices-design.md` | #329 |
| 3 | Rests are gaps | A3 | `2026-11-03-tab-rests-are-gaps-design.md` | #330, #331 |
| — | Note input grid | — | `2026-11-01-tab-note-input-grid-design.md` | #299 |
| 4 | Lengths and bars always full | A8, A10, A11, A12 | `2026-11-04-tab-bars-always-full-design.md` | #336 |
| 5 | Ties forward, chains as one note | A7 | `2026-11-04-tab-ties-forward-design.md` | #339 |
| 6 | Tuplets, grace notes and rests | A9, A13, A14 | `2026-11-04-tab-tuplets-grace-rest-design.md` | #343 |
| 7 | Beat groups and Beam overrides | A5, A6 | `2026-11-04-tab-beat-groups-beams-design.md` | #348 |
| 8 | Every mark can be picked | A15 | `2026-11-04-tab-pick-every-mark-design.md` | #352 |
| 9 | Every Voice drawn, exported and edited | A2 | `2026-11-04-tab-voices-drawn-edited-design.md` | #353 |
| — | Later, maybe: Insert mode | A11 | | |

## Sources

- Guitar Pro 8: [Bar management](https://www.guitar-pro.com/docs/gp8/score/bars),
  [Musical notation](https://www.guitar-pro.com/docs/gp8/score/musical-notation),
  [Entering notes](https://www.guitar-pro.com/docs/gp8/score/note/note-input),
  [Assistants (Bar Arranger, Check Bar Duration)](https://www.guitar-pro.com/docs/gp8/score/assistant/note-score-assistants),
  [Copy, paste and cut](https://www.guitar-pro.com/docs/gp8/score/assistant/copy-paste),
  [Notation symbols (beaming)](https://www.guitar-pro.com/docs/gp8/score/note/symbols/notation),
  [Stylesheet, notation](https://www.guitar-pro.com/docs/gp8/preferences-stylesheet/stylesheet/notation)
- MuseScore: [Note input](https://musescore.org/en/handbook/2/note-input),
  [Note input modes](https://handbook.musescore.org/3/advanced-topics/note-input-modes),
  [Editing notes and rests](https://handbook.musescore.org/basics/editing-notes-and-rests),
  [Regroup rhythms](https://handbook.musescore.org/notation/rhythm-meter-and-measures/regroup-rhythms)
- Dorico: [Notes and rests](https://steinberg.help/dorico/v3/en/dorico/topics/program_concepts/program_concepts_notes_rests_c.html),
  [Insert mode](https://steinberg.help/dorico/v3.5/en/dorico/topics/write_mode/write_mode_note_input/write_mode_insert_mode_c.html),
  [Forcing the duration of notes and rests](https://steinberg.help/dorico/v4/en/dorico/topics/write_mode/write_mode_note_input/write_mode_duration_forcing_t.html)
