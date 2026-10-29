---
name: frets-chords
description: >-
  Link chords and chord shapes to the Frets Chords page
  (frets.eminor.net/chords). Use when asked for guitar chords, voicings or a
  progression to open in Frets.
---

# Frets chords

Frets (https://frets.eminor.net) is a guitar app. Its Chords page opens on
a chord, a shape, or both, from a link:

    https://frets.eminor.net/chords?chord=<chord>&shape=<shape>

## Before writing a link

Fetch https://frets.eminor.net/chord-links.txt and follow it. It is kept
in step with the app and lists every chord type Frets can open, spelled
the way the link needs it (C# major 7 is `dbmaj7`, Am7♭5 is `am7b5`). Where
it and this file disagree, it wins.

## In short

- `chord` is the root then the type, lower case: `am7`, `fsharpm7b5`, `c`
  (C major). Roots: c db d eb e f fsharp g ab a bb b.
- `shape` is six frets from the low E string to the high e, joined by `-`:
  0 to 15, or `x` for a string not played. `x-0-2-2-1-0` is open Am.
- One chord per link; give a progression as one link per chord, each with
  the chord's name.
- Check each shape's notes are the chord's notes before giving it.
