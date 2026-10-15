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
