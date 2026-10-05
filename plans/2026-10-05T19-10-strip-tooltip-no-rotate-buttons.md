# Strip note tooltip instead of Rotate mode buttons

Spec: `docs/specs/2026-10-04-scale-lab-design.md` (Page 1–2, Rules: Rotate mode).

1. `ScalePanel.tsx`: drop the ‹ › Rotate mode group and its props; Reset
   moves up into the pickers row, `max-[480px]:hidden` while not rotated.
   Remove the now unused chevron icons and `.mode-steps` CSS.
2. `ScaleLab.tsx`: drop `rotate` and `modes`; the strip is tappable when
   `modeFamily(picked)` exists.
3. `StripTip.tsx`: wraps the strip; native `pointerover` / `focusin`
   listeners on the wrapper show a tooltip above a `.tap` note (mouse or
   pen, or keyboard focus), built from the note's `aria-label` plus the
   relative-mode line, after a 1s rest for the mouse (none once one is up,
   none for focus); it hides on leave, blur and when the shown scale
   changes. A `.strip-touch-hint` line shows under `(hover: none)`.
4. `ChordLadder.tsx`: drop the SVG `<title>` so the native tooltip does
   not double up.
5. Tests: rotation by tapping; tooltip on mouse hover, not touch; no hint
   for a pentatonic.
6. Lint, typecheck, tests, build; screenshots at 1280 and 390px, light and
   dark, hovered and rotated.
