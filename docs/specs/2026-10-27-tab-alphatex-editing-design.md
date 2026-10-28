# Tab: editing the alphaTex text

Issue #126. Jeremy asked on 2026-10-27 to edit a clip's alphaTex directly in
the AlphaTex view, which until then showed the text read-only. His answers to
four design questions, in the order asked, are below.

## When the text changes the clip

Live (his pick 1 of: live, on leaving the editor, an Apply button). Half a
second after the last key (`READ_DELAY_MS`), the text is read with alphaTab's
parser, as Import reads it. If it reads cleanly and says a different clip,
that clip replaces the current one as **one undo step**, and the Standard and
ASCII Tab views show it. If it does not read, the clip stays as it last was.

Inside the text box, Ctrl+Z is the browser's own undo of typing. Outside it,
the page's undo and redo work as everywhere on the page, and the box then
shows the clip written out again.

Leaving the view before the half second is up still applies the last keys if
they read cleanly.

## Errors

A syntax error comes from alphaTab with its place in the text. Errors from
Frets' own limits have no place: one track and one staff, one voice, six
strings. (Jeremy asked whether syntax errors could be found at all; they can.)
Errors show as his pick 1 of: margin and underline, a list under the editor,
or both:

- A red ⚠ in the margin beside the line, before the line number.
- A red wavy underline under the text alphaTab names. An error at the end of
  the text underlines a space.
- An error with no place is marked on line 1.
- Resting the mouse on the ⚠ or the underline shows the message, after the
  page's usual one-second tip delay.
- There is no caption.
- Screen readers get the messages through the box's `aria-describedby`, and
  the box is `aria-invalid` while there are any.
- Marks found for an older text are hidden until the next read, so a mark
  never sits on the wrong characters.

## Formatting and comments

Jeremy first picked 1 of: rewrite on leaving the view, keep the text until an
edit elsewhere, keep comments in the clip. After trying it he asked why the
text was rewritten on every switch of view; nothing required it, so he chose
the second (2026-10-27):

- The text stays as typed, with its spacing and comments, across switches of
  view, even when it has errors.
- Only an edit that changes the clip from outside the box (on the Standard
  view, an undo, an import, an example) writes the clip out again in Frets'
  own layout. Comments are dropped then.
- Each line holding a comment gets a grey ⚠ whose tip says "Comments are not
  kept", so dropping one is no surprise.
- The typed text is not saved: a reload shows the saved clip written out.
- Keeping comments in the clip was left for later.

## The editor

Jeremy's pick 1 of: a plain text box, or CodeMirror.

- A plain `<textarea>` in Fretwood styling: a raised surface with the strong
  line border, the monospace face with no ligatures, and no syntax colours
  or new library.
- The text as typed and the clip it was typed against are held by the page
  (`draft` in `TabPage.tsx`); the box shows it while the clip is still that
  clip.
- The textarea lies over a copy of its lines (`AlphaTexEditor.tsx`). The copy
  draws the line numbers and ⚠ in a margin to the left and the underlines
  under the transparent text. Both wrap long lines the same way, so on a
  phone the marks stay under their characters and the page never scrolls
  sideways.
- The copy button copies the text as typed.
- Pure helpers are in `alphatexText.ts`: where the comments are, which line
  a spot is on, and each line's mark. The reader returns each error's spot
  as string indexes (`TextSpot` in `ascii.ts`). alphaTab counts code points,
  which the reader converts.
- `HoverTips` now restarts its tip when an element's `data-tip` changes under
  the mouse. The textarea sets its own tip to the underline under the
  pointer.

## Clear

Jeremy, 2026-10-27: "Add a small X button in the top left of the alphatex
view that clears the buffer. Mouseover should be \"Clear\"".

- In the AlphaTex view only, a small × button titled "Clear", inside the
  text box at its top right (moved there 2026-10-28 from the top left of
  the clip's card, at Jeremy's ask). The text keeps clear of it: every line
  wraps a button's width plus 12px short of the box's right edge.
- It empties the text and makes the clip an empty one (no title, one empty
  4/4 bar, which is what empty text reads as), one undo step, so Ctrl+Z
  brings everything back. No confirmation, since undo covers it.

## Not editable

The ASCII Tab view stays read-only, the recommended answer to the last
question, built before Jeremy picked.
ASCII can't hold everything a clip has: tuplets, grace notes and the symbols
kept as written. An edit there would drop them.

An example's edits are never saved, as with every other edit.
