# Tab: Delete at the playback line

Jeremy, 2026-10-29: with the playback line placed at the end of a bar whose last beat is a
rest, "pressing delete here should delete the rest before the play cursor". Until now Delete
and Backspace did nothing off the tab.

## Behaviour

Off the tab (the tab doesn't have the keys, the playback line or a selection made from it is
shown), Delete and Backspace act the same way, on what is before the line, as Backspace does in
text. The line is a gap between columns with no string picked, so the keys follow the tab's
rules for a column with no string picked:

- A selection (made with Shift+← → or Shift+press from the line) goes; the line is left where
  it began.
- Else the column just before the line:
  - holds notes: it becomes a rest of the same length; the line stays after it;
  - is a rest: it goes, and the line steps back over the gap it leaves.
- The line at the clip's start, or no line: nothing happens.

Each press is one undo step. A bar whose only column goes is left empty, as on the tab. The bar
is not filled again with rests afterwards: the uneven-bar line under the clip names what is
short, as after any other edit.

Delete acting before the line rather than after is a choice: in his case nothing is after the
line, and both keys doing one thing keeps one way to do it.

## Code

`deleteAtLine` in `src/features/tab/editorKeys.ts` (pure), called by `lineKeyDown`; the page's
`editAtLine` records the edit and holds the line at its new gap. Tests in
`src/__tests__/tab/deleteAtLine.test.ts` and `TabPage.test.tsx`.
