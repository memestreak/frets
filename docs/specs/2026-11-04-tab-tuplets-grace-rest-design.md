# Tab: Tuplets, grace notes and rests

Step 6 of the build order in the Tab editing principles
(`docs/tab-editing-principles.md`, choices A9, A13 and
A14, with P1, P4 and P10). Jeremy settled the questions below on
2026-11-04 (Q1–Q18 in the thread "Plan tuplets, grace notes and R
(step 6)", run with /grill-with-docs; the rounds are on the page
https://claude.ai/artifact/Pk8Zt1s8XSFCJNhz9cYS55). Writing over,
pushing and pulling are step 4's
(`docs/specs/2026-11-04-tab-bars-always-full-design.md`); Gaps are
written by the meter (`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`).

A tuplet and a grace note no longer change a bar's time. In normal mode a
tuplet takes the picked note's time, or squeezes the selected notes, and
a grace note is added before the picked note. In note input, Tuplet entry
and Grace entry are toggles, lit while on, as in Dorico. The keys are
Dorico's: `;` for tuplets, `/` for grace notes, `,` for rests (Q14, b).
Nothing stored changes: a tuplet is still a mark on each of its Columns
(alphaTex `{tu n}`), a grace note still a Column that takes no time
(`{gr}`).

## Tuplets in normal mode

**On one picked note (Q1).** A tuplet takes the note's time: the note
becomes the tuplet's first note, and the rest of the tuplet is a Gap. A
triplet splits the note's value in halves (a quarter: three triplet
eighths), a tuplet of 5, 6 or 7 in quarters of it (a quarter: sixteenths),
one of 9 to 12 in eighths of it (a quarter: thirty-seconds). A Tie chain
counts when its length is one plain value (`q~q`, a half). Nothing happens,
and the line under the clip says why, on:

- a dotted note, or a Tie chain that isn't one plain value: "A tuplet
  goes on a note without a dot.";
- a note whose tuplet would need notes shorter than a sixty-fourth: "That
  tuplet's notes would be shorter than a sixty-fourth.";
