# Scale lab header

Jeremy, 2026-10-19. Spec: `docs/specs/2026-10-19-scale-lab-header-design.md`.

1. Mocks A–E behind `?mock=` on a branch preview; Jeremy picked B (pickers
   beside a narrower strip), then asked for them in the strip's row, the
   dropdown top-aligned with the picker, and the labels closer.
2. Drop the mock code: `MOCKS`, `MockBar`, the other layouts and their CSS.
3. `ScalePickers` returns the four cells (labels and controls apart);
   `ScaleLab`'s header is `.scale-head`, a grid placing them with the title
   and strip.
4. `.scale-head` in `globals.css`: one column below 1180px, two rows above.
5. Update the Scale lab and key picker specs.
6. Check in the browser at 1280px, 1024px and 390px, both themes, and that
   a rotation moves nothing.
