# Tab: a clip of several tracks (step 1, the model)

Issue #237 (umbrella): read and show sheet music with more than one guitar
part (Gtr I, Gtr II, …), such as a band book where most songs have two or
three parts. A track is a separate part with its own staff, tuning and sound
(alphaTex `\track`); a voice is a second rhythm inside one part, and is a
later issue. This spec is step 1: the clip holds tracks, and every one is
read, kept, written, saved and linked. Drawing them (step 2), editing across
them (3), playing them (4) and other formats (5) come later.

Jeremy, 2026-10-30: split the bar (Q1, option 1); until there is UI for
tracks, a small "i" over the clip with hover text says the arrangement has
more tracks than Frets supports yet.

## The model (`clip.ts`)

- `Clip` is what is stored, linked and written: its name, first time
  signature, header lines, line breaks, multi-bar rests, its
  `masterBars` and its `tracks` (one at least).
- `MasterBar` is what every track's bar `b` shares, as alphaTab's master bar
  does: time and key signatures, repeats, endings, double bars, free time,
  tempo, section. One place each, so tracks can't disagree.
- `Track` is one part: its name, its `\track` line as written (`tag`, which
  keeps whatever it sets past the name), its own kept lines (`header`, such
  as `\staff {score tabs}`), tuning, capo, sound (`instrument`), FX
  (`fx`, `2026-10-30-tab-track-effects-design.md`) and its
  `bars`, as many as the clip's `masterBars`. A `TrackBar` is a bar's
  columns and its kept bar metadata (`extra`).
- `Part` is one track as the editor sees it, the shape the clip had before
  this change: the clip's own fields, that track's tuning, capo and sound,
  and `Bar`s that are a master bar and the track's bar together. Layout,
  drawing, every edit, playback, ASCII tab and the images all work on a
  part, unchanged.
  - `partOf(clip, t)` makes one. Its bars are made once for the same bars,
    so a new sound or FX keeps them and playback carries on (`sameMusic`).
  - `withPart(clip, part, t)` puts an edited part back: the part's bar marks
    become the clip's, its notes, tuning, capo and sound the track's. With
    more than one track each part bar carries `origin`, the clip bar it was
    made from, so the other tracks keep their bar where the part's came from,
    get a bar of rests where an edit added one, and lose the bar an edit took
    away. A part's edit that leaves the bars alone keeps them the very same.
  - `asClip(part)` is a clip of the part alone, one unnamed track: what is
    copied to the clipboard and played.

## alphaTex (`alphatexRead.ts`, `alphatex.ts`)

- Reading keeps every track instead of refusing. Each must still be one
  staff of six strings with one voice. A `\track` after the first bar starts
  the next track's bars in alphaTab's syntax tree.
- Bar marks are read from alphaTab's master bars, with the tags any track
  wrote; a key signature from the first track's staff.
- In the first track's first bar, kept lines before its `\track` are the
  clip's `header`, lines after it the track's. Credits are always the clip's.
- An uneven bar is named with its track: "Gtr II: Bar 3 doesn't add up…".
- Writing: the first track's FX line when it has no `\track`, `\title`, the
  clip's header, then each track: its `\track` (as written, or
  `\track "<name>"` when the clip has more than one and none was written)
  and its FX line under it, its own lines and `\instrument`, then for the
  first track `\multiBarRest`, the layout tags and `\ts`, then its tuning
  and capo and its bars. Bar marks are written in the first track's bars
  only; alphaTab gives them to every track. A clip of one track with no
  `\track` writes exactly as before, so every example still writes back
  unchanged.

## The page, until step 2

Issue #243 (`2026-10-30-tab-track-chooser-design.md`) replaced the "i"
with a Track list and changed deleting bars; below is step 1 as built.

- The page shows, edits and plays track 1; the rest are kept unchanged.
  `TabPage` keeps the whole clip in its history and dispatches a part's
  edits through `clipAction` (`replacePart`, `previewPart`), which uses
  `withPart`. The AlphaTex view, Copy link, the alphaTex download and the
  saved arrangement are the whole clip; the ASCII view and download, the
  images and playback are track 1. A paste of several tracks pastes the
  first.
- Adding or deleting a bar on track 1 does the same in every track (rests
  where one is added). Deleting a range that empties whole bars takes
  those bars from the other tracks too, music and all; step 3 decides
  whether deleting in one track should only clear its own bars.
- A clip of several tracks shows a small "i" at the top left of the card
  (beside Staff | Tab | Both in Notation; alone in ASCII Tab; not in AlphaTex,
  which shows every track). Its hover text: "This arrangement has N tracks.
  Frets shows, edits and plays only the first (Gtr I) for now; the others are
  kept as they are." (`hiddenTracksNote`).

## Storage

`frets.tab.works.<id>` holds the new shape; `parseClip` checks every track
and that each has as many bars as the clip. Clips saved before this change no
longer parse (no users yet, so no migration).

## Tests

`src/__tests__/tab/tracks.test.ts` (reading, writing, parts, `withPart`,
storage, the "i" text, the agent guide's snippet), TabPage's "several tracks"
tests, and the built-in `song_structure/two-guitars.atex`, which must read
with no warnings and write back exactly. The agent guide's examples gain a
two-track one.
