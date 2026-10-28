# Tab playback: metronome and count-in

Issue #148. Builds on `2026-10-26-tab-playback-design.md` and
`2026-10-27-tab-playback-options-design.md`.

## What it does

- **Metronome** is a toggle in the playback footer, after Hear notes (a
  metronome icon). Lit while on. While the clip plays it clicks every beat;
  beat one has a higher, slightly louder click.
- A **right-click on Metronome** opens a small menu (Jeremy picked this over
  a second button, 2026-10-28):
  - **Count in**, with a number field for how many bars, 1 to 4 (1 at
    first; Jeremy, 2026-10-28): Play first clicks that many bars, then plays.
    It works with the metronome off too.
  - **Click volume**, a number field, 0–100 % (step 5), 80 % at first. The
    Volume knob still turns everything down, clicks included.
- All are remembered in `frets.tab.playback` (`metronome`, `countIn`,
  `countInBars`, `clickVolume`).
- The Volume knob moved to the footer row's far right (Jeremy, 2026-10-28).

## Counting

- A click per beat of the bar's time signature: the bottom number's note.
- Compound time (6/8, 9/8, 12/8, and the same over 16) clicks the dotted
  beat: two clicks in 6/8. 3/8 and odd meters (5/8, 7/8) click every eighth.
- Clicks follow time signature changes, repeats (every pass clicks), tuplets
  (they don't move the beat), tempo changes and Speed.

## Count-in

- One to four bars, each counted like the bar Play starts in (beat one of
  each higher), at the tempo there (a tempo
  change in the bar before is already in effect).
- Only before Play, not before each loop pass.
- The playhead waits on the column Play starts from until the count-in ends.

## How

- The clicks are notes in the clip's MIDI (`perform` in `playback.ts`), on
  their own channels: 10 for the metronome, 11 for the count-in. So they keep
  time with the notes whatever the speed, loop or time signature, with no
  second clock. The metronome's channel is muted while it is off, so it can be
  switched on or off mid-play. Transpose leaves both channels alone.
- The sound is synthesized (`click.ts`: a short, inharmonic, quickly decaying
  tone, wood-block-like, with a soft attack and a faded end so it never pops)
  and wrapped in a two-key SoundFont 2 built in the browser, bank 120. The
  Metronome page (#149) can play the same samples from `clickWave`.
- The MIDI starts with four bars of silence, room for the longest count-in
  before the first bar. A count-in takes the place of the bars before Play's
  start
  (`withCountIn`): its notes are left out, its other events (tempo, program)
  take effect from the count-in's start, and every later tick is unchanged.
  When a loop first comes round, the clip's own MIDI is swapped in without
  stopping, so later passes play those bars as written. A press on the tab while
  playing does the same.
- alphaTab's own metronome and count-in are not used: they click every eighth
  in 6/8, have no accent, and its count-in leaves a gap before the first note
  with this output.
