# Tab: pick the track to show (issue #243)

Step 1b of issue #237 (multiple tracks). Step 1
(`2026-10-30-tab-tracks-design.md`) made a clip hold tracks while the page
showed, edited and played only the first, with an "i" over the clip saying
so. Before drawing every track (step 2), the page shows one track at a time,
picked from a list (Jeremy, 2026-10-30: "first support only displaying one
track at a time with some kind of chooser").

## The list

- A clip of more than one track has a **Track** list (`<select>`, Fretwood's
  `.input`, as narrow as its longest name) at the clip card's top left, where
  the "i" was: beside Staff | Tab | Both in Notation, alone in ASCII Tab, not
  in AlphaTex, which shows every track. A clip of one track has no list.
- Each option is the track's name (`\track "<name>"`), else "Track N"
  (`trackName` in `clip.ts`, also used by the uneven-bar warnings).
- The "i" and `hiddenTracksNote` are gone.

## What follows the pick

- The page works on `partOf(clip, track)` and puts edits back with
  `withPart(clip, part, track)` (`clipAction` takes the track). So the
  drawing, the score head's tuning and capo, every edit, Sound, playback,
  the ASCII view and download, the images and Export are of the picked
  track. The title, credits, tempo, FX, Copy link, the alphaTex download and
  the saved arrangement stay the whole clip.
- The pick is the viewer's: not saved in the clip or in a preference. It goes
  back to the first track whenever another arrangement or example opens
  (a new one, Duplicate, an import, a link). An AlphaTex edit that takes
  tracks away leaves the last one shown.
- Picking another track stops playback; the selection, the playback line,
  a picked word or mark and any open panel go; the cursor moves to the same
  bar of the new track, its first column (every track has the same bars).

## Deleting bars

With other tracks hidden, deleting bars in the shown one must not take
away music nobody can see. `withPart` keeps any bar an edit took away while
another track has more than rests there (a note, or a chord name or text
over a rest): the bar stays in every track, a bar of rests in the edited
one. A bar every other track has only rests in still goes from every track,
so empty bars can still be trimmed. The same holds for Delete in an empty
bar. One track behaves as before.

Jeremy, 2026-10-30, picked this over clearing to rests always and over
step 1's rule (remove from every track).

## Every track the same length

Picking another track must not change how long the arrangement is drawn
(Jeremy, 2026-10-30: "the arrangement changes length when I choose between
the two tracks"). A part of a clip of several tracks carries the others as
`alongside` (made by `partOf`, never written or compared as music). The
layout gives each bar the room the widest track's bar there asks for, and
the least room the most any needs, spreading the bar's own columns over it;
so every track breaks its lines at the same bars, each bar at the same
place. A multi-bar rest gathers only bars that are rests in every track.
The rows over the staff (a chord name, a section) are still each track's
own, so a line may be a little taller in one track; step 2 draws the tracks
together.

Tracks never start at different bars: every track has every bar (alphaTex
and the model share the bars), so a part that comes in later has rests
until it does, and bar numbers are the same in every track.

## Tests

`tracks.test.ts` (editing track 2, `clipAction` with a track, bars kept for
another track's music, every track laid out in step, multi-bar rests,
`trackName`) and TabPage's "several tracks" tests
(the list, editing and ASCII of track 2, no list in AlphaTex or for one
track, back to track 1 on Duplicate).
