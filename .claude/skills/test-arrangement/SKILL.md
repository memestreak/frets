---
name: test-arrangement
description: Add or update a test arrangement (a built-in Tab
  Arrangement in editing_tests/ that sets up one editing behaviour for a
  person to try, with the expected result as Text over the column). Use
  whenever a change adds or changes how editing on the Tab page behaves,
  or when the user invokes /test-arrangement.
---

# Test arrangement

A test arrangement is a built-in Arrangement in
`src/features/tab/builtin_arrangements/editing_tests/`. It opens with a
Clip set up so one editing behaviour is easy to try, and says in Text over
the column what to do and what should happen. Anyone can open it from
Arrangements… → Built-in → Editing tests, or with `/tab#example=<file>`,
so the folder shows people how editing behaves and lets them try it.

It is not a test of the code: every behaviour it shows still needs an
automated test, and a spec's `## Tests` list never points to one
(Jeremy, 2026-11-03). The round-trip check only keeps the file readable.

## When

- A change adds a Tab editing behaviour: add one for it, if a person
  would learn something by trying it (not for every edge case).
- A change alters a behaviour a test arrangement shows: update its
  texts or Clip in the same PR, or remove it and its README row when the
  behaviour is gone. Check the README table for files the change touches.
- The user asks, naming a behaviour, or a spec, issue or PR.

## 1. Read

- `GLOSSARY.md` (the Tab terms: Arrangement, Clip, Track, System, …).
- `src/features/tab/README.md`, and the spec that pinned the behaviour
  (`docs/specs/`, listed under `## Specs` there).
- `src/features/tab/builtin_arrangements/README.md` and
  `editing_tests/README.md`: the folder's rules and the list of files.
- The alphaTex guide, `public/tab-alphatex.txt`, for the syntax.

If the behaviour isn't settled (no spec or merged PR says it, or an open
decision may change it), say so and ask before writing one: a test
arrangement that pins a guess is worse than none.

## 2. Choose

- **One behaviour per file.** Two cases of one rule may share a file;
  two rules may not.
- **The smallest Clip that shows it**: 4/4, standard tuning, two or three
  bars, plain notes. Add a bar before and after when the behaviour reaches
  across bar lines, so its edges show.
- **No look-alikes**: nothing near the column under test that a slip of
  the hand could hit and still seem right.
- Check it against an existing file first; extend that one when it is the
  same rule.

## 3. Word it

Steps and expectations are Text over this column (`{txt "..."}` on the
beat; the palette's Text group):

- Over the column to act on: what to do, in the app's words for keys and
  buttons. "Pick this note, press W".
- Over the column where the result shows: what should happen. "Its tied
  half covers these two". When it shows on the same column, put both in
  one text: "Select this bar, press Delete: one whole rest".
- Say what stays too, when a slip would move it: "These two stay".
- Short and apart: a text runs to the right and doesn't make room for
  itself, so close columns' texts run into each other. Keep one text per
  bar where you can, under about forty characters; when the column to act
  on is narrow, put the step on the bar's first column and name the
  column ("Select bar 2, press Delete").
- Use the glossary's words, not those under `_Avoid_`.

`\title` names the behaviour as a statement of what happens: "A longer
note writes over what follows", not "Lengthen test".

## 4. Name and place

- File: `editing_tests/<behaviour-in-kebab-case>.atex`. The name must be
  unique across every built-in folder (it is the `#example=` link).
- Add a row to the table in `editing_tests/README.md`: the file, what it
  checks, and the spec or issue that pinned it.

## 5. Check

- `npx vitest run src/__tests__/tab/examples.test.ts`: the file must read
  with no warnings, every bar full, and Frets must write it back exactly.
  Write the file the way Frets writes it (line wrapping and all): open it
  in the app and copy the AlphaTex view, or read and write it with
  `readAlphaTexWith` and `writeAlphaTex` once and save the result.
- Open `/tab?theme=light#example=<file>` in a browser (`npm run dev`),
  in a fresh page each time (an edited Clip asks to be saved before the
  next link opens), follow the steps, and see that what happens is what
  the text says and that no text runs into another. If the behaviour
  differs, the app or the text is wrong: find out which before going on.
- Say in the PR description which test arrangements it adds, changes or
  removes.
