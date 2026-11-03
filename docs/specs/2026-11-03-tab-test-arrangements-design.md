# Tab: test arrangements

Issue #320 (Jeremy, 2026-11-03). A folder of built-in Arrangements, each
setting up one Tab editing behaviour for a person to see and try, with what
to do and what should happen written over the tab. It doubles as a tour of
how editing behaves.

## What it is

- The folder is `src/features/tab/builtin_arrangements/editing_tests/`,
  shown as Arrangements… → Built-in → Editing tests. Each file opens with
  `/tab#example=<file name>`, as every built-in does.
- One behaviour per file. `\title` says what happens, as a statement ("A
  longer note writes over what follows").
- The smallest Clip that shows it: 4/4, standard tuning, two or three bars
  of plain notes.
- Steps and expected results are Text over this column (`{txt "..."}`),
  one per bar where it can be, short enough not to run into the next.
  When the column to act on is narrow, the step goes on the bar's first
  column and names the place ("Select bar 2, press Delete: one whole
  rest").
- The folder's `README.md` lists each file, what it shows, and the spec or
  issue that pinned the behaviour. The Clip stays quiet: no references in
  its texts.

## For people, not instead of tests

Jeremy, 2026-11-03: "We cannot count on manual testing. The test
arrangements exist for humans validation/experimentation." So:

- Every behaviour a test arrangement shows also has an automated test.
- A spec's `## Tests` list never points to a test arrangement.
- Like every built-in folder but `samples/`, the files must read with no
  warnings, every bar full, and write back exactly. That keeps them
  readable, not their texts true.

## Keeping them true

- The `test-arrangement` skill (`.claude/skills/test-arrangement/`) says
  how to write one. Agents pick it up on their own whenever a change adds
  or alters Tab editing behaviour (Jeremy, 2026-11-03, over keeping it to
  `/test-arrangement` only), and it can also be run by name.
- A PR that changes a behaviour a test arrangement shows updates that file
  in the same PR, or removes it and its README row when the behaviour is
  gone, and says so in its description.

## The first four

Chosen to stay true under the editing principles of 2026-11-02 (A1–A14):
each is a rule Frets already follows that those choices keep.

| File | Shows |
| --- | --- |
| `delete-whole-bar` | Delete on a bar selected whole leaves one whole rest (P4: an empty bar is one whole-bar rest). |
| `empty-bar-press` | A press in an empty bar boxes the whole bar (#317). |
| `fret-follows-tie` | A fret change carries on to the note tied to it, over the bar line (P11). |
| `longer-note-writes-over` | A longer note writes over what follows, split and tied at the bar line (P7, P5). |

Left out for now: rest lengths (#294; A3 takes the rest-length keys away),
how a shortened note's rests are spelled (A4 spells them by the meter), and
Ctrl/⌘+Delete (A10 makes it pull the music across bar lines).

## Tests

- Each file reads with no warnings, every bar full, and writes back exactly
  (`examples.test.ts`, as for every built-in folder).
- Each behaviour shown has its own test: `restLengths.test.tsx` (a bar
  selected and deleted becomes one whole rest; a longer note past the bar
  line is tied on), `page/emptyBar.test.tsx` (the bar box), and
  `editing.test.ts` (a fret change carries on to the notes tied to it,
  across the bar line).
