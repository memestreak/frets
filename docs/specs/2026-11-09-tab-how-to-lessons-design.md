# Tab: How to lessons

Issue #443 (Jeremy, 2026-11-09, while reviewing Lyrics in PR #441): the
test arrangements, with numbered steps written on the bars, are a good way
to teach or remind people how a feature works. So: a folder of built-in
Arrangements written for people learning Frets, one per feature.

## What it is

- The folder is `src/features/tab/builtin_arrangements/how_to/`, shown as
  Arrangements… → Built-in → How to. Each lesson opens with
  `/tab#example=<file name>`, as every built-in does, as a new
  arrangement that isn't saved until Save, so trying the steps changes
  nothing kept.
- One feature per lesson, the whole of it a learner needs, not its edge
  cases (those belong to `editing_tests/`, which stays as it is).
- `\title` is a number and the feature: "1. Type notes". The dialog sorts
  by title with numbers in order, so the folder reads as a course, from
  typing notes to copy and paste. A new lesson takes the next number, or a
  place in the order and the ones after it renumbered.
- One short step per Text, each on its own bar (Jeremy, 2026-11-09: "way
  too much text in one note... make sure that any of our text notes are
  significantly less wordy and broken up"). A Text is at most 60
  characters, about a line, so it reads at a glance and no two touch. The
  first step names the view ("Tab view. 1. Press N."), as the
  `test-arrangement` skill says; a step points at what to press as drawn
  ("Press this 7") and spells keys in words ("the Right arrow key").
- A lesson that types into empty bars has one step over each of them, in
  order; the bars it types into fill from the start, so a step's Text
  need not sit over the bar its notes land in.
- A Text over a column you'll copy is copied with it, so a lesson keeps
  its Text off the columns its steps copy.

The thirteen lessons, in order: type notes; type chords and name them;
change notes; type notes on the staff; hammer-ons, slides and ties; bends
and vibrato; let ring and palm mute; triplets and other tuplets; grace
notes; two voices; repeats and endings; play and loop; copy and paste.
Lyrics (PR #441) and dynamics (PR #440) get theirs once they merge.

## Keeping them true

- The folder's `README.md` lists each lesson, what it teaches, and the
  keys its steps teach, spelt as `shortcuts.ts` spells them.
- A test checks that every key listed is still one of the Tab page's
  shortcuts (`TAB_SHORTCUTS` and the page-wide `?`), a range such as
  `Shift+1–7` counting each key in it, and that every lesson has a row.
  So a PR that changes a key fails until the lessons teaching it are
  rewritten. It can't check what a step says happens: that is kept by the
  rule that a PR changing what a lesson shows updates its Text, walked
  through in a browser.
- Like every built-in folder but `samples/`, each lesson reads with no
  warnings, every bar full, and writes back exactly.

## Reading

- The open questions in issue #443 were settled with these choices, for
  Jeremy to change: the folder is "How to"; numbered titles, in course
  order; the key check above. Linking the lessons from the `?` overlay or
  a new arrangement is left for later.
- Chord diagrams from the Chords panel are not a lesson yet: the panel
  has its own dialogs and an editing test (`chords-panel-edit.atex`).

## Tests

- Every file in `how_to/` has a row in its README, and every row a file.
- Every Text in a lesson is 60 characters or fewer.
- Every key in a row's Keys column is a Tab page shortcut; `Shift+4` and
  `Alt+2` count as listed (from `Shift+1–7`, `Alt+1–4`), `Shift+8` doesn't.
- Each lesson reads with no warnings and writes back exactly
  (`examples.test.ts`, as for every built-in).

## Code

No code changes: the dialog lists a new folder on its own. The test is
`src/__tests__/tab/howTo.test.ts`.
