# Plan: edit alphaTex in the AlphaTex view (#126)

Spec: `docs/specs/2026-10-27-tab-alphatex-editing-design.md`.

1. `alphatexRead.ts`: return each alphaTab error's spot (`TextSpot`, string
   indexes converted from code points) beside the error lines.
2. `alphatexText.ts` (pure): `commentSpots`, `lineAt` and `lineMarks`.
3. `AlphaTexEditor.tsx`: a textarea over a mirror with a margin (numbers,
   ⚠) and underlines. Reading is debounced 500 ms, and the last keys are
   applied on unmount. The pointer finds underlines by their boxes and sets
   the textarea's `data-tip`.
4. `TabPage.tsx`: a `draft` (text and the clip it was typed against). The
   text is shown only while the clip is that clip, and cleared on changing
   view. `applyAlphaTex` dispatches `replace`.
5. `HoverTips`: restart when the `data-tip` text changes on the same
   element.
6. CSS in `globals.css`: `.tab-text-*`.
7. Tests: unit (`alphatexText.test.ts`) and page (live apply plus undo,
   errors, an unplaced error, leaving early).
8. Verify in Chromium at 1200 and 390 px, light and dark, with the hover tip.
