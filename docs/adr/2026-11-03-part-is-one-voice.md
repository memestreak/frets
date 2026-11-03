# A Part is one Voice of one Track

The Clip stores each Track's bars as Voices, but the editor's Part holds one
Voice: `partOf(clip, track, voice)` gives that Voice's Columns as
`bar.columns`, and `withPart` puts them back, the same way a Part is one
Track (Jeremy, 2026-11-03, step 2 of the Tab editing principles). We didn't
put every Voice into the Part's bars because layout, hit testing, drawing
and every edit (228 uses of `.columns` in 35 files) work on one line of
Columns, and step 8 can give a Part the other Voices read-only, as
`alongside` gives it the other Tracks.

Revisit when: step 8 finds drawing two Voices needs more than the other
Voices read-only beside the edited one.

## Considered options

- Every bar holds `voices: Column[][]` and every user of `.columns` picks
  one: hundreds of edits that would each hard-code Voice 1 until step 8.
- `columns` stays Voice 1 and `voices` holds the rest: two ways to reach a
  bar's notes.

See `docs/specs/2026-11-03-tab-voices-design.md`.
