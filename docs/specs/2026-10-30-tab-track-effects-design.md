# Tab: effects belong to a track, and the metronome stays dry

Jeremy, 2026-10-30: "Effects should be associated with a track. The
metronome should not have effects applied to it." Builds on the track model
(issue #237 step 1, PR #239) and on the FX saved with the clip
(`2026-10-29-tab-sound-and-fx-in-clip-design.md`).

## The model

- `Track.fx` holds a track's FX; `Clip.fx` is gone. A track with none plays
  clean, as a clip with no FX line did.
- `Part.fx` is the shown track's (`partOf` / `withPart` carry it with the
  track's capo and sound), so the FX button, the FX dialog and playback all
  use the track the page shows: track 1 today, the chosen one once the track
  chooser (issue #243) lands. `TabPage` names that track once
  (`shownTrack`).
- The `fx` action names its track. A run of changes to one track's FX is one
  undo step; a change to another track's FX, or any other edit, starts a new
  one. FX changes still don't stop playback (`sameMusic` ignores every
  track's FX).
- A saved arrangement checks each track's FX field by field (`parseClip`).

## alphaTex

The line is unchanged (`fxLine.ts`); where it sits says whose it is.

- Written under the track's `\track` line. A first track with no `\track`
  (a clip of one track, as most are) has it first in the text, as before,
  so every existing example and link reads and writes back the same.
- Read: a `// frets:fx` line belongs to the track whose `\track` comes last
  before it; a line before the second track's `\track` (or anywhere, with
  one track) is the first track's. A track's first line counts; the AlphaTex
  view's margin marks any other as not kept (`commentSpots`).

## The metronome stays dry

The metronome and count-in clicks are notes on their own MIDI channels
(10 and 11), played by alphaTab's synthesizer with the clip so they keep
time. The synthesizer mixes every channel into one stream, so they went
through the distortion and reverb.

- `dryChannels.ts` replaces the synthesizer's mixing step (alphaTab 1.8.4's
  `TinySoundFont._fillWorkingBuffer`, copied with one change): voices on the
  click channels render into a second buffer kept beside each block.
- The output (`audioOutput.ts`) queues both, plays them as a four-channel
  ScriptProcessorNode, and splits it: the main pair into the effects, the
  dry pair into the effects chain's `dryInput`, which goes straight to the
  volume. The Volume knob and the limiter still act on the clicks; Stop's
  fade and the end-of-clip fade fade both.
- `dryChannels.test.ts` renders a click on a plain channel and one on a dry
  channel through alphaTab's real synthesizer and checks each lands in its
  own samples, so an alphaTab upgrade that changes those internals fails a
  test rather than the sound.

## Later

- When several tracks play at once (issue #237 step 2 or later), the same
  mixing step can give each track's channels samples of their own, one
  effects chain each.
