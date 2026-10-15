# Copy a chord diagram

Jeremy, 2026-10-15: copy a chord diagram from the Chord library as a PNG
with a transparent background, or as an SVG. Of three mocked placements
(a Copy button beside Arpeggio, a copy icon on each diagram, an Export
dialog) he picked the dialog, opened from a right-click menu on the small
diagrams. Nothing is copied from the neck.

## Where

Every small shape diagram in the Open and Moveable groups
(`VoicingGroups`), so the Chord library and the Chord lab both have it.
The neck, the Scale lab's diagrams and the arpeggio have no export.

Opening the menu on a diagram:

- right-click;
- a long press on a touchscreen (iPhone Safari sends no `contextmenu`, so
  the diagram times the press itself);
- Shift+F10 or the menu key on a focused diagram.

The menu has two items:

- **Copy as PNG**: copies that shape with the saved export choices.
- **Export options…**: opens the Export dialog for that shape.

Opening the menu does not select the shape, so the neck stays as it is.
Esc, a click elsewhere, a scroll or choosing an item closes it. ↑ ↓ move
between the items; ← → do nothing while it is open (they would otherwise
step the selected shape).

## The Export dialog

A native modal `<dialog>`, titled with the chord and the shape ("Export
Am7, root on A · frets 1–2"), with a live preview of the image and four
choices, each a segmented control:

| Choice | Options | Default |
|---|---|---|
| Colours | Black & white, Degree colours | Black & white |
| Background | Light, Dark | Light |
| Intervals | Hide, Show | Hide |
| Chord name | Show, Hide | Show |

Background sets the ink: dark ink for a light page, light ink for a dark
slide; the image itself is always transparent. The preview sits on a white
or near-black tile to match.

Below the choices: **Copy PNG** (primary), **Copy SVG**, **Download PNG**,
**Download SVG**, and a line saying what happened ("Copied as PNG",
"Copied the SVG code", "Couldn't copy: …"). The dialog stays open after an
action; Done or Esc closes it.

The choices are saved in `localStorage["frets.chords.export"]` and are what
the menu's Copy as PNG uses. A chord with no name (the Chord lab before a
name fits) is exported without one, whatever the choice.

## The image

The export is the same `ChordDiagram` the page draws, given concrete
colours instead of the page's CSS variables, so the two can't drift apart:

- **Black & white**: every line, dot, ring, ×, number and the name in black
  (white on Dark). Interval labels, when shown, are white on the black dots.
  The root stays square, so it still reads without colour.
- **Degree colours**: the Fretwood degree colours, from the light or the
  dark theme to match Background, with the theme's line and ink colours.
- **Intervals**: the label inside each fretted dot, as the neck shows it.
  Open-string rings stay unlabelled.
- **Chord name**: the symbol above the board, bold.

Text uses Figtree, falling back to the system sans-serif. The SVG names the
font but doesn't embed it (it would triple the file); the PNG embeds it
while drawing, so it looks the same everywhere.

- **PNG**: 4× the diagram's size (about 680 × 580 pixels with the name),
  transparent wherever nothing is drawn.
- **SVG**: standalone, with `width`, `height` and `viewBox`, no CSS
  variables or classes.
- File names are the chord and the shape: `Am7 x-0-2-0-1-0.png`.

## What browsers allow

- Copying a PNG works in Chrome, Edge, Safari (iPhone too) and Firefox
  127+. The PNG is handed to the clipboard as a promise so Safari still
  counts the click as the gesture.
- Copying an SVG as an image works only where
  `ClipboardItem.supports('image/svg+xml')` (Chrome and Edge). Elsewhere
  Copy SVG copies the SVG code as text, which Figma, Illustrator and
  Inkscape paste as vectors, and says so.
- Downloads work everywhere; iPhone Safari offers to save the file.

## Out of scope

Exporting the neck or the arpeggio, a share sheet, PNG sizes, exporting
several shapes at once.