- a tuplet across a bar line, as step 4 refuses ("That would put a tuplet
  across a bar line.").

**On a selection of several Columns (Q2).** As Dorico's "turn notes into
a tuplet": the notes keep their written values and are squeezed, n in the
time of the tuplet's span. Three eighths become an eighth triplet over
one quarter, and the eighth after it is a Gap. A squeezed run that doesn't
fill its last tuplet ends in a Gap inside the tuplet: two eighths become a
triplet whose third note is a Gap. Where the tuplet is longer than the
selection's time it writes over what follows (P7); shorter leaves a Gap.
A selection that holds a tuplet already, or a note whose squeezed value
can't be written, is refused with a line under the clip.

**Rests inside a tuplet (Q3)** are the fewest rests in the tuplet's own
values, longest first: a triplet with only its first note is drawn
eighth, then a triplet quarter rest. An imported tuplet keeps its rests
until an edit changes that bar's rhythm, as A3 has it for any bar.

**Taking a tuplet away (Q4).** The same tuplet again from the Tuplet
panel, None there, or the picked tuplet number and Delete (as a picked
tie arc and Delete unties): the notes keep their written values and are
laid out again from the tuplet's start, plain. A Gap at the tuplet's end
is dropped, so a shorter result leaves a Gap and a longer one writes over
what follows (P7). A quarter made a triplet and back is an eighth, then an
eighth Gap; three triplet eighths go back to three eighths.

**Inside a tuplet (Q5).** The length keys work within the tuplet: longer
writes over its later notes and does nothing when there isn't room before
its end; shorter leaves a Gap inside it. Delete leaves a Gap inside it. A
tuplet with no notes left goes, and its time is a Gap written by the
meter. Frets and marks work as on any note. (This replaces step 4's "the
length keys do nothing on a note inside a tuplet".)

## Tuplet entry in note input (Q6, Q7)

- **On and off.** In note input, picking a tuplet from the Tuplet panel
  (`;`, or the Rail's Tuplet button) turns Tuplet entry on, and the Tuplet
  button stays lit, showing which tuplet, until the same tuplet or None is
  picked, or note input is left.
- **Typing.** A fret typed in a Gap starts a tuplet at the cursor whose
  notes are the Input length: an eighth with a triplet makes a triplet of
  eighths over a quarter. The cursor then moves through the tuplet one
  tuplet note at a time. Past its end, the next note typed starts a new
  tuplet.
- **Another Input length inside a tuplet** makes a note of that length in
  the tuplet's ratio when it fits before the tuplet's end; otherwise
  nothing happens.
- **The Grid inside a tuplet that is already there**, Tuplet entry on or
  off: ← →, Shift+Space and a press stop at each tuplet note's place in
  its Gaps, not at the Grid's. A fret typed there is a tuplet note, the
  Input length in the tuplet's ratio, if it fits.

## Grace notes

**Normal mode (Q8, Q10).** `/` (or the Grace button) adds a grace note
before the picked note, at the same fret, moving nothing. Only the picked
string gets one; a whole Column picked gets a grace chord. The cursor
moves onto the new grace note, so a fret typed changes it. `/` on a grace
note adds another before it. Delete, cut or `,` on a picked grace note
removes it and leaves no Gap. `/` never turns a grace note into a normal
note.

**Values (Q9).** As guitar books and alphaTab have them: one grace note
before a note is a slashed eighth, two are sixteenths, three or more
thirty-seconds. They are written so after every edit. The length keys and
Duration buttons do nothing on a grace note, and Duration lights nothing
for one.

**Grace entry (Q11).** In note input, `/` turns Grace entry on, and the
Grace button stays lit until `/` again or note input is left. Each fret
typed adds a grace note before the time at the cursor, after any already
there; the cursor stays at that time, so with Grace entry off the next
fret typed is the main note. Two-digit frets join as usual. With Tuplet
entry on too, Grace entry wins for the typed note.

## Rests (Q12, Q13, Q18)

- **`,` in note input** writes a Gap of the Input length at the cursor,
  over any notes there (MuseScore's 0, Dorico's rest entry), and moves the
  cursor on by the Input length. With Tuplet entry on it moves on by one
  tuplet note, so a tuplet can start with a rest; the tuplet is made when
  its first note is typed, from where the rest began. With Grace entry on,
  `,` does nothing.
- **`,` in normal mode** does what Delete does: on a selection, a Tie
  chain or a grace note; nothing on a picked rest.
- The **Rest** tool does the same as `,`, and never lights: a rest can't
  be set.

## Keys (Q14, Q16, Q17, Q18)

Dorico's, without its popovers (those are FR #342):

| Key | Does | Was |
| --- | --- | --- |
| `;` | Opens the Tuplet panel at the cursor: 3, 5, 6, 7, 9–12 or ↑ ↓ and Enter pick, Esc closes | Alt+3, 5, 6, 7 (gone) |
| `/` | Grace before the picked note; Grace entry in note input | Shift+G (gone) |
| Alt+`/` | The slide from the note before, stepping through its kinds (read by the key's place, as Alt+T) | `/` |
| `,` | Rest: a Gap of the Input length in note input, Delete in normal mode | R |
| R | Nothing (Dorico's repeat is an FR) | Rest |

`\` stays slide out. When FR #342 is built, a typed popover takes the
Tuplet panel's place on `;`. The tools' tips and the `?` overlay
(`shortcuts.ts`) name the new keys, and the overlay lists Tuplet entry,
Grace entry and Delete on a picked tuplet number.

## What doesn't change (Q15)

- alphaTex, links, saves, Guitar Pro, MusicXML and ASCII tab: the stored
  form is the same, so the exports are unchanged. ASCII tab still leaves
  grace notes out.
- `public/tab-alphatex.txt` and `public/skills/frets-tab/SKILL.md`: their
  tuplet and grace rules already hold, and they name no editing keys.
- No Preference is added or removed.
- Uneven bars now come only from an import or a link: Tuplet and Grace no
  longer make them.

## How

- `noteEdits.ts`: `setTuplet` and `toggleTuplet` become `tupletOver`
  (one note, Q1), `squeezeTuplet` (a selection, Q2) and `untuplet` (Q4),
  each through `timeline.ts`'s write over; `toggleGrace` becomes
  `addGrace`; `makeRest` goes, `,` in normal mode calling Delete's path.
- `sounding.ts`: `writeVoice` spells the Gaps inside a tuplet block as the
  fewest rests in its values (Q3), drops a tuplet with no notes, and
  writes grace values by count (Q9).
- `timeline.ts`: the length keys inside a tuplet (Q5).
- `grid.ts`: inside a tuplet's Gaps the stops are its notes' places (Q7).
- `useEditorState.ts`: Tuplet entry and Grace entry, set off when note
  input is left; `editorKeys.ts`: typing with them on, `,` in note input.
- `tools.ts`: keys and tips as the table; the Rest tool never lights;
  Tuplet and Grace light for the entry modes in note input.
- `TabPalette.tsx`, `TabRail.tsx`: `;` opens the Tuplet panel at the
  cursor, kept to the keyboard (digits, ↑ ↓, Enter, Esc).
- `shortcuts.ts`: the keys above.
- `editing_tests/`: add `tuplet-on-a-note.atex`, `notes-into-tuplet.atex`,
  `tuplet-entry.atex`, `grace-before.atex` and
  `rest-key-in-note-input.atex`.

## Tests

`src/__tests__/tab/` (pure tests next to `tuplets.test.ts`, page tests in
`page/`):

- `;` then 3 on a picked quarter on beat 1: a triplet eighth with the
  quarter's fret, then a triplet quarter rest, the bar still 4/4 full;
  5, 6 and 7 split a quarter in sixteenths, 9 in thirty-seconds.
- A triplet on `q~q` within a bar makes triplet quarters; on a dotted
  quarter, on `q~e`, and a 9 on a sixteenth, the Clip is unchanged and the
  line under the clip gives the sentence above.
- Three selected eighths on beat 1, triplet: an eighth triplet over beat 1
  and an eighth Gap after it; two selected eighths: a triplet whose third
  note is a Gap, nothing after it moved.
- None (and the triplet again, and Delete on the picked tuplet number) on
  a triplet made from a quarter: an eighth then an eighth Gap; on three
  triplet eighths: three plain eighths, writing over the next eighth.
- Inside a triplet of eighths, the quarter key on its first note makes a
  triplet quarter over the second; on its third note nothing changes;
  Delete on its only note leaves no tuplet, a plain Gap by the meter.
- Note input, Input length an eighth, triplet picked: the Tuplet button
  lights; three frets typed with → between make one triplet over a
  quarter, a fourth starts a new one; picking None or leaving note input
  turns it off. A sixteenth Input length inside an eighth triplet types a
  triplet sixteenth.
- In a triplet's Gap, → stops at each triplet eighth, Tuplet entry off.
- `/` on a picked note: a grace note at the same fret before it, bar time
  unchanged, cursor on the grace note; `/` on that grace note adds a
  second, and both are written as sixteenths, a third makes them
  thirty-seconds; one alone is a slashed eighth.
- The length keys on a grace note leave the Clip unchanged and Duration
  lights nothing; Delete and `,` on it remove it and leave no Gap.
- Grace entry: `/` in note input lights Grace; frets 5 then 7 typed at a
  quarter's time make two grace notes before it, cursor at that time;
  `/` again, fret 9 is the main note.
- `,` in note input, Input length a quarter, on a half on beat 1: a
  quarter Gap over its first half, the cursor on beat 2; with Tuplet entry
  on, `,` then a fret makes a triplet starting with a rest. With Grace
  entry on, `,` does nothing.
- `,` in normal mode on a picked note equals Delete; on a picked rest the
  Clip is unchanged; the Rest tool never lights.
- Keys: Alt+3, Shift+G and R do nothing; Alt+/ cycles the slide as `/`
  did; `;` opens the Tuplet panel, 5 there picks a quintuplet, Esc closes
  it; the tips and the `?` overlay list `;`, `/`, Alt+/ and `,`.
- alphaTex, MusicXML, Guitar Pro and ASCII tab of a triplet and a grace
  note made by these keys are the same as of ones typed in alphaTex.

## Settled while building

- **Another tuplet on a tuplet note** (a 5 picked on a triplet's note) is
  refused with "Take the tuplet away first: these notes are in one
  already.", as a selection holding a tuplet is (Q2). The same tuplet, or
  None, takes it away (Q4).
- **A tuplet's notes are grouped by their time**, as alphaTab groups them:
  a group ends where its notes add up to a plain value. So a triplet
  sixteenth typed after a triplet eighth (Q6) closes a group of its own
  (`t8 t16` is three triplet sixteenths, an eighth's time), and the rest
  of the first tuplet's time becomes a plain Gap. The note is still a
  triplet sixteenth, as the spec asks; the stored form can't say more
  without changing alphaTex (Q15).
- **Tuplet entry on a note** that is in no tuplet starts a tuplet there,
  over it, as on a Gap.
- **A fret typed on a tuplet note** in note input sets its fret, and its
  length to the Input length in the tuplet's ratio when that fits (Q5's
  rule for the length keys).
- **`,` with Tuplet entry on** writes the tuplet's whole time as a Gap at
  its first `,` (the Gap must be spellable before any note makes the
  tuplet), then steps the cursor one tuplet note at a time (Q12).
- **The Tuplet panel `;` opens** starts with the lit tuplet picked for
  ↑ ↓, or 3 when none is lit; 1 then 0, 1 or 2 within a second picks 10
  to 12.
- **A grace note keeps its place** when the meter writes its bar again:
  the cursor on the second of two grace notes stays on the second.
- **The rail's panel sits over the pinned playback bar**, so a tool's
  panel (the Tuplet button's, with None at its end) can be pressed where
  it runs past the rail.
