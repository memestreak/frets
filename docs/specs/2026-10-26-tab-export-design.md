# Tab: export options

Part of PR 3 of `2026-10-24-tab-editor-design.md` (images). Jeremy asked on
2026-10-26 for an "Export options" dialog on the Tab page, "something like
what we have for chords" (`2026-10-15-copy-chord-diagram-design.md`,
`2026-10-17-export-size-design.md`).

## Copying and the dialog

The tab's right-click menu first held **Copy as PNG** and **Export
options…**. Once the copy button and the header button did both, Jeremy
dropped them from it (2026-10-26); the menu now only inserts bars
(`2026-10-25-tab-editing-design.md`).

Every view has a copy button at its top right: the ASCII and alphaTex views
copy their text, and the Tab view copies the PNG, with the saved choices
(the line under the clip says "Copied as PNG.") (Jeremy, 2026-10-26: "a copy to clipboard button
(like the ASCII view has) for the primary view"). The view switch, Standard |
ASCII Tab | AlphaTex (Jeremy's names, 2026-10-27; they had been Tab | ASCII | alphaTex), sits just left of it in a strip at the card's top right,
above the clip (Jeremy, 2026-10-27, issue #127; the switch had been in the
page header, and the tab had been drawn 48px narrower to clear the button).
The playback toggle and controls show only on the Tab view; leaving it stops
playback.

## The Export options button

The header's **Download** button became **Export options** (first written
"Export…"; Jeremy renamed it the same day), which opens the same
dialog (Jeremy, 2026-10-26: one way to do a thing). The text downloads it
used to make moved into the dialog, so nothing is lost.

## The dialog

It follows the Chords page's Export dialog:

- **Preview:** the image as it will be, on white, shrunk to fit.
- **Size line:** the image's size in pixels under the preview, and whether
  it is transparent or on white.
- **Choices,** each saved:
  - **Size (px wide):** 480, 640, 800, 1000 or 1200 (default 800). This is
    the image's width. The tab wraps onto more lines to fit it, so a
    narrower image is taller.
  - **Transparent:** Off (default, white behind the tab) or On.
  - **Clip name:** Show (default) or Hide, above the tab.
  - **Name:** what the title says. It starts as the clip's name and can be
    changed for this export only.
- **Actions:** Copy PNG, Copy SVG, Download PNG, Download SVG. Under them,
  "As text": Download alphaTex (`<name>.alphatex.txt`) and Download ASCII
  (`<name>.txt`). A line says what happened. It stays open after an action; Done, × or Esc close
  it.

The Chords dialog's Colours and Intervals choices have no meaning for tab,
so they are left out. The image is black ink, as the chords' black and
white is.

## Drawing

The image is the page's own `TabClip` at the chosen width less 16px of
padding each side, drawn in black, with the name above it in Figtree bold.
The string lines now stop short of every note's number through an SVG
mask, instead of a box painted the card's colour behind the number. A
transparent image then shows nothing behind the numbers, and on the page
the cursor's band shows through them too.

## Code

- `exportTab.tsx`: the style and its parser (`frets.tab.export`), `TabImage`
  (the image as a component; the preview draws it too), `tabSvg` and
  `tabFileName`.
- `TabExportDialog.tsx`: the dialog.
- The chord export code now shares a few helpers with the Tab page:
  - `copySvgAsPng`, `copySvgCode` and `downloadSvg` in `exportImage.ts`
    work on any SVG;
  - `useMenuTrigger.ts` handles right-click, a long press and Shift+F10 for
    both pages;
  - `ShapeMenu` draws the menu on both pages.

## Later

- Dragging the clip out as an image (PR 3's ⠿ grip).
