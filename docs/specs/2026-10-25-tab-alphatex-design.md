# Tab: alphaTex as the clip's format

Asked for by Jeremy on 2026-10-25 in the tab thread, before editing (PR 2
of `2026-10-24-tab-editor-design.md`). That spec still holds for the page,
the drawing and editing; this one changes what the clip is written in.

## Choices Jeremy made

- **Import is not limited to ASCII tab.** ASCII tab can't carry everything
  tablature can, and its columns are what agents got wrong. What matters is
  that the syntax for import is specified concretely and can be reproduced
  by an agent.
- **That syntax is alphaTex**, the text notation of alphaTab
  (https://alphatab.net/docs/alphatex/introduction), not one of our own.
- **alphaTex is Frets' own format:** what agents write, what links carry,
  what the alphaTex view shows and Download saves. Whatever Frets doesn't
  draw yet is kept as written and written back, so nothing is lost.
- **alphaTab's parser reads it** (`@coderline/alphatab`, pinned to 1.8.4,
  loaded only when tab is read), so Frets reads alphaTex exactly as alphaTab
  defines it.
- **Frets draws it itself.** A mock (2026-10-25) drew the same clips with
  alphaTab and with Frets; Jeremy found Frets' drawing "looks a lot
  better". alphaTab's renderer is not used.
- **ASCII tab stays** as an import (tabs pasted from the web) and an export.
- **Order:** this PR first, then editing.

## Reading

`src/features/tab/alphatexRead.ts`. alphaTab's importer parses the text
and builds its score; Frets maps that score onto the clip (durations,
dots, triplets, rests, chords, frets, dead notes, ties, hammer-ons and
pull-offs, slides, bends, vibrato, natural harmonics, palm mute, strokes,
taps, repeats, endings, title, tuning, time signature). alphaTab's parse
tree supplies, as written, every effect and tag Frets doesn't read: kept on
the note (`extra`), the column (`extra`), the bar (`extra`) or the clip
(`header`), and listed in the line under the clip ("Kept but not drawn
yet: g (ghost note), …").

- **Errors** are alphaTab's, with line and column. Also refused: more than
  one track, staff or voice; a tuning of other than six strings.
- **Read with a warning:** a time signature Frets doesn't offer (4/4),
  tuplets other than 3, 5, 6 and 7 (plain, kept as written; see
  `2026-10-26-tab-rhythm-design.md`), notes shorter than a sixty-fourth
  (sixty-fourths), a hammer-on or slide with no later note (left out), bars
  that don't add up.
- **Nothing Frets reads is lost.** The clip keeps the kind of slide
  (`sl` legato or `ss` shift from the note before, `sib` / `sia` from below
  or above even after other notes), up to two dots, and palm mute on each
  note. These were first squeezed into the model built for ASCII tab and
  were widened before merging. ASCII tab can't hold them all: written as
  ASCII, a shift slide becomes a plain slide, a slide in from below or
  above after another note on its string reads back as a slide from that
  note, and a palm mute covers whole columns. Shift and legato slides are
  drawn alike for now.

## Writing

`src/features/tab/alphatex.ts`, `writeAlphaTex`: `\title`, kept header
tags, `\ts`, `\tuning` when not standard; then one bar per line, ending in
"|": bar tags (`\ro`, `\ae n`, `\rc n`, kept tags), then beats, each with
its own duration. `h` and `sl` go on the note before the one that carries
them in the clip. Reading what was written gives the same clip; a test
checks this for every golden ASCII fixture.

## The page

- **Tab | ASCII | alphaTex.** Download saves the alphaTex
  (`<name>.alphatex.txt`) from Tab and alphaTex, the ASCII from ASCII. The
  copy button sits on both text views.
- **One way in for both formats:** Import, paste, drop and the link
  `/tab#tab=<percent-encoded text>` (it was `#ascii=`). Text with a run of
  dashes, or a line that starts like a string line ("e|-"), is ASCII tab;
  anything else is alphaTex (`readTab.ts`).
- **Storage** is unchanged: the clip, with its kept extras, in
  `frets.tab.clip`.

## For agents

`public/tab-alphatex.txt`, served at
`https://frets.eminor.net/tab-alphatex.txt`: the part of alphaTex Frets
draws, the form Frets writes, what is kept, six worked examples (a test
reads each and checks it writes back byte for byte), the link, and a
checklist for reading a picture. `tab-ascii.txt` points agents to it.

## Verification

Tests in CI (every fixture round trip, the doc's examples, kept symbols,
errors, format detection), then the same agent round trip as for ASCII:
fresh agents given only `tab-alphatex.txt` and a picture of each of six
clips; each answer must import with no warnings and match its source.
