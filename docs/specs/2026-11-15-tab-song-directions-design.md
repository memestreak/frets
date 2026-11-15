# Tab: song directions

Issue #496 ("FR: Tab: draw song directions (Segno, Coda, D.C., D.S., Fine),
triplet feel and repeat-bar signs"), asked 2026-11-15 (Jeremy). This spec
covers the first of its three parts, the **Directions**; triplet feel and
bar repeats follow in their own PRs and add their sections here. The
design questions and Jeremy's picks are in the questions page linked from
the PR.

alphaTex already has them: `\jump <name>` on a bar, one of alphaTab's 19
Direction names (`MasterBar.directions`), and alphaTab plays them. Frets
kept `\jump` as written without drawing it. No Frets alphaTex extension
is added.

What the other programs do (editing follows Dorico first,
`docs/tab-editing-principles.md`):

- **Dorico** calls them repeat markers: Segno, Coda, Fine, D.C., D.S.,
  their "al Coda" and "al Fine" forms and To Coda. They're added from the
  Repeat Structures panel or the Shift+R popover (`segno`, `coda`, `ds al
  coda`), sit over the system at the bar line (Segno and Coda at the
  bar's start, jumps at its end), are picked and deleted like any item,
  and playback follows them, without repeats after a jump by default.
  A Coda after a gap in the system is a layout option.
- **MuseScore** has them in the Repeats & Jumps palette (Segno, Coda,
  To Coda, Fine, D.C./D.S. al …), drawn as text or Bravura signs over the
  staff at the bar's start or end; "Play repeats" after a jump is off by
  default.
- **Guitar Pro 8** has Directions (its name, alphaTab's too) in the Bar
  menu's dialog, with checkboxes for the targets and the jumps; drawn
  over the staff, played back.

## What

- **Name** (Q13). A **Direction**: Segno, Coda, Fine, and the jumps D.C.,
  D.S., their "al Coda" and "al Fine" forms and To Coda.
- **Where it's drawn** (Q1). On its own row over the tab or staff (above
  1st/2nd ending brackets, under a section's name). Segno and Coda sit at
  the start of their bar, just right of its opening line; Fine, To Coda
  and the D.C. and D.S. jumps are right-aligned to its closing line. Two
  on one bar sit side by side, the first written nearest its bar line. A
  Direction that would touch one before it moves up a level, as sections
  and Text do; a jump at one bar's end and a Coda at the next one's start
  fit side by side, the bar line between them. A Direction never wraps.
  A line with none takes no room.
- **Look** (Q2), as guitar books print them: Bravura's Segno and Coda
  signs (a Segno about 17 pixels tall, a Coda 23); "⊕ Coda" (the sign
  then the word), "To Coda ⊕"; the words bold italic, a little under a
  section's size: "Fine", "D.S. al Coda", "D.C. al Fine". The double
  Segno and double Coda alphaTex has are drawn as two signs; "D.S.S.",
  "D.C. al Double Coda" and the rest as words.
- **No Coda gap yet** (Q3): a Coda bar doesn't start a new line or leave a
  gap before it. Multi-bar rests stop at a Direction (a jump closes the
  run at its bar; a Segno or Coda opens a new one).
- **Adding** (Q4).
  - The **Bars palette's Direction button** (Segno icon), lit while the
    cursor's bar has a Direction, opens the cursor's bar's **Direction
    panel**.
  - The **bar menu's Directions…** (after Delete bar) opens the pressed
    bar's panel.
  - The panel, "Directions in bar N", has two rows of toggles, each drawn
    as it is on the tab: **Start of the bar** (Segno, Coda) and **End of
    the bar** (Fine, To Coda, D.S., D.S. al Coda, D.S. al Fine, D.C., D.C.
    al Coda, D.C. al Fine). A bar's Direction the panel doesn't offer
    (the double Segno or Coda, D.S.S.) is listed at the end of its row so
    it can be taken away. Each toggle changes the clip at once and is its
    own undo step; Esc or a press elsewhere closes it, as the key
    signature's panel does.
  - **The direction popover, Shift+R** (Dorico's repeat structures key;
    Jeremy, 2026-11-15, in this PR). It opens under the cursor's line
    beside its column, as the technique popover (Shift+P) does, on any bar,
    an empty one too. A name or short form typed lists the matching
    Directions as you type, each with "Bar start" or "Bar end" beside it:
    its name ("D.S. al Coda", case and dots not counting) or Dorico's words
    (`ds al coda`, `dc al fine`, `to coda`, `tocoda`, `ds`, `dc`, `sign`).
    The one named exactly comes first. Enter, or a press in the list, adds
    it to the cursor's bar and closes, as one undo step; the keys go back to
    the tab. Like Shift+P it only adds: a Direction the bar has stays, and
    taking one away is the panel's or Delete's job. A word naming none
    shows a ⚠ and keeps it open; Esc closes the list, then the popover,
    adding nothing. Repeats and endings may join it later.
- **Picking, editing, deleting** (Q5), as with sections and other marks
  over the tab: a press on a drawn Direction picks it alone, in blue;
  Ctrl/⌘+Alt+arrows step onto it (start ones after the bar's words, end
  ones before its bar line); a right-click picks it and opens "Edit" and
  "Delete"; Edit, a double-click or Enter opens its bar's panel; Delete
  or Backspace takes it away, leaving nothing picked.
- **Playback** (Q6, Q7). alphaTab plays the form: D.S. back to the Segno,
  D.C. to the start, "al Fine" stops at Fine, "al Coda" leaves at To Coda
  for the Coda. After a D.S. or D.C. jump, repeats are not played again
  (alphaTab's rule, Dorico's and MuseScore's default). The playhead
  follows the jumps. Play from the cursor, Loop and the count-in start
  from the first time a bar is played.
- **The text views and export**. The AlphaTex view writes `\jump name`;
  ASCII Tab leaves Directions out, as it does sections. MusicXML writes
  each as a `<direction>` (`<segno/>`, `<coda/>`, `<words>`) with its
  `<sound>` (`segno`, `coda`, `fine`, `dacapo`, `dalsegno`, `tocoda`).
  Re-barring an import moves a bar's Directions with its music (start
  ones to the bar its first beat lands in, end ones to the one its end
  does). A paste doesn't bring Directions (they label a place in the
  form, as sections do). A chat agent sees "the D.S. al Coda direction in bar 4" when it
  is picked.

## How

- `clip.ts`: `DIRECTION_NAMES` (alphaTab's Direction order) and
  `MasterBar.directions`; `alphatexRead.ts` reads `\jump`, `alphatex.ts`
  writes it.
- `directions.ts`: each Direction's look and end of its bar,
  `placeDirections` (stacked with `stackWords`), `toggleDirection`,
  `setDirection`.
- `layout.ts` / `rows.ts`: the Directions row and its levels;
  `layoutText.ts`: picking (`DirectionHit`); `ClipWords.tsx`:
  `DirectionMark` draws one.
- `named.ts`: how the technique and direction popovers match what is
  typed; `directions.ts` `directionsFor` and its words; `WordField.tsx`
  kind `direction`; `editorKeys.ts` Shift+R.
- `DirectionPanel.tsx`, opened by `useHeadPanels`; `tools.ts` and
  `TabPalette.tsx`: the Direction button; `TabPage.tsx`: the bar menu
  item.
- `smufl.ts`: the Segno and Coda outlines.
- Built-in `song_structure/song-directions.atex`; test arrangement
  `editing_tests/directions.atex`.

## Tests

- Every `\jump` name alphaTex has reads into `directions` and writes back
  exactly, before the tempo; a saved clip with a repeated or unknown name
  is refused.
- A paste doesn't bring the copied bars' Directions.
- A bar's Directions are kept in alphaTab's order whatever order they
  were toggled in; taking the last away removes the field.
- Segno and Coda are placed from their bar's start, jumps right-aligned
  to its end; two at one bar's end sit side by side, the first nearest
  the bar line.
- A jump at a bar's end and a Coda at the next bar's start share a level;
  two that would touch stack, the later one a level up.
- A line with no Direction adds no height.
- Playback of D.S. al Coda plays bars 1, 2, 3, 4, 2, 3, 5 (Segno on 2, To
  Coda on 3, D.S. al Coda on 4, Coda on 5); D.C. al Fine plays 1, 2, 3, 1,
  2 (Fine on 2).
- The Bars palette's Direction button opens "Directions in bar 1" with
  Segno, Coda at the start and the eight jumps at the end, in that order;
  toggles add and take away at once; Esc closes and gives keys back to
  the tab; each toggle is an undo step.
- The Direction button is lit while the cursor's bar has one.
- Shift+R, then "D.S. al Coda" and Enter, adds it to the cursor's bar
  as one undo step, closes, and gives the keys back to the tab.
- Typing "ds" lists D.S., D.S. al Coda, D.S. al Fine, D.S. al Double
  Coda first, each "Bar end"; "to coda" lists To Coda first; "sign" lists
  Segno, "Bar start"; a press in the list adds it.
- Shift+R on a bar that has a Segno, "segno" and Enter, leaves the clip
  as it was; "bridge" lists nothing, Enter shows the ⚠, two Escs close it.
- Shift+R opens on an empty bar too; Shift+R is in the `?` list.
- `directionsFor`: names and Dorico's words, dots and case not counting,
  the exact one first; nothing typed lists all 19, the panel's first.
- The bar menu lists Directions… after Delete bar and opens the pressed
  bar's panel.
- A right-clicked Direction is lit alone, and its menu is Edit, Delete;
  Edit opens its bar's panel with it pressed.
- Delete (menu or key) takes it away and leaves nothing picked.
- A double-click on one opens its bar's panel.
- MusicXML: a Segno is a `<segno/>` with `<sound segno>`, a D.S. al Coda
  words with `<sound dalsegno>`.
