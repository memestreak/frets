# Tab: the FX saved with the clip

Jeremy, 2026-10-29, choosing option 2 of "Find an alphaTex home for FX
settings": the playback FX (distortion and reverb,
`2026-10-28-tab-playback-effects-design.md`) belong to the arrangement, as a
structured comment line in its alphaTex, instead of being one setting per
viewer.

## Why a comment

alphaTex has no extension mechanism (checked against alphaTab 1.8.4):

- An unknown tag (`\fx …`) is error AT204 and stops the whole parse; an
  unknown beat or note property is AT205. Any alphaTab-based tool would
  refuse the file.
- `//` and `/* */` comments are part of the grammar. alphaTab keeps them in
  its syntax tree (`leadingComments` / `trailingComments` on the token they
  sit by), which Frets already reads; other tools skip them.
- `\notices "…"` would survive alphaTab and Guitar Pro, but other apps show
  it to people as text.

The catch: alphaTab's own exporter rebuilds the text from the score, so a
file re-saved by another alphaTab app loses the line, and its FX drop back
to off. Frets writes the line itself (`alphatex.ts`).

## The line

    // frets:fx on; distortion on drive=0.5 tone=0.5; reverb on amount=0.3 decay=1.5

- The first word is the FX button's light switch, then each effect's part:
  its name, its own switch, then `name=value` settings (`fxLine.ts`).
- Written first in the text, before `\title`, settings to two decimal places.
- Read wherever it is, from a `//` comment that starts `frets:fx`; the first
  if there are more. A `/* */` comment is not read. Parts in any order, any
  case; a part or setting missing or out of range takes its default (all
  off by the light switch; distortion on, drive 0.5, tone 0.5; reverb on,
  amount 0.3, decay 1.5 s), as `parseEffects` checks each field.
- No line, no FX: the clip plays clean and none is written until the FX are
  first changed. Other comments are dropped, as before.

## The clip

- `Clip.fx` holds them. A saved arrangement keeps them; `parseClip` checks
  each field.
- The FX button and dialog edit the open clip (an example's too, never
  saved, as any edit there). A run of FX changes one after another, as a
  knob turns, is one undo step; any other edit in between starts a new one.
- Changing the FX doesn't stop playback, though every other edit does: the
  footer stops only when the clip's music changed (`sameMusic`).
- `frets.tab.playback` no longer holds them, and Copy link has no FX
  fields: the FX travel in the link's text. The Sound is still the
  viewer's and the link's `&sound=` field.
