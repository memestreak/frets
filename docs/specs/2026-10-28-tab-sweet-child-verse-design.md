# Tab: a printed score's verse and chorus (Sweet Child O' Mine, round 2)

Jeremy, 2026-10-28: the second round of drawing Guitar Pro's "Sweet Child O' Mine" near identically
(see `2026-10-28-tab-sweet-child-intro-design.md` for round 1 and the rules on copyrighted music). This
round is Verse 1 and Chorus 1, bars 25–48, page 2 of the book. His answers before it: draw the tempo
and the section the book's way, and E♭ playback is right by ear.

## What the book prints that Frets didn't

- **Tempo and section, the book's way.** The tempo is one bold line, its words first: "Medium Rock
  ♩ = 122". A section's rehearsal letter stands in an outlined box (no fill) and its name follows in
  bold with no box: "[B] Verse 1". A section with no letter is its name in bold alone.
- **Double bars.** alphaTex's `\db` at the start of a bar ends it with two thin lines, on the tab
  and on the staff, as the book closes a section. A repeat's end and the clip's final bar line are
  drawn as before. The Bars palette has a Double bar button (pressed when the cursor's bar has one).
- **Multi-bar rests.** With `\multiBarRest` in the header (a setting of the clip, written back), two
  or more plain bars of rest in a row are drawn as one wide bar: a thick bar across the middle of the
  staff with a short upright at each end, and their count over it, large and bold. Bar numbers show
  only on its first bar. Under the staff the tab under it is empty, as the book has it; with the tab
  alone the thick bar stands where the rests would be. A plain bar of rest is one rest and nothing
  else (no chord name, text or mark). The run's first bar may start a section, a tempo, a signature
  or a repeat, and its last may end with a double bar or a repeat; anything else in a bar ends the
  run. The bars keep their own slices of the room, so the cursor, the playhead and the loop still go
  through them one at a time, and a note entered in one breaks the run up. A multi-bar rest goes on
  one line whole.
- **Tied notes on the tab, under a staff.** In Both, a tied note's number is drawn only at the start
  of a bar, in brackets ("(15)"); within a bar the staff's tie says it and the tab shows nothing. A
  tied note that bends keeps its number under its bend's arrow. The tab alone still shows every tied
  note, with its arc.
- **Vibrato to the bar line.** A vibrato (or any run of marks drawn across notes) over a bar's last
  note stops at the bar line, not at the next bar's first note. A wide vibrato is drawn tighter and
  heavier, as the book's is.
- **The last line, full.** The last line runs to the full width when it holds as many bars as the
  line before it; otherwise it is spread as much as that line, as before.
- **Chord names with ♯ and ♭.** A chord name's root and bass are drawn with the signs ("Ab5" is
  drawn A♭5, "C/Bb" C/B♭); the text stays as typed.

## Not the same as the book, on purpose or for later

- **Line breaks.** The book sets four bars to a line (the multi-bar rest taking two); Frets spaces by
  note length, so whole and half notes take less room and the lines break elsewhere. Custom spacing is
  issue #153.
- **Spelling.** The staff is spelled in the key (C♯ in G), where Guitar Pro wrote D♭ in places; chord
  names are as printed.
- **Bar 48's last note** slurs into bar 49, which is round 3.
