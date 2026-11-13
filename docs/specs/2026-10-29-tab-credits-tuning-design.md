# Tab: setting the title, artist, credits and tuning from the score's head

Issues #202, #203 and #227. The score's head (`docs/specs/2026-10-28-tab-score-head-design.md`) draws the
artist, who wrote the words and music, and the tuning, but the only way to set them was to type
alphaTex. They are now set where they are drawn.

## Ways in

- A press on the title, the artist or a credits line opens the one **Title and credits** panel at
  the press, with the pressed one's field focused (the artist's for a credits line). There is no
  other way to edit the title on the page: the inline title field is gone (issue #227, Jeremy,
  2026-10-29: one way to do a thing).
- A press on the tuning block opens the **Tuning** panel at the press. (Since issue #296 a press picks it and Edit, Enter or a double-click opens the panel: `2026-11-01-tab-tuning-collapse-design.md`.)
- Nothing in the head shows up only on hover (Jeremy, 2026-10-29). The tuning is always shown: in
  standard tuning it reads "Standard tuning", on the left where a tuning prints, and a press on it
  opens the Tuning panel like any other tuning. The exported picture still leaves standard tuning
  unsaid, as printed scores do.
- With no artist or credits, nothing is drawn in their place (Jeremy, 2026-11-03, replacing the
  quiet "Add artist and credits" line): the title's Edit opens the Title and credits panel.
- Tuning (like Sound's `\instrument`) belongs to a track in alphaTex. Frets has one track, so the
  clip's tuning is that track's; nothing here should assume one tuning for a whole score, so that
  several tracks stay possible later.
- Both are in the Notation view only, in Staff, Tab and Both alike, since that is where the head is
  drawn. The text views already carry the same lines in their text.

## Title and credits

- Title, then Artist, Words and Music, each labelled "(optional)". An empty title is drawn as
  "Untitled clip", the field's placeholder; the title is trimmed and kept as the clip's `\title`, so
  the Arrangements list and the Export dialog's Name follow it. **Same people wrote both** (on when Words and
  Music match, and for a clip with neither) folds Music into one "Words & Music" field, as the head
  prints one "Words & Music by" line.
- The head follows what is typed. Enter or a press away keeps the title and credits together as one
  undo step; Esc puts them all back. On an example, the title is the example's own, like everything
  else edited there ("edits aren't saved").
- Written back as `\artist`, `\words` and `\music` (`setCredit` in `credits.ts`): a changed value
  rewrites its line, a cleared one takes its tag away, a new one goes after the credits before it
  (artist, words, music). Every other header line, and a credit whose value didn't change, stays as
  written.
- `\album` is left out: the head doesn't draw it, and a printed guitar score doesn't print it.

## Tuning

- **Tuning**, a caption and a dropdown on one line, as Capo's below it: the common tunings, Standard,
  E♭, D, Drop D, Drop C♯, Drop C, DADGAD, Open G, Open D, Open E (`TUNING_PRESETS` in `tuning.ts`),
  the clip's chosen. A tuning that is none of them reads **Custom**, an option there only while it
  is. Picking one sets it. (First a row of buttons with the name in a caption, "Tuning: DADGAD";
  a dropdown since 2026-11-13, Jeremy: "This will save room".) The dropdown has the focus when the
  panel opens.
- Then the six strings, lowest first (⑥ to ①), each named as the head names it (a flat when tuned
  down, a sharp when tuned up). None is picked when the panel opens; a press picks one and the
  shared piano `KeyPicker` appears under the strings to set its note, the panel growing downward
  (Jeremy, 2026-11-13: "only show the key selector if a string is selected"). A second press on it,
  Esc, or a press elsewhere in the panel lets it go and the piano with it
  (`2026-11-01-deselect-design.md`); Esc with no string picked closes the panel.
- Every change is one undo step and keeps every fret, as Guitar Pro does by default, so the music
  sounds as fingered in the new tuning. Playback, the staff, ASCII Tab and exports follow.
- Standard takes the `\tuning` tag away. Strings keep the octave nearest standard, as before; a guitar
  with all six strings tuned alike is still written on the staff as fingered.
- Then **Capo**, a dropdown (None, 1st to 12th fret) with a small neck showing where the capo is, and the head draws the capo beside the tuning's
  name: "DADGAD tuning · Capo 4th fret" (issue #463, `2026-11-13-tab-capo-in-tuning-design.md`;
  until then the capo was a Text tool).

## Tests

- The Tuning dropdown lists every preset in order; picking one sets it, one undo step; Custom is
  listed, and chosen, only while the tuning is one of its own.
- No piano with no string picked; picking a string shows it, named for that string; a second
  press on the string, a press elsewhere in the panel, or Esc hides it, and that Esc leaves the
  panel open, a second closing it.
