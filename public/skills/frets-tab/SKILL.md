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

- One voice, six strings in standard tuning unless `\tuning` says
  otherwise. Parts for several guitars go in tracks, each after its own
  `\track "<name>"` with the same number of bars; Frets keeps them all
  but shows and plays only the first for now. Notes are `fret.string.duration`; string 1 is the high e.
  Bars end with `|`.
- Write `\ts` always, and check every bar adds up to its time signature.
- Give the user a link that opens the tab, plus the text unless they ask
  for only one:

      https://frets.eminor.net/tab#tab=<the whole text, percent-encoded>

  Percent-encode as JavaScript's `encodeURIComponent` does. Keep the link
  under about 8,000 characters; for longer tab give the text and tell the
  user to paste it into Import on the Tab page.
