# Plan: entering notes from the staff (issue #136)

Spec: `docs/specs/2026-10-27-tab-staff-entry-design.md`.

1. `staffEntry.ts` (pure): a line or space's pitch in the key, stepping a line
   or space, `choosePlace` (free string, fret near the notes around),
   `toggleStaffNote` (Enter), `moveToString` (Alt+Up / Alt+Down), and where
   the cursor is drawn. Tests in `staffEntry.test.ts`.
2. `layout.ts`: `staffAt`, a press on the staff (a head, or a column's line or
   space, two ledger lines past it); `hitTest` answers for the tab only.
3. `TabClip.tsx`: `onPickStaff`, and the staff cursor drawn by `StaffCursor`
   (`StaffDrawing.tsx`) from `highlight.staffPitch`; no string box without a tab.
4. `TabPage.tsx`: `staffPitch`, set by a staff press and cleared by a tab press;
   its keys; Staff alone editable, its cursor shown on focus.
5. Chromium check of every key in Both and Staff alone, light and dark; PR.
