# Tab: markdown in the Chat panel's replies

Jeremy, 2026-11-08: "Open an FR that tracks supporting markdown rendering in
our chat responses in tab. Then begin to implement it." Issue #427; the Chat
panel is `docs/specs/2026-11-08-tab-chat-design.md` (issue #424).

## What it does

- A model's words under each reply are drawn as markdown: paragraphs,
  headings (`#` to `######`, drawn small: levels 1 and 2 at 15px, the rest at
  14px, so they never outshout the page), **bold**, *italic*, ~~struck~~,
  `code`, fenced code blocks, bulleted and numbered lists (nested, and a
  numbered list starts at its first number), quotes, rules and tables (with
  `:---:` alignment).
- A single newline inside a paragraph stays a line break, as the plain reply
  showed it.
- **Links open in a new tab** (`target="_blank" rel="noopener noreferrer"`),
  as every cross-page link in Frets does. Bare `https://…` addresses and
  `<https://…>` are links too; a sentence's last full stop stays outside.
- **Only http, https and mailto addresses are links.** `[words](javascript:…)`,
  `data:`, a relative path or anything else shows only its words.
- **An image is a link to it**, labelled with its alt text: the panel never
  loads a picture a model names.
- **Raw HTML is never markup.** The reply is read into blocks and drawn as
  React elements, never through `innerHTML`, so `<script>`, `<img onerror>`
  and `<b>` show as the text the model wrote.
- Quiet, in the panel's own type: code and table cells on `--surface-sunken`
  and `--line`, links in `--primary`, quotes and list markers in
  `--ink-muted`. A long code line or a wide table scrolls inside its own box;
  the panel never scrolls sideways.
- The viewer's own asks stay plain text, as typed.
- The system prompt now says the answer is shown as markdown (short lists, a
  small table or `code` where they help; HTML shows as text) instead of "plain
  sentences".

## How

- `chat/markdown.ts`: `parseMarkdown` (blocks), `parseInlines`, `safeHref`.
  A small reader of what chat replies use, written for Frets rather than a
  dependency: the page has few, and a CommonMark library with an HTML
  sanitiser would be the larger part of the panel.
- `chat/ReplyMarkdown.tsx`: the blocks as elements, in `.tab-chat-text`.
- `ChatPanel.tsx` draws a reply's text with `ReplyMarkdown`.
- `tab.css`: the `.tab-chat-text` rules and `.tab-chat-table`.

## Not yet

- Syntax colouring in code blocks.
- Drawing an alphaTex block in a reply as tab.

## Tests

- Paragraphs split at blank lines; a single newline is a break.
- `## Bar 3` is a level-2 heading; `### In C# minor ##` keeps "In C# minor";
  `#hashtag` is a paragraph.
- A fenced block keeps its text as typed, with its language; one never
  closed runs to the end.
- `- ` and `* ` items make one list, also straight after a line of text;
  `3.` starts a numbered list at 3 (`<ol start="5">` for 5, no `start` for 1).
- A list indented two spaces under `1.` nests; blank lines between items keep
  one list; an indented paragraph after a blank line stays in its item; an
  unindented one ends the list.
- `- - -` and `***` are rules.
- A quote holds markdown and line breaks.
- A table reads `:---`, `:---:`, `---:` as left, centre, right; a short row
  gets empty cells; a pipe inside `code` or escaped as `\|` stays in its cell;
  `A | B` with no delimiter row is a paragraph.
- `**a** *b* ***c*** ~~d~~ __e__ _f_` are strong, em, strong em, del, strong,
  em; `*a **b** c*` nests.
- `read_arrangement and replace_bars`, `a * b`, `2 * 3 * 4`, `**open` and
  `x~y` stay as typed.
- Code spans hide markdown (`` `**x**` ``), take a longer fence
  (``` `` a`b `` ```); `\*` is a star.
- `[**docs**](https://example.com/a_(b) "Title")` links with a strong label;
  `mailto:` links.
- `javascript:` (any case), `data:`, `/tab` and `vbscript:` give only the
  words, no link.
- An image is a link labelled with its alt text.
- `See https://frets.eminor.net/tab.` links without the full stop; `(at
  https://x.org/a)` without the `)`; `<https://x.org>` links.
- `<img src=x onerror=…>`, `<script>` and `<b>` show as text: no element.
- A link has `target="_blank"` and `rel="noopener noreferrer"`.
- Each block draws as its element: `h3`, `ol`/`li`, `strong`, `code`,
  `blockquote`, `hr`, `pre`, a table in `.tab-chat-table` with
  `text-align: right` on a right column.
