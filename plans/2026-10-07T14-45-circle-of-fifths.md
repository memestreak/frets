# Circle of fifths

Jeremy, 2026-10-07: Key wheel and Modes on one page, Key | Mode switch.
Spec: docs/specs/2026-10-07-circle-of-fifths-design.md.

1. `theory.ts`: export `transposeNote` and `chromaOf` (thin tonal
   wrappers) so `circle.ts` needs no tonal import.
2. `circle.ts`: spokes, cell roots and names, key signatures, numerals
   against a tonic, `keyWheel` and `modeWheel` models.
3. `CircleWheel.tsx` (SVG), `HoverTips.tsx`, `KeyPanel.tsx`,
   `ModePanel.tsx`, `CircleOfFifths.tsx`; wheel and panel CSS in
   `globals.css`.
4. Route `/explore/circle`, client-only loader, `sections.ts` entry.
5. Tests: `circle.test.ts` (signatures, numerals, D major and A minor
   wedges, borrowed chords, V/x, C Dorian wedge and signature chord,
   relative and parallel modes); `CircleOfFifths.test.tsx` (view from
   URL, picking keys, checkboxes, mode rows, switch keeps the root).
6. Lint, typecheck, test, build; screenshots; CLAUDE.md.
