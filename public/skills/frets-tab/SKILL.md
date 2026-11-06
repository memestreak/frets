---
name: frets-tab
description: >-
  Write guitar tab as alphaTex for the Frets Tab page (frets.eminor.net/tab)
  and give a link that opens it. Use for riffs, solos and tab or sheet music
  read from a picture.
---

# Frets tab

Frets (https://frets.eminor.net) is a guitar app. Its Tab page draws tab
and standard notation, plays it back and exports it. It reads tab written
as alphaTex, the text notation of alphaTab.

## Before writing tab

Fetch https://frets.eminor.net/tab-alphatex.txt and follow it. It is kept
in step with the app: what Frets draws, how to write each mark, examples,
and a checklist for reading tab from a picture. Where it and this file
disagree, it wins.

## In short

- Six strings in standard tuning unless `\tuning` says otherwise. Up to
  four voices a track (`\voiceMode barWise`, then `\voice` before each
  voice in a bar); the page draws them all, voice 1 stems up and voice 2
  down, so a bass held under a melody goes in voice 2. Parts for several guitars go in tracks, each after its own
  `\track "<name>"` with the same number of bars; Frets keeps them all
  and shows one at a time, picked from a list (a link opens on the first);
  a part sits out a bar as `r.1 |`, and its rests in a row draw as one. Notes are `fret.string.duration`; string 1 is the high e.
  Bars end with `|`.
- Write `\ts` always, and check every bar adds up to its time signature. Only a pickup bar
  may be short: write `\ac` at the start of the first bar.
- Frets beams by the beat groups (7/8 as 2+2+3). Give another grouping with `\beaming (8 3 2 2)` after
  its `\ts`, and a single beam break or join with `{beam split}` or `{beam merge}` on the beat before.
- A chord name over a beat is `{ch "Am7"}`. When the tab shows a chord's
  shape (a diagram, or a named strum), also write the shape once before the
  bars, frets high e first and `x` for a string not played:
  `\chord ("Am7" 0 1 0 2 0 x)`. Each track has its own; its `ch` of that
  exact name then means that shape. The notes are still written out.
- Give the user a link that opens the tab, plus the text unless they ask
  for only one:

      https://frets.eminor.net/tab#tab=<the whole text, percent-encoded>

  Percent-encode as JavaScript's `encodeURIComponent` does. Keep the link
  under about 8,000 characters; for longer tab give the text and tell the
  user to paste it into Import on the Tab page.
- The page shows tab alone unless the user picked otherwise. To open it
  with the notation staff, put `?show=both` (staff over tab) or
  `?show=staff` (the staff alone) before the `#`, for that visit only:
  `https://frets.eminor.net/tab?show=both#tab=…`. Use it when the staff
  matters, as for music written from sheet music.
