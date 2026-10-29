# Tab: the tempo in the score's head, with tap tempo

Jeremy, 2026-10-29: "I want the same thing with tempo [as the tuning], with the button that looks like
this, where the number is the tempo. The tempo widget should support a tap tempo feature as well as
manual entry." His picture: a printed score's head, "Standard tuning", then a bold "♩ = 124" under it,
over the first staff.

## The head

- The first bar's tempo is printed in the score's head, under the tuning and lined up with it, in bold:
  its label if any ("Slowly"), the quarter note, then "= 92". It is no longer drawn over the first bar,
  so it is in one place only. Tempo changes in later bars are still drawn over their bars.
- It is always shown: a clip with no tempo reads "♩ = 120", the tempo it plays at (alphaTab's default),
  as an unset tuning reads "Standard tuning". A press on it opens the tempo panel at the press.
- The exported picture prints the first bar's tempo in its head when one is set, and leaves an unset
  one unsaid, as it does standard tuning.
- Notation view only, in Staff, Tab and Both, where the head is drawn.

## The tempo panel

One panel for every tempo (one way to do a thing): the head's press opens it for the first bar; the
Text group's Tempo tool, or Edit beside a picked tempo, opens it for the cursor's bar. It replaces the
earlier two-box field.

- **bpm**: the small number field the playback footer uses, 20 to 400: typed, stepped with its buttons
  or ↑ ↓, or pressed and dragged up and down; "bpm" after it; a double-click puts it back to 120. It
  opens selected, so a typed number replaces it. A bar with no tempo yet starts from the tempo in
  effect there.
- **Tap**: each press is a beat; from the second press on, the bpm is the average gap of the latest
  eight taps (`tapTempo.ts`), whole, kept within 20 to 400. A pause over 2 seconds starts a new run. A
  tap is timed from the press, not the release. T taps too, anywhere in the panel but the label.
- **Label (optional)**: the word before the note ("Slowly").
- The drawing follows every change. Enter or a press away keeps it as one undo step; Esc puts it back.
  Opening and closing it without a change is not an edit, so no `\tempo` is written for the default.
- A later bar's tempo is still taken away by picking it and pressing Delete. The first bar's has no
  Delete: 120 is what an unset tempo plays at anyway.

## alphaTex

Unchanged: `\tempo 92` or `\tempo (92 "Slowly")` on the bar, the first bar's included. Like the tuning,
a tempo belongs to the score in alphaTex, so nothing here limits a later move to several tracks.
