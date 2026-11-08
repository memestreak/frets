# Frets

A guitar fretboard app: tools for exploring scales, chords and tab, and
trainers for learning the neck. These are the app's own words; name
things in code, tests, specs and PRs by them.

## App

**Feature**:
One folder under `src/features/`, holding everything only one part of
the app uses.
_Avoid_: section (for the folder)

**Group**:
One of the headings the pages are listed under: Tools, Practice and
More. A group is not a path; the Scale lab is a Tools page at
`/explore/scales`.
_Avoid_: section (for the group)

**Mock**:
One of several looks a page offers for Jeremy to pick from, switched by
`?mock=` in the link. Mocks never merge: one is picked, the rest are
removed.

**Page**:
One route of the app, listed once in a Group in `sections.ts`.

**Trainer**:
A Practice page: a quiz that asks questions on the neck, judges the
answers and keeps stats. The Interval trainer and the Note trainer.
_Avoid_: quiz page, game

## Chords and the neck

**Grip**:
The three tones of a triad on three neighbouring strings, one tone per
string, in any inversion, wherever it fits on the neck. A Grip is not a
Shape.

**Position**:
A five-fret span of the neck that a set of Shapes is confined to, as in
the Scale lab's position shapes. One string and fret is a Spot.

**Shape**:
One way to finger a chord on the neck: a fret or a mute for each
string. Published shapes come first; the rest are found by searching
the neck.
_Avoid_: voicing, fingering

**Spot**:
One string and one fret on the neck.
_Avoid_: position

## Practice

**Box**:
The Interval trainer's reach around the root (`vRange` strings,
`hRange` frets) that decides which questions are asked. Never drawn; a
right answer outside it is explained, not scored.

**Find it**:
A Trainer mode: a note or interval is named, and the viewer finds it on
the neck.

**Fret range**:
The frets a Trainer's questions may use, set in its settings.
_Avoid_: fret window

**Name it**:
A Trainer mode: a note or interval is shown on the neck, and the viewer
names it.

## Tab

**Active voice**:
The Voice the cursor types into and the edits on one Voice act on, lit
in the Rail's Voice row; the other Voices are drawn muted while you edit.
_Avoid_: current voice, input voice

**Arrangement**:
The Tab page's Work: a named Clip saved under My arrangements.

**Attachment line**:
A thin dotted line drawn from a picked Mark to the note it belongs to (to
the first and last notes of a Span), as Dorico draws one; shown only
while the Mark is picked.

**Beam override**:
A note's own beaming, set by hand: Break before (its beam stops before
it) or Join to previous (its beam goes on from the note before). Without
one a note is beamed by the Beat groups.
_Avoid_: force beam, unbeam

**Beat group**:
The beats a bar is counted in, from its time signature: 3+3 in 6/8,
2+2+3 in 7/8, or a grouping the time signature is given (`\beaming` in
alphaTex). Beams, and the splits of notes and Gaps, follow where Beat
groups meet.
_Avoid_: group (alone)

**Change chord**:
The chord dialog opened on a chord of the Chord set, from Edit chord's
Change chord link: the same Name, Root, Type and shapes as defining a new
chord, with Cancel, Save as new chord and Save chord.
_Avoid_: modify chord

**Chord set**:
The chords an Arrangement defines for a Track, shown as tiles in the Tab
page's Chords panel, each with its diagram; an unused one is tinted.
_Avoid_: chord list, chord library

**Clip**:
The music in an Arrangement: one or more Tracks over the bars they
share.

