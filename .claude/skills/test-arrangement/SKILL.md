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
  bars of plain notes. Add a bar before and after when the behaviour
  reaches across a bar line, so its edges show.
- **No look-alikes**: nothing near the column under test that a slip of
  the hand could hit and still seem right.
- Check the README table first; extend a file when it is the same rule.

## 3. Word it

A person must be able to follow the steps with no guessing. Text over
this column (`{txt "..."}`) goes over the column it's about:

- **The steps**, over the column to press. They name **the view**
  first: "Tab view:", "Staff view:" or "Both view:". The Clip can't set
  it (Staff | Tab | Both is a preference), so the text must. Pick the
  view the behaviour is about, or Tab when it's the same in all. Then
  **what to press**, pointing at the column the text sits over and naming
  it as drawn ("press this 0", "press this 5 (a half note)"). In Both
  view, say whether that's on the tab or the staff. Use "anywhere in
  this bar" only when anywhere really works. Then **the keys or buttons**,
  in order, with both platforms' modifiers: "then Ctrl/⌘+Shift+→ and
  Delete". Name a palette button by its tip ("the Whole button in Notes ›
  Duration").
- **The result**, over the column where it shows: "This (5) turns (7)".
  When it shows on the same column, put it in the steps text. Say what
  stays when a slip would move it.
- **Texts an edit removes.** A text belongs to its column, so an edit
  that rests or overwrites that column (Delete, a longer note) takes the
  text with it. Put the result on a column the edit leaves alone, and
  name the place by bar: "Bar 2 is now one whole rest".
- One way to do it, the shortest, and the way you checked in the browser.
- A long text wraps, and texts that would touch stack
  (`docs/specs/2026-11-03-tab-text-wrap-design.md`), so length isn't a
  problem, but keep each to a sentence or two. Use the glossary's words,
  not those under `_Avoid_`.

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
  next link opens), in the view the steps name, follow the steps exactly
  as written, and see that what happens is what the result text says and
  that no text runs into another. If the behaviour
  differs, the app or the text is wrong: find out which before going on.
- Say in the PR description which test arrangements it adds, changes or
  removes.
