# Tab playback options

Jeremy, 2026-10-27: "I'd like a right click menu on the playback button that
allows me to toggle on and off playback options. Option: Stop leaves cursor at
stop point. Option: Pause for 1 second (customizable duration) between loop end
and loop restart."

## The menu

A right-click (or long press, through the browser's contextmenu) on Play / Stop
opens a small menu where it was pressed, styled like the shapes' menu. Esc, a
press outside, scrolling or resizing closes it. Play's tip says
"Right-click for options".

- **Stop leaves the cursor where it stopped** (a checkbox, off by default).
  On, pressing Stop (button or Space) puts the playback line on the column the
  playhead was on, so the next Play starts there. The editing cursor and
  selection stay as they were. Off, Stop returns the playhead to the cursor as
  before.
- **Pause between loops** (a checkbox, off by default) with a seconds field
  beside it (0.5–10 s, steps of 0.5, default 1; the same number field as
  Speed: type, ↑ ↓, the arrows, or press and drag). On, when the loop reaches
  its end the playhead waits at the loop's start for that long, counted from the
  loop's end, then plays again. The button stays Stop during the rest; Stop or
  a seek ends it.

Both are saved with the other playback settings in `frets.tab.playback`.

## How

`TabPlayer.setLoopPause(seconds)`. With a pause, the synth's own looping is
off but the loop range stays set, so the synth finishes at the range end; on
`finished` the player rests and then moves to the range start and plays.
`SpeedField` became the generic `NumberField`, shared by Speed and the pause.
