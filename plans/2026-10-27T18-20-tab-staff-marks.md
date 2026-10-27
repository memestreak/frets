# Plan: technique marks on the notation staff (finishing issue #122)

Spec: `docs/specs/2026-10-27-tab-notation-design.md`, "Technique marks on the staff".

1. `staffGeometry.ts`: move the bar's head, stem and beam geometry out of
   `StaffDrawing.tsx` so marks are placed by the same numbers; `previousHeads`
   moves with it. `PlacedBar` carries its beat.
2. `staffMarks.ts`: accents, staccato, vibrato, tremolo, slurs, slides, ties,
   tuplet numbers; bends and taps with the staff alone. Each with its box and a
   `MarkHit` marked `on: 'staff'`.
3. `StaffDrawing.tsx` draws them; diamond, × and bracketed heads; no 8 under the
   clef.
4. `layout.ts`: vibrato and accent rows only for the tab alone; strokes, P.M.,
   let ring and P.H. rows with the staff too; room past the staff for its marks.
   `TabClip.tsx` draws those rows under the staff alone.
5. `marks.ts`: the staff's boxes; tab-only boxes only where the tab draws them;
   `markBox` outlines where it was pressed; a press on a head is the note.
6. Tests (`staffMarks.test.ts`), Chromium check on the examples, PR.
