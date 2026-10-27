# Frets

Guitar-focused music theory practice: fretboard interval and note trainers.

Built with Next.js (static export), React, TypeScript and Tailwind CSS on top
of the Industry design system (`src/styles/industry.css`). The design handoff
(spec, prototypes and design-system source) lives in `design_handoff/`.

- `/intervals` — name the interval between two dots, or find the fret that
  completes a named interval.
- `/notes` — name the note at a shown position, or find a named note on one
  string.

Settings and session stats persist in `localStorage`. Deploys as a static
site (`public/_redirects` sends `/` to `/intervals` on Cloudflare Pages).

## Development

```bash
npm install
npm run dev      # Dev server at localhost:3000
npm run build    # Static export to out/
npm run lint     # ESLint
npm test         # Vitest
npm run typecheck  # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) runs lint, tests, the build and the type
check on every pull request and every push to `main`.

## Credits

- Chord shapes from
  [Haus of Chords](https://github.com/dersergioni/haus-of-chords) by
  dersergioni, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Reference notes from
  [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments),
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- alphaTex is read, and clips are played, with
  [alphaTab](https://github.com/CoderLine/alphaTab),
  [MPL 2.0](https://mozilla.org/MPL/2.0/).
- Playback sounds from the SONiVOX EAS soundfont, Sonic Network Inc.,
  [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- The piano from the [Salamander Grand Piano](https://github.com/sfzinstruments/SalamanderGrandPiano),
  Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- The steel guitar from the University of Iowa Electronic Music Studios and the clean electric
  guitar from [Karoryfer Samples](https://www.karoryfer.com/karoryfer-samples), both via
  [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments),
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Notation symbols from the [Bravura](https://github.com/steinbergmedia/bravura)
  font, Steinberg Media Technologies GmbH,
  [SIL OFL 1.1](https://openfontlicense.org), as packaged in
  [VexFlow](https://github.com/vexflow/vexflow), [MIT](https://opensource.org/licenses/MIT).

See `NOTICE.md` for the details and the changes made.
