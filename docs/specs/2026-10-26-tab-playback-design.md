# Tab: playback

Jeremy asked whether alphaTab's audio engine could play clips (2026-10-26),
then asked for "a small transport bar and the ability to loop or adjust
tempo". Three mocks were offered: a bar over the tab, a footer in the card,
and Play in the header. He picked the footer in the card.

## What the page shows

A very small round button with a green play triangle, at the bottom left
of the clip's card under the tab, shows or hides the playback controls
beside it (Jeremy, 2026-10-26). While they show, the button holds a plain
minus in the muted ink colour instead. It sits at the left end of the
divider under the tab: the line shows only with the controls, below it, and
stops just short of the button. The button stays in the same place either way. The controls are hidden
at first, and the page remembers the last choice (`frets.tab.playback`).
While they are hidden, Space does nothing and no playhead is drawn; hiding
them while the clip plays stops it.

The controls sit under that line:

- **Play / Pause.** A round button; Space does the same while the controls show and the tab has
  the focus. Play starts at the selection's first column, else at the
  cursor's. Pause stops and puts the cursor on the column it stopped on,
  with the playhead gone, so the next Play goes on from there (Jeremy,
  2026-10-26: a paused playhead had stayed on the tab with no way to clear
  it). The first Play
  loads alphaTab and the soundfont, about 1 MB, and shows a spinner until
  they are ready.
- **The progress line.** It is the clip as written, split at each bar,
  every bar as long as its time. A repeat goes back along it, as the
  playhead does on the tab. Pressing it while the clip plays jumps there;
  otherwise the cursor goes there. While nothing plays, the line fills up to
  where Play will start (the cursor, the selection's start, or a loop's
  start), as it fills to the playhead while playing (Jeremy, 2026-10-26).
- **Loop.** It is a toggle button. Turned on with notes selected, it
  repeats those notes, and a bracket under their stems marks them.
  Otherwise it repeats the whole clip.
- **Speed.** A slider from 25% to 150% of the clip's own tempo, beside
  "100% · 92 bpm". That figure is the tempo where the playhead is, times
  the speed.

While the clip plays, a playhead (a line and a soft band) marks the column
sounding. It is drawn under the notes, so it tints the paper and not the
numbers. Any edit stops playback, so the next Play plays what is drawn.

## How it works

`playback.ts`:

- `perform` writes the clip as alphaTex and reads it back into alphaTab's
  score, the same parse as reading alphaTex. alphaTab's MIDI generator then
  turns the score into MIDI with a tick lookup, so bends, slides, ties,
  repeats, endings, tempo changes and the capo sound as alphaTab plays them.
- `columnAtTick` and `ticksOf` map between ticks and the clip's columns.
  The score's bars and beats are the clip's bars and columns, grace notes
  included.
- `TabPlayer` runs alphaTab's `AlphaSynth` on the page's own thread, with a
  small Web Audio output (`WebAudioOutput`, a ScriptProcessorNode).
  alphaTab's own player needs its renderer, and its worker and worklet
  scripts would need serving beside the page.
- The soundfont is SONiVOX EAS (`public/soundfont/sonivox.sf3`, Apache
  2.0). It comes unchanged from alphaTab's package and is credited in
  `NOTICE.md` and the README.
- The instrument is alphaTex's default, steel-string acoustic guitar
  (General MIDI 25).

`PlaybackFooter.tsx` holds the footer, `usePlayback` and `Playhead`.

## Not done

- No count-in and no metronome. alphaTab has both, so they can be added
  later.
- No choice of instrument.
- No mute or solo: a clip has one track.
- The playhead does not follow the clip off screen.

## Checked

In Chromium, with the sound's peak measured at the audio node:

- Play and Space start playback from the cursor or the selection, and
  pause and resume.
- An edit stops playback.
- Loop repeats the selected notes and the whole clip.
- Speed 50% halves the tempo shown and the pace.
- Pressing the progress line jumps when playing, and moves the cursor when
  not.
- At the end of the clip, Play shows again and the playhead goes away.
- Checked in light and dark, at 1200 px and on a 390 px phone.
