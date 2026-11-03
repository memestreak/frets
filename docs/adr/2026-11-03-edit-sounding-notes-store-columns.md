# Tab edits Sounding notes; the Clip stores written Columns

The Clip keeps storing bars of Columns, as alphaTex writes them, and an
edit reads the bars it touches as Sounding notes, changes only starts and
lengths, and writes them back by the meter (Jeremy's A1, 2026-11-03). We
didn't store Sounding notes and derive Columns, as Dorico does, because
alphaTex, ASCII tab, MusicXML and Guitar Pro are all written-note formats,
about 160 places in 26 files read Columns, and an imported transcription
must come back spelled as the book prints it until a bar is edited.

Revisit when: keeping imported spellings stops mattering, or spellings
kept against the meter (overrides) start appearing everywhere.

## Consequences

- Every edit goes through the writer (`sounding.ts`); an edit that
  changes a bar's Columns directly skips the meter and is a bug.
- A bar nobody has edited keeps its spelling, even against the meter.
- A Tie chain is one note for picking, Delete and length, but each
  written note of it keeps its own marks, and one with marks of its own
  stays a written note of its own: guitar music bends, re-chords and adds
  vibrato on tied notes (Sweet Child).

See `docs/specs/2026-11-03-tab-sounding-notes-design.md`.
