# Tab: a track's empty bars as multi-bar rests

Follow-up to the track chooser (`2026-10-30-tab-track-chooser-design.md`,
issue #243, umbrella #237). Every track has every bar, so a part that comes
in halfway through the song has a bar of rests for each bar before it. After
the chooser gave every bar the widest track's room, such a part was drawn as
bar after full-width empty bar.

Jeremy, 2026-10-30, asked whether leading and trailing empty bars should be
dropped, maybe as a setting, and picked option 1 of three (over hiding
leading and trailing empty bars, and over a Settings › Tab choice): in the
shown track, every run of rest bars is drawn as one multi-bar rest with its
count, as printed parts have it.

## What is gathered

- In a clip of more than one track, `multiRests` gathers a track's runs of
  two or more rest bars, leading, middle and trailing alike, whether or not
  the clip says `\multiBarRest`. A clip of one track still gathers only when
  it does.
- Only the shown track's own bars count: another track playing there no
  longer stops a run (the chooser's rule, now gone). Inside a run each bar
  takes its share of the rest's room, not the other tracks' room, so the
  track is drawn shorter than the others by its rests.
- A rest bar is a bar of nothing but plain rests: one whole-bar rest, or
  several that fill it (`r.2 r.2`), with no chord name, text or other mark
  on any of them, and no ending. This holds for `\multiBarRest` clips too,
  as alphaTab reads it. A bar of several rests shares its slice among them.
- Runs still end where a section, tempo, time or key signature, repeat or
  free-time bar starts, and at a double bar or a repeat's end, as before.

## Bars and editing

- Every bar stays stored in every track; nothing is removed or renumbered.
  Bar numbers over a run show its first bar's real number, and the bar after
  it its own.
- Each bar of a run keeps its slice of the run's room, so the cursor and the
  playhead step through the bars one at a time (arrows, a click on the
  rest's slice). Typing a note in one replaces its rest, so the bar is no
  longer a rest bar and the run opens: the bar is drawn by itself, and the
  rests on either side are gathered again if two or more remain.

## Tests

`tracks.test.ts` ("a track's runs of rests"): gathered without
`\multiBarRest` whatever the other track plays, none for a lone rest bar or
a one-track clip that doesn't ask, the shorter drawing with every column
placed, a bar of several rests inside its slice, and a note opening a run.
`verseLook.test.tsx`: a bar of two half rests is a rest bar.
