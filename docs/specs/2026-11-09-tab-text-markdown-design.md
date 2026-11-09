# Tab: bold and new lines in a Text (issues #446, #445)

A Text over a column (alphaTex `txt "..."`) was drawn as typed, on one
line that wrapped at its spaces. Jeremy asked (2026-11-09, while
reviewing the How to lessons, PR #444) for a little Markdown in it, kept
as typed in the alphaTex so other programs show it plainly, and, in the
same PR, for new lines where its writer puts them.

He answered the design questions on 2026-11-09
(https://claude.ai/artifact/8Zc5NwZ1qbvSMH3AKBnTgc): bold only;
other marks as typed; wrapping as before; MusicXML keeps the bold;
Guitar Pro leaves the marks out; Ctrl/⌘+B in the field ("Cmd+I only in
the future, if we support italics"); Texts only, not section names or
lyrics.

## Bold

- `**words**` and `__words__` are drawn bold (weight 700, the Text's
  italics and ink kept); the marks are not drawn.
- Nothing else is read: `*one star*`, `_one underscore_`, `***three***`,
  `` `code` ``, `~~strike~~`, links and an unclosed or empty `**` are
  drawn as typed. `_` inside a word (snake_case) stays as typed.
- A backslash before a star, an underscore or another backslash draws it
  as typed (`\*`); before any other letter it is a letter. In alphaTex
  the backslash is itself escaped: `txt "\\*"`.
- The reader is the Chat panel's own (`parseInlines` in
  `chat/markdown.ts`, issue #427) with `boldOnly` on; there is no second
  parser.
- The alphaTex, the AlphaTex view, share links and copy keep the marks
  as typed.

## New lines

- A Text may hold new lines. In alphaTex a new line is written `\n`
  inside the string (alphaTab 1.8.4's reader takes `\n`, `\r`, `\t` and
  `\uXXXX`), so a clip still writes back exactly and the string stays on
  one line.
- Each new line starts a new drawn line; wrapping still breaks a long
  line at its spaces. Two new lines in a row leave an empty line.
- A Text with a new line is never a short text: it always goes over the
  chord names, as a note of more than one line.

## Width and wrapping

- The width guess counts drawn letters only: 5.6px a plain letter, 12%
  more a bold one (`BOLD_WIDER`, Figtree's bold over its regular). So
  the 60-character limit, the 100px least room, the gap to the next
  Text, the pick box and the press area all follow the drawn letters.
- A bold run wraps at its spaces like any other words, and stays bold on
  the next line.
- The 20-character short-text rule counts drawn letters, so
  `**let ring**` still goes under the chord names.

## The Text field

- The Text field is a textarea, one row high, growing a row for each new
  line up to six, then scrolling. Other words' fields stay one-line
  inputs.
- Enter sets the Text, Shift+Enter starts a new line, Esc leaves it as
  it was.
- Ctrl/⌘+B wraps the selected words in `**`, or takes the `**` off when
  they already have it (from inside the marks or with them selected).
  Spaces and new lines at the selection's ends stay outside the marks,
  as Markdown needs; the selection stays on the same words. With nothing
  selected it puts `****` in with the caret between. It does nothing in
  other fields, or when the Text would pass 200 characters.
- Both keys are in the `?` overlay under "In the Text field".

## Exports

- PNG, SVG, print and the `show_tab` MCP App draw it as the page does.
- MusicXML writes the Text as one `direction-type` with a `words` for
  each run, the bold ones `font-weight="bold"`, as MuseScore writes
  styled text; a new line stays in the words.
- Guitar Pro (.gp) gets the drawn letters: the marks left out
  ("**Esc**" goes as "Esc"), and a new line as a space, as a Guitar Pro
  text is one line. Frets never reads .gp back, so nothing is lost.
- ASCII tab still writes no Texts.

## What others do

Dorico and MuseScore format any selected text with Ctrl/⌘+B (and italic,
underline) in their text editors; Guitar Pro 8's beat text is plain.
None reads Markdown.

## How

- `textMarks.ts`: `readTextMarks`, `drawnText`, `runsOf`, `toggleBold`.
- `chat/markdown.ts`: `parseInlines(text, { boldOnly: true })`.
- `stackWords.ts`: `wrapWords` breaks at new lines and tells the width
  where each line starts; `lineStarts`.
- `beatText.ts`: `placeBeatTexts` and `wrapBeatText` wrap the drawn
  letters, measured with their bold; `beatTextLines` gives the runs to
  draw and the widest line; `textGoesUnder` counts drawn letters.
- `ClipWords.tsx`: a `tspan` per line, and in it one per bold run.
- `WordField.tsx`, `tab.css`: the textarea, Shift+Enter and Ctrl/⌘+B.
- `alphatex.ts`: `quoted` writes a new line as `\n`.
- `musicxml.ts`, `guitarPro.ts`: the exports above.
- `public/tab-alphatex.txt`: the guide for agents.
- Test arrangement `editing_tests/text-markdown.atex`.

## Tests

`src/__tests__/tab/textMarks.test.ts`, `chatMarkdown.test.tsx`,
`beatText.test.ts`, `alphatex.test.ts`, `musicxml.test.ts`,
`guitarPro.test.ts`, `page/editing.test.tsx`:

- `**Esc**` and `__Tab__` draw bold, the marks left out.
- `*x*`, `_x_`, `***x***`, code, strike, a link, `**open`, `5* chord`,
  snake_case, `a ** b **`, `****` and `\(` draw as typed.
- Bold inside `*...*` or backticks is read; those marks stay.
- `\*`, `\_`, `\\` draw `*`, `_`, `\`.
- A new line is kept, and bold runs over it.
- A bold letter is 12% wider; a bold Text wraps as its plain letters
  would in 1/1.12 of the room, and every wrapped line stays bold.
- A wrapped line keeps the space it broke at, not a new line.
- `a\n\nb` is three lines, the middle empty; a long line still wraps.
- `**let ring throughout**` goes under; `let\nring` doesn't.
- The pick box is as wide as the drawn bold letters.
- alphaTex writes a new line as `\n` and reads it back exactly.
- MusicXML: one `direction-type`, `words` per run, bold ones
  `font-weight="bold"`, the new line kept.
- Guitar Pro: marks left out, a new line a space; every built-in reads
  back from .gp as its alphaTex with its Texts as drawn.
- Ctrl/⌘+B wraps and unwraps the selection, from inside or with the
  marks selected, leaves spaces and new lines outside, and puts `****`
  in with nothing selected; the selection stays on the words.
- The Text field is a textarea; Shift+Enter doesn't set it; it grows a
  row a line; Ctrl/⌘+B and Shift+Enter do nothing special in the Chord
  name field.
