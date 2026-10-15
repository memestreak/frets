# Copy a chord diagram

Jeremy, 2026-10-15. Spec: `docs/specs/2026-10-15-copy-chord-diagram-design.md`.

1. `ChordDiagram` takes an optional `look` (line, nut, muted and text
   colours, a tone's dot colour, interval labels, a title). Its default is
   today's CSS-variable look, so the pages don't change. The title adds a
   band above the board.
2. `src/features/chords/export/exportStyle.ts` (pure): `ExportStyle`, its
   defaults, parser and storage key, the concrete palettes (copied from
   `fretwood.css`; a test checks they match) and `exportLook(style)`.
3. `exportImage.ts`: `diagramSvg` renders `ChordDiagram` with that look into
   a detached root (`createRoot` + `flushSync`) and returns standalone
   markup; `svgToPng` draws it at 4× with Figtree embedded; `copyPng`,
   `copySvg`, `download`; `exportFileName`.
4. `ExportDialog.tsx`: native `<dialog>`, preview, four segmented choices,
   four actions and a status line; choices saved with `usePersist`.
5. `ShapeMenu.tsx` and `useShapeMenu`: the right-click / long-press /
   Shift+F10 menu, Copy as PNG and Export options…, positioned at the
   pointer or under the diagram, closing on Esc, outside press and scroll.
6. `VoicingGroups` wires both onto every shape button, for both pages.
7. Tests: the look and palettes, the SVG (colours, labels, title, no CSS
   variables), the menu opening without selecting, the dialog defaults and
   saved choices, Copy PNG calling the clipboard.
8. CLAUDE.md: the new files, the storage key, the spec.

Follow-up (Jeremy, 2026-10-15, after it merged): export from the Chord
lab's neck, and an editable name.

9. `ExportShape` (chord, voicing, name) replaces the chord and voicing
   arguments; `exportLook` takes the name. `ChordDiagram` draws more than
   `DIAGRAM_FRETS` frets for a shape that reaches further.
10. `useShapeExport` moves up to the pages: the library and the lab call
    it once and hand `exportProps` to `VoicingGroups`; the lab also spreads
    it on the neck's wrapper, with the chosen name. The dialog's Name field
    starts on the deduced name for each shape opened.
11. Tests: the name printed or left out, the wide shape, the file name, the
    dialog's field, and the lab's neck (copies the played shape, names it as
    Name it does, offers nothing when muted).
