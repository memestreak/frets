# Tab: export and copy chords as the Chords page does

Issue [#531](https://github.com/memestreak/frets/issues/531). Asked
2026-11-21 (Jeremy): "Add the same export and copy options from our chord
page to the chords of the tab page. This probably means refactoring some
things to make sharing easier." Selected bars exporting the same way is a
separate request ([#532](https://github.com/memestreak/frets/issues/532)),
built on this one.

The Chords page's export is `docs/specs/2026-10-15-copy-chord-diagram-design.md`
(the menu, the Export dialog, the image) and
`docs/specs/2026-10-17-export-size-design.md` (size and transparency). This
spec says only where the Tab page differs.

## What

- **Where.** Every chord of the Tab page that draws a diagram:
  - a Chord set tile in the Chords palette;
  - a chord of the Chord chart under the score head;
  - a chord name over the music, once picked (its right-click menu).
- **The menu.** Each already had a menu of its own (right-click, a long
  press, Shift+F10). After the page's own items it gains the Chords page's
  two, with the same labels: **Copy as PNG** and **Export options…**. On a
  tile, Delete (an unused chord's) stays last, after them. So:
  - tile: Insert, Edit, Rename, Copy to new chord, Copy as PNG, Export
    options…, Delete (when unused);
  - Chord chart chord: Edit, Copy as PNG, Export options…;
  - chord name: Edit, Copy as PNG, Export options…, Delete.
- **Only a chord with a diagram.** A chord whose definition has no shape
  (a name only typed over a column, "N.C."), or a shape no chord can be
  drawn with, has no diagram on the page, so its menu has no export items.
- **The image.** The Chords page's own: `ChordDiagram` with the Export
  dialog's choices (Colours, Size, Background, Intervals, Chord name,
  Name), not the Tab page's plain upright book diagram. It is drawn on the
  chord's track's tuning (a Chord chart chord: its own track's), as the
  tile is, so on drop D the low string's open D is the D chord's root, and
  Degree colours and Intervals follow that tuning. Frets count from the
  capo, as the Chord set's shapes do.
- **Name.** The Export dialog's Name starts on the chord's name in the
  Chord set ("Am7", "C/G"), editable for that export as on the Chords page.
- **The dialog's title.** "Export G, root on D · frets 2–5": the shape's
  lowest string is named by the track's tuning (D on drop D), E A D G B e
  in standard tuning.
- **Saved choices.** The Chords page's (`frets.chords.export`): one set of
  export choices across the Chords page, the Scale lab and the Tab page.
- **Notice.** "Copied as PNG" (or why it couldn't) shows as on the Chords
  page.

## Tests

- A tile's menu: Insert, Edit, Rename, Copy to new chord, Copy as PNG,
  Export options…, then Delete for an unused chord.
- A tile with no shape (a name only typed): no export items.
- Copy as PNG copies the chord with its own shape, low string first, on the
  track's tuning (drop D: lowest string D), named as the set names it, with
  the saved choices; the notice says "Copied as PNG".
- Export options… opens the Export dialog titled "Export G, root on D ·
  frets 2–5" on drop D, its Name "G"; Done closes it.
- A Chord chart chord's menu: Edit, Copy as PNG, Export options…; its copy
  is drawn on its track's tuning.
- A chord name's menu with a diagram: Edit, Copy as PNG, Export options…,
  Delete; without one: Edit, Delete.
- The image colours a dot by its tone on the given tuning: D7's low-string
  10th fret is its root in standard tuning, its ♭7 on drop D.
- No export for a shape with no notes, or a name with no definition.

## How

- `src/components/chords/export/useShapeExport.tsx` (shared) also returns
  `exportItems(shape)`, the two items for a page that opens its own menu,
  and exports their labels (`COPY_AS_PNG`, `EXPORT_OPTIONS`) so every menu
  that exports, the Tab page's bar menu too (#532), reads the same.
- `ExportShape` takes an optional `tuning`, passed to `ChordDiagram` by
  the image, the dialog's preview and the drag cache's key;
  `shapeCaption` takes it too.
- `src/features/tab/chordShapes.ts` `exportShapeOf(part, name)`: a chord of
  the set as `ExportShape`, or null without a diagram.
- `TabPage` calls `useShapeExport` once and hands `exportItems` to
  `ChordPanel` and `ChordChart`, and adds them to a picked chord name's menu.

## Not yet

- **Dragging a tile out as its PNG**, as a Chords page shape drags out. A
  tile's press keeps the tab's focus (and so its cursor and Insert) by
  cancelling the mouse press, and a cancelled press can't start a drag.
  Doing it means letting the tile take the focus and handing it back, a
  change to how the palette's presses work; a follow-up if wanted.
- Exporting the Tab page's own plain upright diagram (the book look) as an
  option of the dialog.
