# Tab: a double-click edits a word (issue #289)

Jeremy, 2026-11-01: "Annotations that support an edit option should automatically open their edit
dialog if they're double-clicked. For example, the x3 annotation for repeats." A deliberate exception to
his usual "no double-click triggers", as the score head's title and credits (#227) and the arrangement
browser (#244) are.

## What a double-click on the drawing does

A double-click picks what is under it, as a press does, then:

- **on something with an Edit** in its right-click menu (`docs/specs/2026-11-01-tab-selection-look-design.md`):
  a chord name, text over a column, a section, a tempo, the capo, an ending, or a repeat's end or its
  ×N count, it opens the same field the menu's Edit opens, where Edit puts it. This works in note input
  too, as the menu does.
- **on something with only Delete**: a mark (P.M. and let ring lines too), a repeat's start or a double
  bar, it leaves it picked and does nothing more.
- **on a time or key signature**: its panel is already open from the press; nothing more.
- **anywhere else** on the staff or the tab, out of note input, it goes into note input, picking nothing,
  as before (issue #238, Jeremy 2026-10-31). In note input it does nothing.

## Code

`TabClip`'s `onDoubleClick` hands back the word or bar line under the pointer and whether a mark was
(the same `target` a press uses). `hasEdit` in `TabPage.tsx` says which picked things have an Edit,
for the menu and the double-click alike, and the double-click runs the menu's `editPicked`.

Tests: `src/__tests__/tab/doubleClickEdit.test.tsx`, one per kind, plus the note-input fallback.
