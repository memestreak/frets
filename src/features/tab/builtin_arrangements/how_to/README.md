# How to

Lessons: each built-in arrangement here teaches one Tab feature to someone
using Frets, with numbered steps in Text over the bars (what to press, what
you'll see) and room to try it (issue #443). They show under Arrangements…
→ Built-in → How to, and open with `/tab#example=<file name>`. Titles start
with a number, so the dialog lists them in course order.

They differ from `editing_tests/`, which shows one editing behaviour for
checking a PR: a lesson is written for a learner, walks through a whole
feature, and leaves out edge cases.

Like every built-in folder but `samples/`, each file must read with no
warnings, every bar full, and write back exactly
(`src/__tests__/tab/examples.test.ts`).

## Keeping them true

- Each file has a row below, and its Keys column names every key its steps
  teach, spelt as in `src/features/tab/shortcuts.ts` (`Mod` for Ctrl/⌘).
  `src/__tests__/tab/howTo.test.ts` checks each is still one of the Tab
  page's shortcuts, and that every file has a row. A PR that changes or
  removes one of these keys updates the lessons that teach it.
- A PR that changes what a lesson's steps show updates its texts in the
  same PR. Walk through it in a browser, step by step, exactly as written.
- One short step per Text, each on its own bar, never a paragraph
  (Jeremy, 2026-11-09): what to do on the first line, with the keys in
  **bold**, and what you'll see on a second line (`\n`) when it helps.
  The test holds each Text to two lines of 60 characters. The first step
  names the view ("Tab view. 1. Press **N**."); keys are spelt out
  ("the **Right arrow** key"), as the `test-arrangement` skill says.
- A feature gets its lesson once it is merged: Lyrics (PR #441) was
  still open when these were written.

| File | Teaches | Keys |
| --- | --- | --- |
| `enter-notes.atex` | Note input mode: entering frets, moving on, note lengths, changing string, playing | N, 0–9, Right, Shift+1–7, Down, Esc, Space, ? |
| `enter-chords.atex` | Entering a chord a string at a time, moving on by its length, naming it | N, 0–9, Down, Up, Shift+Space, Esc, C |
| `change-notes.atex` | Changing typed notes in normal mode: fret, length, rest, string, undo | Alt+Up, Alt+Down, 1–7, Mod+Z, Delete, Mod+Down |
| `enter-notes-on-the-staff.atex` | Entering notes on the staff by letter, with a length and a sharp | N, A–G, 1–7, =, Esc |
| `ties-and-slides.atex` | Hammer-ons, pull-offs, slides and ties | H, Alt+/, T |
| `bends-and-vibrato.atex` | Bends (¼, ½, full) and vibrato (normal, wide) | B, V |
| `let-ring-and-palm-mute.atex` | Selecting a bar of notes, then let ring and palm mute | Shift+Right, I, M |
| `triplets.atex` | Tuplet entry in note input mode, and a tuplet on a note | N, Shift+1–7, ;, 0–9, Right, Esc |
| `grace-notes.atex` | A grace note before a note, and grace entry | /, Alt+Down, N, 0–9, Right, Esc |
| `two-voices.atex` | A second voice under a melody | N, Alt+1–4, Down, Shift+1–7, 0–9, Shift+Space, Esc |
| `repeats-and-endings.atex` | Repeat signs, first and second endings, playing them | [, ], E, Space |
| `play-and-loop.atex` | Playing, and looping a selection | Space, Shift+Right, L |
| `copy-and-paste.atex` | Copying notes and pasting them into another bar | Shift+Right, Mod+C, Mod+V |
| `set-dynamics.atex` | Setting a dynamic, which holds until the next one | Shift+D |
