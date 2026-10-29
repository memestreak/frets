# Tab: bend starts, capital X and ghost chords, as the book prints them

Issues #176, #177 and #178, noted during the Sweet Child O' Mine round-trip
(`2026-10-28-tab-sweet-child-solo-three-design.md`, "Not the same as the book"). Each draws a mark
the way Guitar Pro's printed book does. The alphaTex is unchanged.

## A bend's starting pitch on the staff (#176)

- A picked note bent up (`b (0 4)`, not a pre-bend, not a tied note, not a grace note) is drawn on
  the staff at the pitch the bend reaches, as the book prints it. Before, it was drawn at its fret's
  pitch.
- The pitch it starts from comes before it as a bracketed head, joined to it by a short line. The
  starting head has its own accidental when it needs one, and the bar's accidentals count it.
- A bend let down in the same note (`b (0 4 0)`, or `b (0 4 2)` part of the way) also gets a
  bracketed head after the note at the pitch it comes back to, joined by a line, under a tab. With the
  staff alone the bend's own arrow already shows it coming down, so no second head is drawn there.
- A grace note bent into a note already shows the starting pitch (the grace note itself), so its bend
  gets no extra head. A bend of a quarter tone rises less than a semitone and gets none either.
- The column takes the room the starting head and line need, left of the note's accidentals.
- Staff and Both views, the copies and the exports all show it.

## Dead notes as a capital X (#177)

- On the tab, a dead note is a capital X at the fret numbers' size, "(X)" as a ghost note, in every
  view and export. The staff's × heads stay as they are.
- The ASCII tab view and its files keep the lowercase x, as ASCII tab writes it (both are read).

## One pair of brackets round a ghost chord (#178)

- On the staff, a column of two or more notes that are all ghost notes, with its outer heads a fifth
  apart or closer, gets one tall pair of brackets round all its heads. The right bracket stands clear
  of a stem going up.
- A column spread wider, or with only some ghost notes, brackets each ghost head on its own.
- The tab keeps each number in its own brackets, as the book does.

## Tests

`src/__tests__/tab/bookMarks.test.tsx`; the built-in arrangement `sweet_child/bend-starts.atex`
(the book's bars 110 and 116).
