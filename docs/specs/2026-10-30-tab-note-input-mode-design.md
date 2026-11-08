# Tab: normal mode and note input mode

Issue #238, step 3, moved ahead of steps 1b and 2 (Jeremy, 2026-10-30: "What I'm interested in is
the support for a modal operation where there's a difference between selecting something and
entering notes"; he picked "Modes next"). It follows MuseScore: **normal mode** selects and changes
what is selected, and **note input mode** types. Before this, the tab was always in something like note
input.

## Going in and out

- The page starts in normal mode.
- **N**, or the pencil button first in the palette (its own group, "Input"), turns note input mode on and
  off. The pencil stays lit while note input mode is on, on the tab or off it: it says the mode, not a note.
  N works anywhere on the page but in a text field, a dialog or a menu (Jeremy, 2026-10-30); going in
  brings the keys to the tab. Going in lets any selection, or a picked mark or word, go, and the cursor
  starts at the selection's first column, as Dorico's caret and MuseScore's note input mode do (Jeremy,
  2026-11-06).
- **Esc** in note input mode goes back to normal mode, keeping the tab and what the cursor was on. Esc in
  normal mode leaves the tab, as before.
  Esc leaves note input mode wherever the keys are on the page (Jeremy, 2026-11-03, issue #334): off the
  tab, on the rail or a control, with a mark, word or the score head's title picked (the pick goes
  too). An open panel, menu or dialog takes Esc first and closes, as in Dorico and MuseScore; the next
  Esc leaves note input mode.
- Harmonic moves from N to **Shift+N**, still stepping natural, pinch, artificial, off.

## Normal mode

