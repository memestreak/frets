# Tab: tuplets, grace notes, tremolo picking and time signature changes

This is the third of the three "Next" PRs from the alphaTex triage
(https://claude.ai/artifact/FkNzi3PhjegeM4Aev5RsBL). The first two are
`2026-10-26-tab-note-marks-design.md` and `2026-10-26-tab-words-design.md`.
Before this PR, these were kept as written but not drawn. Jeremy asked for
time signature changes to be folded in ("fold the time signature change into
the rhythm PR", 2026-10-26).

## What is drawn

| Mark | alphaTex | Drawn |
| --- | --- | --- |
| Tuplet | `tu 3`, `tu 5`, `tu 6`, `tu 7` on each beat | its number under each group of n |
| Grace note | `gr` (before the beat), `gr ob` (on it) | small numbers in a narrow column, no stem |
| Tremolo picking | `tp 8`, `tp 16`, `tp 32` | one, two or three slashes across the stem |
| Time signature change | `\ts (3 4)` at the start of a later bar | the two numbers just inside that bar |

Tuplet spans follow alphaTab's defaults: three in the time of two, and five,
six or seven in the time of four.

## The model

- `Duration.tuplet?: 3 | 5 | 6 | 7` replaces `triplet: boolean`.
- `WHOLE` is now 26880 (768 × 5 × 7), so every duration in any tuplet is a
  whole number of ticks.
- `Column.grace?: 'before' | 'on'`. A grace note takes no time: `barLength`
  skips it, and so do beams and the check for a full bar.
  - alphaTab sets a grace note's length from its group whatever is written:
    an eighth alone, sixteenths for two, thirty-seconds for three or more.
    The writer writes those lengths, plain, with no dots or tuplet.
  - The clip keeps the column's own duration while it is a grace note, so
    turning grace off gives back its length.
- `Column.tremolo?: 8 | 16 | 32`. It is read from `tp 8/16/32` or from marks
  1 to 3, and written as the note value.
- `Bar.time?: TimeSignature` marks a change from that bar on.
  - `timeAt(clip, bar)` gives the time in force, and `changesTime` says
    whether a bar starts a change.
  - `normalize` keeps every `time` a change: one on the first bar becomes the
    clip's own, and one that repeats the time already in force is dropped.
  - A later `\ts` that repeats the time is dropped on reading too.
- **Kept as written:** `tu 9` and other tuplets, `gr b` (bend grace notes),
  `tp 4` and more slashes, and tremolo styles such as buzz roll. They are
  listed in the kept line.
- **Bars that don't add up** are named by their own time ("Bar 1 doesn't add
  up to 4/4; bars 2 and 3 don't add up to 3/4.", `unevenMessage`).

## Setting them

A new **Rhythm** palette group sits after Duration:

| Button | Key |
| --- | --- |
| Triplet (moved here from Duration) | Alt+3 |
| Quintuplet | Alt+5 |
| Sextuplet | Alt+6 |
| Septuplet | Alt+7 |
| Grace note | Shift+G |
| Tremolo picking: eighths | Shift+T |
| Tremolo picking: sixteenths | Shift+T |
| Tremolo picking: thirty-seconds | Shift+T |

- A tuplet button sets that tuplet on the cursor's column, or on every
  selected column; pressing it again makes them plain. Alt with a digit is
  read by the key's place (`code`), and no longer types a fret: before this
  PR, Alt+3 typed a 3.
- Grace toggles before-the-beat grace notes. G alone is still a ghost note.
- Shift+T steps through 8, 16, 32 and off. T alone is still a tap.

The Repeats group is renamed **Bars**, and its first button, drawn as N over
M, is **Time signature from this bar**. It opens a panel over the cursor's
bar (under the staff, from the bar's start). It only starts a new time
signature. In a bar that already shows one (the first bar, or a bar that
changes it), the button is disabled, and the drawn numbers are what you
press. The button never shows as pressed (Jeremy, 2026-10-26: "if there is a
time signature, I want the time signature to be the thing that is clicked").

- The panel's fields: beats with
  a − / + stepper, and the beat's value. Each change is one undo step.
- On a later bar, **Remove the change** takes the change away. It is disabled
  while the bar has no change of its own, so the panel never changes size.
  Setting the time back to the one before also removes the change.
- On the first bar, opened from its drawn numbers, it sets the clip's own
  time signature and has no Remove button.
- A press on any drawn time signature opens its bar's panel, the first line's
  for bar 1.
- A click outside or Esc closes it. Esc gives the keys back to the tab.

## The header gives way to the clip

Jeremy, 2026-10-26: the time signature "should be clickable from the clip
not from some widget above the palette. It's not something that applies to
the entire page." The same day he called the capo button "very weird" and
picked a palette tool for it (option 1 of three). So:

- The 4/4 button and the capo button under the clip's name are gone. The
  line under the name says only what the tab doesn't: a tuning other than
  standard, and "Example: edits aren't saved".
- The time signature is set from the drawn numbers or the Bars group's
  button (above).
- **Capo** joins the Text group. It opens the word field ("Capo on fret,
  1 to 12"; empty or 0 takes it off), and the tab draws "Capo 3" over the
  start of its first line in a row of its own. A press there edits it.
  Exported images draw it the same way, so the export no longer adds its
  own capo line.

## Elsewhere

- **ASCII:** a digit after a rhythm letter is a tuplet (`s5`). ASCII tab has
  no grace notes, tremolo picking or time changes, so its writer leaves them
  out.
- **Copying columns:** the copy takes the time signature its first bar is
  in, and any changes after that.
- **Examples:** Tuplets, Grace notes and tremolo picking, and Changing time.
  The agent guide's section 7 gains "Shred".

## Checked in the browser

`verify5.js` (scratch) pressed every new button and key, on and off:

- each tuplet by button and by Alt+digit, then Alt+3 on a selection;
- grace notes by button and Shift+G, alone and two together, with g still
  a ghost note;
- each tremolo button, the Shift+T cycle, and t still a tap;
- the bar panel from its button and from the drawn numbers: −, +, beat 8,
  Remove, back to the time before, Esc, a click outside, the first bar's
  panel, and undo.

All 79 checks passed. `verify6.js` checked the header and the capo: it
pressed the Capo button, typed into the field, then checked Enter, a press
on the drawn capo, 15 kept to 12, Esc, and empty taking it off. It also
checked the time signature from the drawn 4/4, the export preview drawing
the capo once, and the facts line. All 16 checks passed.
