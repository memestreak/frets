# Plan: pick a technique mark on the tab (#128)

Spec: `docs/specs/2026-10-27-tab-pick-marks-design.md`.

1. `marks.ts`: the boxes of every drawn mark, `markAt` (a note number
   wins, then the smallest box), `markBox`, and `markTool`.
2. Move `previousSpots` from `TabClip.tsx` to `layout.ts`, so the boxes and
   the drawing agree on where a join starts.
3. `editing.ts`: `removeMark`.
4. `TabClip.tsx`: `onPickMark`, and the outline for a picked mark.
5. `TabPage.tsx`:
   - `picked` holds a word or a mark.
   - The pick moves the cursor and sets `columnOnly` for column marks.
   - Keys: Delete/Backspace, Esc, others.
   - The palette lights `markTool`, including the Bend, Vibrato and Tuplet
     buttons' own kinds.
   - A palette change keeps the mark picked.
   - `WordTools` without Edit.
6. Tests:
   - Unit (`marks.test.ts`): every mark found, its tool, Delete.
   - Page: outline, palette, Delete icon and key, Esc, undo, bend panel.
7. Verify in Chromium: every mark in the examples, light and dark.
