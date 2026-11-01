# Tab: pick the title and credits, and fold the arrangement header (issue #281)

Jeremy, 2026-11-01: "Clicking on the title or attribution should select it rather than immediately
opening an edit dialogue. The title is not optional. It needs to be at least one character of
non-white space. On selection, the title and attribution information should allow for a
minimization or collapse option that hides the title/attribution and moves just the title in small
text to the right of the page zoom widget at the top of the arrangement. The inverse is also
possible. Clicking on the smaller version should allow us to expand it. Should also be available in
our notation view settings as an 'Arrangement header' option, and in the top level settings."

"The page zoom widget" is read as Notation's Size field, after Staff | Tab | Both.

This changes the press on the title and credits in `2026-10-29-tab-credits-tuning-design.md`; the
tuning and the tempo still open their panels on a press.

## Picking

- A press on the title or on the credits (the artist and the "Words & Music by" lines) **picks the
  two together** (Jeremy, 2026-11-01: "the selection box should be drawn around the title and the
  attribution"): one outline round both, as a picked word over the tab is (`--select` line on
  `--select-soft`, the app's selection blue), with two icon buttons to its right: **Edit title and credits** (pencil) and
  **Collapse header** (two chevrons meeting). The room round them is there whether picked or not, so
  nothing moves.
- **Edit** or **Enter** opens the Title and credits panel on the title; a **double-click** opens it
  on the line pressed (the title's field or the artist's). Nothing stays picked once it opens.
- A second press keeps it picked. **Esc**, Space (which plays), or a press anywhere else lets it go.
- "Add artist and credits" (no credits yet) still opens the panel at once: there is nothing to pick.
- The `?` overlay lists Enter and Esc under "Picked title or credits".

## The title is needed

The title (the arrangement's name) needs at least one character that isn't a space.

- In the Title and credits panel the field is "Title", not "(optional)". While it is blank a small
  red ⚠ after its label says "The title can't be blank", the head keeps showing the title it had,
  and Enter, a press away or Esc keep that title.
- Save as…'s Name: blank, the same ⚠, and Save does nothing.
- Renaming in Arrangements…: a blank name keeps the one it had.
- A new arrangement (New, the page's first open, the AlphaTex view's ×) and one opened with no title
  (an import, a link, a drop, a built-in) is titled **Untitled**, a real title renamed like any
  other (Jeremy, 2026-11-01, Q3). Typed alphaTex with no `\title` keeps the title the clip has.

## Folding

- **Collapse header** hides the title and credits (and "Add artist and credits"). The tuning and
  tempo stay over the drawing (Jeremy, 2026-11-01, Q2). The title moves to the card's bar, right after Size, in small muted
  text (13px, `--ink-muted`, truncated with … past 24 characters); a hidden h1 keeps the page's
  heading for screen readers.
- The small title is picked the same way (Jeremy, 2026-11-01): a press outlines it, with **Edit
  title and credits** and **Expand header** (two chevrons parting) to its right; Expand brings the
  head back at full size. A double-click or Enter opens the panel, as on the full head; Esc or a
  press elsewhere lets it go.
- It is a view option, not part of the clip: **Arrangement header** in View options' Notation
  group, on when the head is shown, and the same field in Settings › Tab › Notation, saved in
  `frets.tab.notation` as `header` (default `true`). It applies to every arrangement.
- Only the Notation view has the head, so the small title shows in Notation only.
- Exports are unchanged: the image prints the title and credits as its own Clip name option says.
