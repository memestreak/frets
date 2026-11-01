# Tab: View options per view, and Size over the clip (issue #277)

Jeremy, 2026-11-01: "Update the tab page view presentation to be specific to the view tab
(e.g., notation, ascii tab, or alphatex). Clicking on the view options (the eye icon) should only
show the common options or the options specific to the view type. The common option is just the
page color. Move the notation size widget out of the view options and put it to the right of the
'staff/tab/both' selector."

This replaces "The panel always lists every view's options" in
`2026-10-28-tab-sweet-child-intro-design.md` (View options); the options themselves, their defaults
and their saved keys are unchanged.

## The panel

The eye button is on every view, as before. Its panel lists:

- **Colours** first, for every view ("page color": Theme | Paper | Sepia | Night | Custom, with
  Custom's two swatches).
- Then only the shown view's own options, under its name:
  - **Notation**: Bar numbers (Every bar | Each line | None) and Clip's line breaks.
  - **ASCII Tab**: Rhythm.
  - **AlphaTex**: Line numbers.

Left open while the view changes (from the keyboard, say), the panel follows the new view.

## Size

Notation's **Size** (50% to 200%, steps of 10) leaves the panel and sits in the card's bar, right of
Staff | Tab | Both, labelled "Size", in the Notation view only (the text views have no size). It is
the same number field as before: drag up or down, the buttons, or type (to the nearest step); a
double-click puts it back to 100%. On a phone the left group wraps under itself when it runs out of
room.

## Unchanged

- Settings › Tab keeps every option in its sections (Notation, Colours, ASCII Tab, AlphaTex), Size
  included; the saved keys stay `frets.tab.notation`, `frets.tab.colours`, `frets.tab.ascii` and
  `frets.tab.alphatex`.
- Copies, saves and exports follow the options as before.
