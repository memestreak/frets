# Tab: normal mode and note input

Issue #238, step 3, moved ahead of steps 1b and 2 (Jeremy, 2026-10-30: "What I'm interested in is
the support for a modal operation where there's a difference between selecting something and
entering notes"; he picked "Modes next"). It follows MuseScore: **normal mode** selects and changes
what is selected, and **note input** types. Before this, the tab was always in something like note
input.

## Going in and out

- The page starts in normal mode.
- **N**, or the pencil button first in the palette (its own group, "Input"), turns note input on and
  off. The pencil stays lit while note input is on, on the tab or off it: it says the mode, not a note.
- **Esc** in note input goes back to normal mode, keeping the tab and what the cursor was on. Esc in
  normal mode leaves the tab, as before.
- Harmonic moves from N to **Shift+N**, still stepping natural, pinch, artificial, off.

## Normal mode

What the cursor is on is **selected**: a note's box on the tab is filled (`--primary-soft`), and a
selected staff note is filled in `--primary`, as MuseScore colours one. A column with no string picked
has the same filled box round its strings (round the staff's lines with the staff alone).

| Input | Does |
| --- | --- |
| Press on a note (tab number or staff head) | Selects it. |
| Press beside the notes (an empty string, a blank line or space) | Selects the column; adds nothing. |
| Digit, a staff note selected | Sets its length, MuseScore's numbers: 1 a 64th, 2 a 32nd, 3 a 16th, 4 an eighth, 5 a quarter, 6 a half, 7 a whole (Q1, Jeremy). |
| Digit, a tab note selected | Types its fret, two digits joining as before, and the staff follows (Q1, Jeremy). |
| ↑ ↓, tab | The selected notes a fret higher or lower on their own strings; nothing moves when one would pass 0 or 24. |
| Ctrl/⌘+↑ ↓, tab | The note to the next string up or down that plays the same pitch. |
| ↑ ↓, staff | The selected notes a semitone up or down (Q4, Jeremy). |
| Alt+Shift+↑ ↓, staff | A line or space, in the key. |
| Ctrl/⌘+↑ ↓, staff | An octave. |
| Alt+↑ ↓ | Selects the next note up or down the chord by pitch; from the column alone, its top or bottom note. |
| ← → | Selects the next or last column: its note on the same string, else the column. Adds no rests. |

With Shift+← → or Ctrl/⌘+A selecting columns, ↑ ↓ and their modifiers move every selected note.
The palette, the letter keys, Delete, Shift+← →, the jumps of `2026-10-30-tab-musescore-selection-design.md`,
copy, cut and paste work as before. Enter, # and b on the staff belong to note input; in normal mode b
is Bend, as on the tab.

## Note input

The keys are as they were before modes (`2026-10-25-tab-editing-design.md`,
`2026-10-27-tab-staff-entry-design.md`): digits type frets, ↑ ↓ move between strings or, on the staff,
lines and spaces; Alt+↑ ↓ move notes; Enter on the staff adds or takes away a note; → past a short bar
adds a rest to type on. The tab's cursor is outlined, as before; the staff's is the faint outlined head.

- **The shadow note** (Q2, Jeremy: "your cursor changes to the note representation"): under the
  pointer, over the staff, a faint note of the length a press would enter, on the line or space
  pointed at, with its ledger lines, stem and flag; over the tab, a faint 0 on the string pointed at.
  Its length is the cursor's column's, or a quarter on a rest.
- **A press adds a note** (Q3, Jeremy): on a string with no note, a 0 there (digits then change it); on
  a staff line or space, a note at that pitch on the string Frets picks, as Enter does. A press on a
  note puts the cursor on it.

## Either mode

- **Shift with a digit's key** sets the length when the tab has the keys, as MuseScore's tab input does:
  Shift+5 a quarter. It reads the key's place (`KeyboardEvent.code`), so any keyboard layout works.

## Reading

- "Behaves like MuseScore" on the staff was read as MuseScore's normal-mode length keys, since normal
  mode was the question.
- MuseScore's Alt+Shift+↑ ↓ on tab (a fret up or down, changing string to keep frets low) is not taken.
- Shift+digit lengths are not on the staff's cursor, where Shift+3 is the # that raises it.
- Note input is not stored: a reload starts in normal mode.

## Code

`normalMode.ts` (pure: MuseScore's length digits, `stepFrets`, `nextInChord`, `selectedNotes`).
`editorKeys.ts`: `normalKeyDown`, N and Esc, Shift+digit. `TabPage.tsx` keeps `inputMode`; its presses
on the tab and staff select or enter by mode. `TabClip.tsx` draws the selected or input look
(`Highlight.input`) and the shadow note (`shadow`, `ShadowNote` in `StaffDrawing.tsx`). `TabPalette.tsx`
draws the pencil.