What the cursor is on is **selected**: a note's box on the tab is filled (`--primary-soft`), and a
selected staff note is filled in `--primary`, as MuseScore colours one. A column with no string picked
has the same filled box round its strings (round the staff's lines with the staff alone). Only the
part pressed lights (Jeremy, 2026-10-30): a note selected on the staff is not boxed on the tab, nor a
note selected on the tab coloured on the staff; the same goes for note input mode's cursors.

| Input | Does |
| --- | --- |
| Press on a note (tab number or staff head) | Selects it. |
| Press beside the notes (an empty string, a blank line or space) | Selects the bar, as MuseScore's does (Jeremy, 2026-10-31; it selected the column before); adds nothing. |
| Digit, a staff note selected | Sets its length, MuseScore's numbers: 1 a 64th, 2 a 32nd, 3 a 16th, 4 an eighth, 5 a quarter, 6 a half, 7 a whole (Q1, Jeremy). |
| Digit, a tab note selected | Sets its length, as on the staff: frets are typed only in note input mode, as in Dorico (Jeremy, 2026-11-07, issue #396; it typed the fret before). |
| ↑ ↓, tab | The string above or below, as Dorico's arrows go between notes and staves; up past the top string (or from the column alone) to the staff when it is shown, on the note's pitch or else the column's lowest note (Jeremy, 2026-11-07, issue #396; it changed the fret before). From the column alone ↓ picks the top string. |
| Alt+↑ ↓, tab | The selected notes a fret higher or lower on their own strings, as Dorico's Alt+arrows change what is picked; nothing moves when one would pass 0 or 24 (it was plain ↑ ↓ before). |
| Ctrl/⌘+↑ ↓, tab | The note to the next string up or down that plays the same pitch. |
| Drag a tab number up or down | The note to the string under the pointer, at the same pitch (`2026-10-31-tab-drag-fret-string-design.md`). |
| ↑ ↓, staff | Selects the next note up or down the chord by pitch; down past the lowest to the tab when it is shown (Jeremy, 2026-11-07, issue #396; ↑ ↓ moved it a semitone before, and Alt+↑ ↓ went between the notes). |
| Alt+↑ ↓, staff | The selected notes a line or space, in the key, as in note input mode. |
| Alt+Shift+↑ ↓, staff | A semitone. |
| Ctrl/⌘+↑ ↓, staff | An octave. |
| ← → | Selects the next or last column: its note on the same string, else the column. Adds no rests. |

With Shift+← → or Ctrl/⌘+A selecting columns, Alt+↑ ↓ and their modifiers move every selected note.
The palette, the letter keys, Delete, Shift+← →, the jumps of `2026-10-30-tab-musescore-selection-design.md`,
copy, cut and paste work as before. Enter, # and b on the staff belong to note input mode; in normal mode b
is Bend, as on the tab.

## Note input mode

The keys are as they were before modes (`2026-10-25-tab-editing-design.md`,
`2026-10-27-tab-staff-entry-design.md`): digits type frets, ↑ ↓ move between strings, and ↑ past the top
string goes up to the staff, as in normal mode. On the staff ↑ goes nowhere and ↓ comes back down to the
tab, as Dorico's ↑ ↓ go between staves (Jeremy, 2026-11-07, issue #396; they moved the ghost a line or space
before, and Ctrl/⌘+↑ ↓ do the same). On the staff A–G enter that note, as Dorico's do: the letter
on the line or space nearest the caret's pitch, as the key has it (F♯ in G major); -, = or 0 typed just before
make it flat, sharp or natural from the plain letter, for that one letter only (any other key, or leaving note
input, lets the sign go; a second sign replaces the first) (Jeremy, 2026-11-07, issue #396; # and b moved the ghost a semitone before, and
- and = there were Shorter and Longer). Every note made on the staff, by a letter, Enter or a press, moves the
caret on past it by its length, as Dorico's does; a fret typed on the tab leaves the caret where it is, for a
second digit or a chord. Alt+↑ ↓ move the note at the caret's pitch, or with none there its ghost; Enter on
the staff adds a note or takes away the one there; → past a short bar
adds a rest to type on. The tab's cursor is outlined, as before; on a string with no note it holds a
faint 0, the tab's ghost note, as MuseScore's tab shadow note does (Jeremy, 2026-11-08, issue #396). The staff's is Dorico's caret, an upright
line across the staff just left of where the next note goes, with that next note drawn there as a faint
ghost note (the Input length, on the pitch Enter would put in, with its sign; issue #382). It was a faint
outlined head, which read as a whole note already entered. One ghost note shows at a time (Jeremy,
2026-11-06): while the pointer's is on the staff the caret's goes, and in the caret's own bar the caret
goes too, since the mouse is placing the note. On a note the line stays off it, and over a note at the
caret's pitch nothing is drawn.

- **A double-click goes in** (Jeremy, 2026-10-31): out of note input mode, a double-click on the staff or the
  tab goes into note input mode with the caret where it landed, as Dorico's does (Jeremy, 2026-11-07, issue #396):
  on a fret, on that note; beside the notes on a string, on that string at that column; on the staff, at the
  note's pitch or the line or space; on a rest on the staff, on its middle line, as N on a rest picked there. In note input mode it does nothing more.
- **Going in on a picked note puts the caret on it** (Jeremy, 2026-11-07, issue #396), as Dorico's caret
  starts on the note selected: its string picked on the tab, or its pitch on the staff, so digits retype it.
- **Off a note the caret goes on the string it was last on** (Jeremy, 2026-11-08, issue #396), as Dorico's tab
  caret is always on a string: a fret types at once, and on an empty clip that is N, then the fret. Before,
  no string was picked (Jeremy, 2026-10-30 and 2026-10-31) and digits waited for ↑ ↓ or a press. No staff line or
  space is picked for you, and with only the staff drawn the caret takes the column alone. The short upright
  line on the tab is left for a column with no string, as after Shift+← →.

- **The shadow note** (Q2, Jeremy: "your cursor changes to the note representation"): under the
  pointer, over the staff, a faint note of the length a press would enter, on the line or space
  pointed at, with its ledger lines, stem and flag; over the tab, a dim copy of the outlined input
  cursor's box on the string pointed at (Jeremy, 2026-10-31), which a press fills with a 0 to type over.
  Its length is note input mode's length (below).
- **A press adds a note** (Q3, Jeremy): on a string with no note, a 0 there (digits then change it); on
  a staff line or space, a note at that pitch on the string Frets picks, as Enter does. A press on a
  note puts the cursor on it.
- **Note input mode's length** (Jeremy, 2026-10-30: "the number keys don't work the way I would expect to
  change the inserted note length"): as in MuseScore, the length is set before the note goes in, and
  the notes already entered keep theirs. Going in, it is the cursor's note's, else the last note's
  before it, else a quarter. On the staff a digit sets it (5 a quarter, 3 a sixteenth; 8, 9 and 0 do
  nothing and never type a fret); on the tab, where digits are frets, Shift with the digit sets it.
  W Q and + − step it, . cycles its dots, and the palette's Duration buttons set it and light it.
  A note entered on a rest (a typed fret, a press, Enter on the staff) takes it: a shorter note leaves
  the fewest rests after it, a longer one takes its time from the plain rests after it in the bar and,
  past them, runs over the bar, which the line under the clip then names. A note added to a column
  that has notes keeps the column's length. To change a note already entered, Esc to normal mode.

## Either mode

- **Shift with a digit's key** sets the length when the tab has the keys, as MuseScore's tab input does:
  Shift+5 a quarter; in normal mode the selected notes', in note input mode note input mode's length. It reads
  the key's place (`KeyboardEvent.code`), so any keyboard layout works.

## Reading

- "Behaves like MuseScore" on the staff was read as MuseScore's normal-mode length keys, since normal
  mode was the question.
- MuseScore's Alt+Shift+↑ ↓ on tab (a fret up or down, changing string to keep frets low) is not taken.
- Shift+digit lengths are not on the staff's cursor, where Shift+3 is the # that raises it.
- Note input mode is not stored: a reload starts in normal mode.

## Code

`normalMode.ts` (pure: MuseScore's length digits, `stepFrets`, `nextInChord`, `selectedNotes`).
`inputLength.ts` (pure: note input mode's length, where it starts, its steps and dots, which Duration
button it lights); `setFret` and `toggleStaffNote` take it as an optional `length`.
`editorKeys.ts`: `normalKeyDown`, N and Esc, Shift+digit. `TabPage.tsx` keeps `inputMode` and `inputLength`; its presses
on the tab and staff select or enter by mode. `TabClip.tsx` draws the selected or input look
(`Highlight.input`) and the shadow note (`shadow`, `ShadowNote` in `StaffDrawing.tsx`). `TabPalette.tsx`
draws the pencil.
