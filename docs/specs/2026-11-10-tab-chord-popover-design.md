# Tab: the chord popover

Issue #342 ("FR: Dorico-style popovers in the Tab editor"). Asked
2026-11-10 (Jeremy): "Let's begin work on the popover FR and start with
chords." This step is the chord symbol popover only; the issue's other
popovers (Text, Tempo, Time signature, Key signature, Playing techniques)
come later. Dynamics (Shift+D) and Lyrics (Shift+L) already have theirs.

Editing follows Dorico first (`docs/tab-editing-principles.md`). Dorico's
chord symbols popover opens on Shift+Q at the selection or caret, and
stays open as Space moves it to the next beat and Tab to the next bar, so
a run of chord symbols is typed in one go; Enter closes it. MuseScore's
Ctrl+K entry is alike (Space next note or beat, Shift+Space back), and
keeps a name it can't read as plain text.

Frets already had a Chord name field (key `C`): Enter set the name and
closed it. This step makes that field the chord popover.

## What

- **Opening.** Shift+Q (Dorico's key), or the Chord name button in
  Bars › Text, opens the field over the cursor's column, holding its
  chord name. On a picked chord name it opens on that name, as Enter and
  a double-click already do. `C` no longer opens it: one way to do a
  thing, and Dorico's key.
- **Where it sits.** Wholly over where the line's chord names go (over
  the staff, or over the tab when only it is drawn), so it never covers
  the column it names, as Dorico's popover sits over the staff. The first
  line has no room over it, so there it opens under the line. (Before,
  the field half covered the staff, and in Staff view it opened over the
  hidden tab's place, on the notes.)
- **An empty bar** has no columns yet; the popover opens on the bar
  itself. A name set there lands on the first of the rests that fill it
  (P1), as a dynamic does; like a dynamic, that writes every empty bar
  out as its Whole-bar rest. Moving over an empty bar without typing a
  name changes nothing.
- **Moving on.** Each of these sets what is typed on the popover's
  column (empty clears it), then moves the popover:
  - Space: the next column (note or rest), into the next bar after the
    last one.
  - Shift+Space: the column before, into the bar before's last column.
  - Tab: the first column of the next bar.
  - Shift+Tab: the first column of the bar before.
  Each column is one stop: a name partway through a held note is
  issue #399. Past the clip's last column (or before its first) the
  popover stays where it is, still open, so the keys typed next never
  reach the tab as tools. The popover shows the next column's chord name,
  selected, so typing replaces it and Space passes over it unchanged.
- **Closing.** Enter sets the name and closes; Esc closes and leaves the
  popover's column as it was (names set on earlier columns stay); leaving
  the field sets the name. After Enter or Esc the keys go back to the tab.
- **A space in a name.** Alt+Space (Option+Space on a Mac) types a space
  without moving on, as in Dorico's lyrics popover and MuseScore's chord
  entry.
- **The cursor follows** the popover from column to column. Each name set
  is one undo step; a column passed over unchanged makes none.
- **Names.** Any text is kept. A name that isn't a chord ("N.C.") stays
  plain text with no warning, as the Chord set spec has it
  (`2026-11-05-tab-chord-set-design.md`).

## Tests

- `chordStep`: Space from a bar's last column goes to the next bar's
  first; an empty bar is one stop; Shift+Space from a bar's first column
  goes to the bar before's last; Tab and Shift+Tab go bar to bar; past
  either end it is null.
- Shift+Q opens the field; Am Space C Space G7 Enter names three columns
  across a bar line and closes; undo takes back G7 alone.
- Tab past the last bar keeps the popover open on the same column.
- Alt+Space types a space at the caret and doesn't move; Esc leaves the
  column's name as it was.
- An empty bar passed over stays empty; a name set on it lands on its
  first rest.
- `C` no longer opens the field; the existing chord field tests open it
  with Shift+Q.

## How

1. `chordPopover.ts`: `chordStep`, where a move takes the popover.
2. `WordField.tsx`: the chord field's keys (Space, Shift+Space, Tab,
   Shift+Tab, Alt+Space) and `onDone`'s move.
3. `useHeadPanels.tsx`: `openWord` opens a chord name on an empty bar;
   `finishChord` sets the name, fills an empty bar first, and moves the
   popover and the cursor.
4. `tools.ts`: Shift+Q for the Chord name tool, `C` dropped; the `?`
   overlay lists it from there.
5. A test arrangement, `editing_tests/chord-popover.atex`.

## Not yet

- The rest of issue #342's popovers.
- Suggestions while typing (Dorico's popover has none).
- A name at any time in a bar (issue #399), which would let Space step by
  the rhythmic grid as Dorico's does.
