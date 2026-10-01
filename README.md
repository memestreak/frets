# Frets

Guitar-focused music theory practice: fretboard interval and note trainers.

Built with Next.js (static export), React, TypeScript and Tailwind CSS on top
of the Industry design system (`src/styles/industry.css`). The design handoff
(spec, prototypes and design-system source) lives in `design_handoff/`.

- `/intervals` — name the interval between two dots, or find the fret that
  completes a named interval.
- `/notes` — name a note, find it on a string, or find every occurrence in a
  fret range.

Settings and session stats persist in `localStorage`. Deploys as a static
site (`public/_redirects` sends `/` to `/intervals` on Cloudflare Pages).

## Development

```bash
npm install
npm run dev      # Dev server at localhost:3000
npm run build    # Static export to out/
npm run lint     # ESLint
npm test         # Vitest
```
