# Tab: the text annotation popover

Issue #342 ("FR: Dorico-style popovers in the Tab editor"), its second
step after the chord popover (`2026-11-10-tab-chord-popover-design.md`).
Asked 2026-11-14 (Jeremy): "We'll address text next." The design
questions and his picks (every recommendation) are in the questions page
linked from the PR.

The element is a **text annotation** (alphaTex `txt "..."`), and text
annotations on neighbouring columns are a **series of text annotations**
(Jeremy, 2026-11-15).

Editing follows Dorico first (`docs/tab-editing-principles.md`). Dorico's
Shift+X opens a text editor at the selection; Return starts a new
paragraph, Esc or Ctrl/Cmd+Return closes it keeping the text, and nothing
moves it on to the next note. MuseScore's staff text (Ctrl+T) is alike:
Return is a new line, Esc leaves it keeping the text. Guitar Pro 8 opens
a small dialog for the beat. Frets keeps its own Enter and Esc, the same
in all its popovers, and adds a move on, as its chord and lyrics popovers
have.

Frets already had a field for a text annotation (no key), opened from
the button in Bars › Text or a press on a drawn text annotation. This
step makes it the text annotation popover.

## What

- **Opening.** Shift+X (Dorico's key), or the "Text annotation over this
  column" button, opens the Text annotation field on the cursor's column,
  holding its text annotation. A press, Enter or a double-click on a
  drawn text annotation opens it there, as before.
- **Where it sits.** Hanging up from the top of the line's text
  annotations and chord names (long text annotations over the names,
  short ones under them), or from where they would go over the staff, so
  it covers neither them nor the column it writes on. It grows up as new
  lines are typed. The first line has no room over it, so there it opens
  under the line, as the chord popover does.
- **An empty bar** has no columns yet; the popover opens on the bar
  itself. A text annotation set there lands on the first of the rests
  that fill it (P1), as a chord name or a dynamic does; that writes every
  empty bar out as its Whole-bar rest. Moving over an empty bar without
  typing changes nothing. A new arrangement's empty first bar takes one
  too.
- **A series of text annotations.** Space is a space in a text
  annotation, so Tab takes the job Space has in the chord popover. Each
  of these sets what is typed on the popover's column (empty clears it),
  then moves the popover:
  - Tab: the next column (note or rest), into the next bar after the
    last one.
  - Shift+Tab: the column before, into the bar before's last column.
  Past the clip's last column (or before its first) the popover stays
  where it is, still open. It shows the next column's text annotation,
  selected, so typing replaces it.
- **Closing.** Enter sets the text annotation and closes; Shift+Enter is
  a new line (issue #445); Esc closes and leaves the popover's column as
  it was (text annotations set on earlier columns stay); leaving the
  field sets it. After Enter or Esc the keys go back to the tab.
- **The cursor follows** the popover from column to column. Each text
  annotation set is one undo step; a column passed over unchanged makes
  none.
- Cmd+B (bold, issue #446) and the 200-character limit are as before.

## Tests

- Shift+X opens the field; Space types a space and doesn't move; "let
  ring" Tab "P.M." Tab "fade" Enter sets a series of three text
  annotations across a bar line and closes; undo takes back "fade" alone.
- Shift+Tab goes back; Tab past the last column keeps the popover open on
  the same column; Esc leaves that column as it was.
- A two-line text annotation (Shift+Enter) is set whole by Tab.
- An empty bar passed over stays empty; a text annotation set on it
  lands on its first rest; a new arrangement's empty bar takes one.
- `wordSpot`: on a later line the field hangs up from over the text
  annotations and chord names, at its column; on the first line it opens
  under the line; on a line with nothing over it, it hangs up from over
  the staff.
- The `?` overlay lists Shift+X in the Palette, and Tab and Shift+Tab
  under "In the Text annotation field (Shift+X)".

## How

1. `popoverStep.ts` (was `chordPopover.ts`): `popoverStep`, where a move
   takes a chord or text annotation popover.
2. `WordField.tsx`: the Text annotation field's Tab and Shift+Tab, and
   `up`, a field hanging up from its spot (`.tab-word-up`).
3. `fieldSpots.ts`: the Text annotation field's spot.
4. `useHeadPanels.tsx`: `openWord` opens a text annotation on an empty
   bar; `finishPopover` (was `finishChord`) sets a chord name or a text
   annotation, fills an empty bar first, and moves the popover and the
   cursor.
5. `tools.ts`: Shift+X for the text annotation tool; `shortcuts.ts`: the
   Text annotation field's keys.
6. A test arrangement, `editing_tests/text-popover.atex`.

## Not yet

- Older specs and code comments still say "Text" for a text annotation;
  renaming them is a follow-up.
- The rest of issue #342's popovers; Time signature (Shift+M) is next.
- A text annotation at any time in a bar (issue #399, as for chord names).
