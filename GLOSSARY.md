# Frets

A guitar fretboard app: tools for exploring scales, chords and tab, and
trainers for learning the neck. These are the app's own words; name
things in code, tests, specs and PRs by them.

## App

**Feature**:
One folder under `src/features/`, holding everything only one part of
the app uses.
_Avoid_: section (for the folder)

**Group**:
One of the headings the pages are listed under: Tools, Practice and
More. A group is not a path; the Scale lab is a Tools page at
`/explore/scales`.
_Avoid_: section (for the group)

**Mock**:
One of several looks a page offers for Jeremy to pick from, switched by
`?mock=` in the link. Mocks never merge: one is picked, the rest are
removed.

**Page**:
One route of the app, listed once in a Group in `sections.ts`.

**Trainer**:
A Practice page: a quiz that asks questions on the neck, judges the
answers and keeps stats. The Interval trainer and the Note trainer.
_Avoid_: quiz page, game

## Chords and the neck

**Grip**:
The three tones of a triad on three neighbouring strings, one tone per
string, in any inversion, wherever it fits on the neck. A Grip is not a
Shape.

**Position**:
A five-fret span of the neck that a set of Shapes is confined to, as in
the Scale lab's position shapes. One string and fret is a Spot.

**Shape**:
One way to finger a chord on the neck: a fret or a mute for each
string. Published shapes come first; the rest are found by searching
the neck.
_Avoid_: voicing, fingering

**Spot**:
One string and one fret on the neck.
_Avoid_: position

## Practice

**Box**:
The Interval trainer's reach around the root (`vRange` strings,
`hRange` frets) that decides which questions are asked. Never drawn; a
right answer outside it is explained, not scored.

**Find it**:
A Trainer mode: a note or interval is named, and the viewer finds it on
the neck.

**Fret range**:
The frets a Trainer's questions may use, set in its settings.
_Avoid_: fret window

**Name it**:
A Trainer mode: a note or interval is shown on the neck, and the viewer
names it.

## Tab

**Arrangement**:
The Tab page's Work: a named Clip saved under My arrangements.

**Clip**:
The music in an Arrangement: one or more Tracks over the bars they
share.

**Track**:
One instrument's line in a Clip, with its own tuning, instrument and
playback effects.

## Saved state

**Preference**:
A per-viewer choice listed in the Settings dialog, saved one key per
Section and never saved with the Work.
_Avoid_: setting (for a saved preference)

**Section**:
One part of the Settings dialog, saved as one key,
`frets.<page>.<section>`.

**Work**:
What a page lets the viewer make and save by name, each under
`frets.<page>.works.<id>`. On the Tab page, an Arrangement.