**Column**:
Everything that sounds at one moment in one Voice of a bar: a note on
any of the strings, or none, sharing one length. The Clip stores bars
as Columns.
_Avoid_: beat (Guitar Pro's word for it)

**Edit chord**:
The Chords panel's view of one chord of the Chord set, opened by
double-click or the chord's menu: its shapes, picked live, and its name,
renamed by double-click or F2. It follows the chord picked in the Chord
set, the tab or the Chord chart.
_Avoid_: chord editor, chord view

**Gap**:
Time in a Voice with no note. It is drawn as the rests the meter calls
for, split where Beat groups meet; a rest is not kept as a thing of its
own.
_Avoid_: explicit rest

**Grace entry**:
A toggle in Note input mode, on `/`, lit while on: each fret typed goes in
as a grace note before the time at the cursor, taking no time.

**Grid**:
The steps Note input mode's cursor stops at inside a Gap, and where a press
snaps to: the Input length unless a fixed Grid is picked.

**Handle**:
A small circle at each end of a picked Span, dragged to change which
columns the Span covers, never the notes' time.

**Input length**:
The length the next note entered in Note input mode takes, chosen before the
note goes in.

**Line break**:
Where a Clip forces the music onto a new System, written in alphaTex
as `\systemsLayout` and drawn only with "Clip's line breaks" on.
Otherwise Systems wrap to the drawing's width.
_Avoid_: system break

**Mark**:
Anything drawn for a note, a column or a bar other than its fret numbers
and note heads: a technique, accent, tie, word, signature or bar-line
sign. Each can be picked on its own.
_Avoid_: annotation

**Normal mode**:
The Tab page's mode for picking and changing what is there; the page
starts in it. Notes are entered in Note input mode.

**Note input mode**:
The Tab page's mode for entering notes, turned on and off with N or the
pencil; Esc goes back to Normal mode. Dorico's name. Edits happen in
Normal mode too, so it is not an edit mode.
_Avoid_: note input (alone), edit mode, editing mode

**Phrase**:
A short stretch of music with a shape of its own, such as a riff, a
fill or a solo line. Say phrase, riff or line.
_Avoid_: lick

**Pick stroke**:
A Mark telling which way the pick moves: a downstroke (⊓) or an upstroke
(V), written `sd` / `su` in alphaTex. Over a staff drawn alone, else
between the staff and the tab. Other notation programs play it as a plain
chord; a Roll for it is issue #385.
_Avoid_: strum (for the mark), bow mark, sd/su (in the UI)

**Pickup bar**:
A first bar shorter than its time signature on purpose, written `\ac`
in alphaTex. No other bar is short.
_Avoid_: anacrusis, upbeat bar

**Rail**:
The column of buttons at the Clip's left, each opening one panel of
Tool groups: Notes, Articulations, Bars. The code's older name for the
tools is the palette (`TabPalette.tsx`).

**Roll**:
How a chord sounds when its strings start one after another instead of
together: low to high for a downstroke or Strum down, high to low for an
upstroke or Strum up. Its length is the roll's amount, a fraction of
the beat. A Strum rolls
quickly, a Rolled chord over its whole beat.
_Avoid_: brush, spread

**Rolled chord**:
A chord played one string after another across its beat, written
`ad` (arpeggio down) / `au` (arpeggio up) in alphaTex and drawn as a
wavy arpeggio sign with an arrowhead. Kept but not yet drawn (issue #384).
_Avoid_: arpeggio (for the chord), broken chord

**Sounding note**:
A note as it sounds: its Voice, string, fret, start and length, with a
Tie chain counted as one. Edits work on Sounding notes; the Clip stores
Columns.
_Avoid_: event

**Span**:
A Mark drawn as one line or wave over neighbouring columns that have it:
let ring, P.M., vibrato, an octave line, a hairpin. Picked whole, with a
Handle at each end.
_Avoid_: run (for the Mark)

**Staff view**:
The clip with Staff picked in its Staff | Tab | Both switch: the
notation staff alone, with no tab under it.
_Avoid_: staff only, staff alone

**Strum**:
A chord strummed down or up, written `bd` (strum down) / `bu` (strum up)
in alphaTex and drawn by Guitar Pro and alphaTab as an arrow beside the
chord on the tab: a strum down points up the tab, from the low string to
the high one. It plays as a quick Roll. Kept but not yet drawn (issue
#384). Not a Pick stroke, which only says which way the pick moves.
_Avoid_: brush, stroke (for the strum)

**System**:
One line of music across the drawing. A System holds every staff
played at the same time, joined at the left edge by a bar line or
bracket. In a guitar part that shows standard notation and tab
together, the notation staff and the tab staff below it make one
System. Frets shows one Track's System at a time; every Track breaks
into the same Systems.
_Avoid_: row (for a System; a row is one band within it)

**Tie chain**:
Notes on one string, each tied to the next, that sound as one Sounding
note. It is picked, deleted and lengthened as one.

**Tool group**:
A captioned set of tools in a Rail panel: Duration, Rhythm, Joins,
Bends and the rest.
_Avoid_: group (alone), palette group

**Tied note**:
One of the written notes a Tie chain is made of. Alt+press picks one
alone, for marks of its own; everything else acts on the whole chain.
_Avoid_: piece

**Track**:
One instrument's line in a Clip, with its own tuning, instrument and
playback effects.

**Tuplet entry**:
A toggle in Note input mode, picked from the Tuplet panel (`;`), lit while
on: the notes typed go in as a tuplet of the Input length, a new one
starting when the last is full.

**Uneven bar**:
A bar whose Voice doesn't fill its time signature: short or overfull.
Edits keep bars even, so one comes from an import or a link, and
shows a ⚠. A Pickup bar is not uneven.
_Avoid_: bad bar, incomplete bar

**Voice**:
One line of rhythm within a Track, with its own Columns, so notes can
sound against each other with different lengths. A Track has Voice 1 in
every bar and up to three more, each absent from any bar it has no
notes in.
_Avoid_: layer

**Whole-bar rest**:
The one rest drawn centred in a bar with no note in its Voice, whatever
the meter. The bar still stores the rests its meter calls for (two in
5/8), picked together as one.
_Avoid_: measure rest, bar rest

## Saved state

**Preference**:
A per-viewer choice listed in the Settings dialog, saved one key per
Section and never saved with the Work.
_Avoid_: setting (for a saved preference)

**Section**:
One part of the Settings dialog, saved as one key,
`frets.<page>.<section>`.

**Settings group**:
One page's set of Sections in the Settings dialog: General, Tab.
_Avoid_: group (alone, for this)

**Work**:
What a page lets the viewer make and save by name, each under
`frets.<page>.works.<id>`. On the Tab page, an Arrangement.
