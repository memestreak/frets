# Answer buttons on phones

Spec: `docs/specs/2026-10-05-answer-buttons-touch-design.md`.

1. `src/app/globals.css`: `.answer-btn` gets `flex-wrap: wrap; gap: 0`
   at every width (replacing the 500px wrap rule). A `max-width: 700px`
   block switches `.answer-grid` to `grid-auto-flow: row` with six columns
   and an 8px gap, and sets the button `min-height: 48px` and 16px / 15px
   labels.
2. Measure with Playwright at 320, 390, 700, 768 and 1280px in both
   trainers: no horizontal scroll, two rows at ≤700px, at least 44px wide
   at 390px.
3. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.
