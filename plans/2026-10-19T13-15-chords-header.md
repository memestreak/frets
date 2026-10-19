# Chords page header

Jeremy, 2026-10-19. Spec: `docs/specs/2026-10-19-chords-header-design.md`.

1. Mocks A–E behind `?mock=` on a branch preview; Jeremy picked B (on the
   right, labelled from the top, level with the title).
2. Drop the mock code: `MOCKS`, `MockBar`, the other layouts and the
   switcher's CSS.
3. `ChordHeader`: name and notes on the left, controls on the right,
   top-aligned.
4. `ChordPickers`: Root and Type labelled from the top, Type a real
   `<label>` for the dropdown or search box; Clear passed in as `after`.
5. Update the key picker and one-chords-page specs and CLAUDE.md.
6. Check in the browser at 1280px, 1024px and 390px, both themes, with the
   search box open and with no chord.
