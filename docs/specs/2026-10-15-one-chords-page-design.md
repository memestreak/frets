# Chords: one page for the library and the lab

Date: 2026-10-15
Status: approved in the project thread "Combine Chord library and Chord
lab" (option A of three mockups). Replaces the Chord library
(`docs/specs/2026-10-05-chord-library-design.md`) and the Chord lab
(`docs/specs/2026-10-05-chord-lab-design.md`) as pages; their rules for
shapes, naming, the Arpeggio and export still hold except where this spec
says otherwise.

## Problem

The library answers "how do I play this chord?" and the lab "what is this
shape?". A guitarist who looks up a chord and moves one finger has to
start again on the other page, tapping the whole shape in, to learn what
the new chord is called and to export its diagram.

## Goal

One page, `/chords`, where the neck is both what you look up and what you
play: pick a chord by name and its first shape goes on the neck; tap the
neck and the name follows the notes. The pickers and **Name it** are two
ways to set the same chord. `/chords/library` and `/chords/lab` go away
(the app has no users yet, so no redirects).

## Page

1. **Title line.** `h1` is the chosen name and its formula, the spelled
   notes below (the lab's title: "No name" when nothing fits, "Tap the
   neck" when every string is muted). On the right, the library's **Root**
   and **Type** pickers and the lab's **Clear**. The pickers show the
   chosen name's root and type; with no name, Root shows the lowest note
   and Type a disabled "—". Picking a root keeps the type (major when
   there was none).
2. **The neck**, frets 0–15, always tappable, as in the lab: a tap plays a
   fret on its string, the same fret again mutes the string. Muted
   strings are marked × beside the nut, as in the library (no fading).
   Under it, the library's ‹ › stepper and the **Arpeggio** toggle. The
   stepper's caption is the library's ("Open 1 of 3 · root on A · frets
   1–2"); when the frets are not one of the listed shapes it reads "Your
   shape · root on A · frets 1–2", and → goes to the first shape. With no
   chord the caption is the tapping hint. Since 2026-10-17 ‹ › slide the
   shape along the neck instead (`2026-10-17-move-shape-design.md`).
3. Two columns (one on phones), as in the lab: the shapes (colour key,
   **Open**, **Moveable**, Show all) on the left, **Name it** on the
   right.

## Choosing a chord

- **Pickers**: the chord picked is kept (the lab's `kept`), its first
  shape (open, else moveable) goes on the neck, Show all resets.
- **A shape** (tap, ← →): goes on the neck and keeps the chord, as
  in the lab.
- **A tap on the neck**: names the notes afresh, best name first, Show
  all resets.
- **A name in Name it**: relabels everything against its root.
- The Arpeggio: a shape or Clear turns it off; a tap, a name or a chord
  picked in the menus keeps it on, so it stays on from one chord to the
  next. Space toggles it.

## URL

`/chords?chord=am7&shape=x-0-2-0-1-x`: `chord` is the chosen name's chord
(left out when the notes have no name), `shape` the frets on the neck
(left out when every string is muted). Both are written as the page
changes, so any shape, tapped or looked up, can be linked. On load:

- `chord` and `shape`: those frets, keeping that chord (its name first).
- `chord` only: the chord's first shape.
- `shape` only: those frets, named afresh.
- Neither, or an unknown chord without a shape: Am7's first shape.
- A shape outside the best few opens with Show all on.

Picking a chord in the pickers adds a history entry, so Back returns to
the chord before; everything else replaces the current entry. Back and
Forward reload the page's state from the URL. The Scale lab's chord links
go to `/chords?chord=…&shape=…`.

## Navigation

The Chords section has no pages of its own: `/chords` is the page. The
section keeps its label and summary. On the home page its summary is its
one card; in the menu it sits under the section's name, and the
breadcrumbs read "› Chords".

## Export

Unchanged: right-click, a long press or Shift+F10 on a shape diagram
exports it under the chord's symbol; on the neck, the frets played under
the chosen name.

## Code

- `src/features/chords/ChordsPage.tsx`: the page, the only stateful
  component (frets, kept chord, chosen name, Show all, Arpeggio). It
  merges `ChordLibrary.tsx` and `ChordLab.tsx`, which go, with
  `library/` and `lab/`. `ChordPickers`, `VoicingStepper` and `NameList`
  move up to `src/features/chords/`.
- `src/lib/chords/chordUrls.ts`: `chordHref` takes a null choice, points
  at `/chords`; `shapeFromKey` reads a `shape` value back.
- Route `src/app/chords/page.tsx` renders the page client-only (it reads
  the URL).

## Tests

The library's and lab's page tests merge into `ChordsPage.test.tsx`, plus:
picking a chord then tapping one fret renames it and updates the pickers;
the URL follows taps and picks; a `shape`-only URL is named afresh; Back
after a pick returns to the earlier chord; the neck exports a tapped
shape under the new name.
