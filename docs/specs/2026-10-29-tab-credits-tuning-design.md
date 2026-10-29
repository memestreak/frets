# Tab: setting the artist, credits and tuning from the score's head

Issues #202 and #203. The score's head (`docs/specs/2026-10-28-tab-score-head-design.md`) draws the
artist, who wrote the words and music, and the tuning, but the only way to set them was to type
alphaTex. They are now set where they are drawn.

## Ways in

- A press on the artist or a credits line opens the **Artist and credits** panel at the press.
- A press on the tuning block opens the **Tuning** panel at the press.
- With no artist or credits, or in standard tuning, nothing is drawn, so there is no visible control
  (Jeremy's rule: no visible control for an unset value). A row at the head's foot, in place of its
  gap, takes the press instead: "Add artist and credits" in the middle, under the title, and
  "Standard tuning" on the left, where the tuning would be. Each is drawn only while the pointer is
  over it (or it has the keyboard's focus). The row adds 12px to a head with something unset.
- Both are in the Notation view only, in Staff, Tab and Both alike, since that is where the head is
  drawn. The text views already carry the same lines in their text.

## Artist and credits

- Artist, Words and Music, each labelled "(optional)". **Same people wrote both** (on when Words and
  Music match, and for a clip with neither) folds Music into one "Words & Music" field, as the head
  prints one "Words & Music by" line.
- The head follows what is typed. Enter or a press away keeps it as one undo step; Esc puts it back.
- Written back as `\artist`, `\words` and `\music` (`setCredit` in `credits.ts`): a changed value
  rewrites its line, a cleared one takes its tag away, a new one goes after the credits before it
  (artist, words, music). Every other header line, and a credit whose value didn't change, stays as
  written.
- `\album` is left out: the head doesn't draw it, and a printed guitar score doesn't print it.

## Tuning

- The common tunings as a switch: Standard, E♭, D, Drop D, Drop C♯, Drop C, DADGAD, Open G, Open D,
  Open E (`TUNING_PRESETS` in `tuning.ts`). The one the clip is in is lit; any other reads "Custom".
- Then the six strings, lowest first (⑥ to ①), each named as the head names it (a flat when tuned
  down, a sharp when tuned up); the picked string's note is set on the shared piano `KeyPicker`.
- Every change is one undo step and keeps every fret, as Guitar Pro does by default, so the music
  sounds as fingered in the new tuning. Playback, the staff, ASCII Tab and exports follow.
- Standard takes the `\tuning` tag away. Strings keep the octave nearest standard, as before; a guitar
  with all six strings tuned alike is still written on the staff as fingered.
- The capo stays a Text tool.
