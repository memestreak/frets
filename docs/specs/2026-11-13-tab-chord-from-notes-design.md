# Tab: a chord from picked notes

Issue #464. Asked 2026-11-13 (Jeremy): "Generate chords and chord symbols
from given staff entries. It should be possible to select a set of notes
to be rendered as a chord (even if its a broken chord, i.e, part of a
chord, or arpeggiated)." His example: Capo 2, a column with frets
5 / 5 / 5 / 7 on the top four strings.

Questions and his calls: the questions artifact
(https://claude.ai/artifact/2xw9A2uTCju1Et8ZiYpwqc). He took the
recommendation for each but two: Q1 is a setting (the shape's name by
default, the sounding one selectable), and Q7 is the right-click menu only.

What the others do. Dorico (first): Write › Generate Chord Symbols from
Selection names the selected notes' harmony and writes chord symbols, no
key by default; with a capo a chord symbol has a main (sounding) chord and
a capo chord (the shape played), shown either or both. MuseScore: nothing
built in (plugins). Guitar Pro 8: Note › Chord… (A) on a beat with no
chord fills the diagram with that beat's notes, and Add puts it in the
track's chord library; one beat only.

## What

- **What it names (Q2, Q8).** The selected columns, or the cursor's column
  when nothing is selected, and the notes of every Voice starting in their
  time: one chord, however many beats the notes spread over (a broken
  chord, an arpeggio). Rests and dead notes (x) are left out; tied notes
  count.
- **The name (Q1, Q3).** Every picked note counts, the lowest is the bass,
  and the name is the first `nameNotes` gives (the Chord lab's ranking:
  exact names first, common types, root in the bass). Frets are counted
  from the capo, as the Chords panel counts them, so 5 5 5 7 under Capo 2
  is **Am** (it sounds Bm, which the staff shows). Settings › Tab ›
  Editing › "Chord from notes, with a capo" can say Sounding name instead
  (`chordNames`, `shape` by default, in `frets.tab.editing`): then the capo
  counts and the same notes are **Bm**. The shape written is the same
  either way, counted from the capo as tab is. Fewer than two
  different notes, or notes no chord type spells (two notes but a 5th, a
  cluster, a passing note too many), write nothing; the line under the
  clip says why.
- **Where it goes (Q2, Q4).** Straight over the first picked column of the
  Active voice, replacing a name there, as Dorico writes at once. One undo
  step takes back the name and the shape.
- **The shape (Q5).** Each string's first picked note; a string with none
  is muted (x).
- **The Chord set (Q6).** The shape goes in as the name's `\chord`
  definition. A name the set already has with the same shape (its
  definition's, or for a name only typed, the shape it is drawn with) is
  used again, adding nothing. With another shape it is added under a free
  name ("Am 2", as Copy to new chord names a copy), so nothing else in the
  track changes.
- **How to start it (Q7).** The right-click menu only: "Chord from notes"
  in the note menu on picked notes (a picked note, a selection, or Shift+F10
  on them), and in the bar menu on a selection of whole bars that holds
  notes. Not offered on a rest. No button, no key.

## Tests

- 5 5 5 7 under Capo 2 is Am, shape 5 5 5 7 x x; with the sounding name
  chosen, Bm, the same shape.
- An A minor arpeggio of eighths over four columns is one Am, shape
  0 1 2 2 0 x.
- C E B♭ is C7no5; C and E alone write nothing.
- A string picked twice keeps its first fret in the shape; the later note
  still counts for the name.
- A bass in Voice 2 makes C/E from Voice 1's C E G, from either Voice.
- One note, or C C♯ D D♯ E, write nothing and say why.
- Dead notes and rests are left out; only rests or dead notes say to pick
  notes first.
- Written: the name over the first column, the shape in the Chord set; a
  name with the same shape adds nothing; with another shape it is "Am 2"
  and the first Am stays; a name only typed counts with the shape it is
  drawn with; a name the column had is replaced.
- On the page: Shift+→ three times over an arpeggio, then the note menu's
  Chord from notes, names it Am in one undo step; with nothing selected it
  names the cursor's column; with Sounding name saved, Bm; a single note
  says why and changes nothing; a rest's menu has no Chord from notes; the
  bar menu on picked bars with notes ends with it, and Ctrl/⌘+A then its
  Chord from notes names the bar.
- Settings › Tab › Editing: "Chord from notes, with a capo" is Shape name
  by default and saves `chordNames: 'sounding'`.

## How

1. `chordFromNotes.ts`: `pickedNotes`, `chordFromNotes`,
   `writeChordFromNotes`. `freeName` moves to `chordSet.ts`.
2. `editingPrefs.ts`, `tabSettings.tsx`: `chordNames` and its field.
3. `TabPage.tsx`: `chordFromPicked` and the menus' item.
4. A test arrangement, `editing_tests/chord-from-notes.atex`.

## Not yet

- Several chords from one selection, one where the harmony changes
  (Dorico).
- Both names at once, the sounding one with the shape's beside it, as
  Dorico's capo chord symbols.
- A key or a button for it.
