# Tab playback: metronome and count-in

Issue #148. Builds on `2026-10-26-tab-playback-design.md` and
`2026-10-27-tab-playback-options-design.md`.

## What it does

- **Metronome** is a toggle in the playback footer, after Hear notes (a
  metronome icon). Lit while on. While the clip plays it clicks every beat;
  beat one has a higher, slightly louder click.
- A **right-click on Metronome** opens the Metronome dialog
  (`2026-11-14-tab-metronome-parity-design.md`; it was a small menu, which
  Jeremy picked over a second button, 2026-10-28). Among its fields:
  - **Count in**, with a number field for how many bars, 1 to 4 (1 at
    first; Jeremy, 2026-10-28): Play first clicks that many bars, then plays.
    It works with the metronome off too.
  - **Click volume**, a number field, 0–100 % (step 5), 80 % at first. The
    Volume knob still turns everything down, clicks included.
  - **Sound**, **Subdivide**, **Click on**, and the volumes of beat one,
    the beats and the subdivisions (issue #477).
- All are remembered in `frets.tab.metronome` (`on`, `countIn`,
  `countInBars`, `clickVolume`, and #477's fields).
- The Volume knob moved to the footer row's far right (Jeremy, 2026-10-28).

## Counting

- A click per beat of the bar's time signature: the bottom number's note.
- Bars over 8 or shorter click every eighth (or sixteenth), the start of
  each Beat group struck harder: in 6/8 the 1 (its own higher click) and the
  4 stand out (Jeremy, 2026-10-28; two dotted-quarter clicks were too few),
  and 7/8 as 2+2+3 the 1, 3 and 5 (#477; before it, odd meters had no
  groups).
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
- The sounds are synthesized (`src/lib/clickSounds.ts`, the Metronome
  page's; the wood block is `clickWave`, a short, inharmonic, quickly decaying
  tone with a soft attack and a faded end so it never pops) and wrapped in a
  SoundFont 2 built in the browser, bank 120, two keys a sound (#477).
- The MIDI starts with four bars of silence, room for the longest count-in
  before the first bar. A count-in takes the place of the bars before Play's
  start
  (`withCountIn`): its notes are left out, its other events (tempo, program)
  take effect from the count-in's start, and every later tick is unchanged.
  When a loop first comes round, the clip's own MIDI is swapped in without
  stopping, so later passes play those bars as written. A press on the tab while
  playing does the same.
- alphaTab's own metronome and count-in are not used: they have no accent, and its count-in leaves a gap before the first note
  with this output.
