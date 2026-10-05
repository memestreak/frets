# Scale formula below the name

Spec: `docs/specs/2026-10-04-scale-lab-design.md` (Page, 1. Title).

1. `ScaleLab.tsx`: wrap the `h1` and a new `<p data-testid="scale-formula">`
   in one `aria-live="polite"` block; the formula leaves the heading and
   drops its parentheses. The block stays the first item of the header's
   flex row, so the dropdowns and Rotate mode keep their place.
2. `ScaleLab.test.tsx`: the heading is the name alone; the formula is its
   own element with no parentheses.
3. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`;
   before/after screenshots at 1280 and 390px, light and dark.
