# Frets

A guitar fretboard app, live at https://frets.eminor.net: tools for exploring
scales, chords and tab, and trainers for learning the neck.

Built with Next.js (static export), React, TypeScript and Tailwind CSS, styled
with the Fretwood design system (`src/styles/fretwood.css`). The original
design handoff (spec and prototypes) lives in `design_handoff/`; where it and
the specs in `docs/specs/` disagree, the specs win.

Tools:

- `/explore/scales` Scale lab: pick a root and a scale, see it on the neck and
  stack its chords.
- `/chords` Chords: look up a chord and every way to play it, or tap notes on
  the neck to name them.
- `/explore/triads` Triads: every inversion of a triad on three neighbouring
  strings, all the way up the neck.
- `/explore/circle` Circle of fifths: how keys and modes relate, with their
  chords, signatures and neighbours.
- `/tuner` Tuner: tune through the mic, on a dial or a strobe, and hear each
  string.
- `/metronome` Metronome: accents, groupings, subdivisions, swing and
  polyrhythms.
- `/tab` Tab: write a riff as tab and notation, play it back, and export it.

Practice:

- `/practice/intervals` Interval trainer: name the interval between two notes,
  or find it on the neck.
- `/practice/notes` Note trainer: name the note at a fret, or find a note on a
  string.

More: `/agents` has the guides, skills and MCP server that let agents write
chords and tab for Frets and open its tools in a chat.

Saved work and preferences persist in `localStorage`. The site deploys to
Cloudflare Pages (`DEPLOYMENT.md`), with one Pages Function for `/mcp`.

## Development

```bash
npm install
npm run dev        # Dev server at localhost:3000
npm run dev:https  # Same over https (self-signed), for the mic from another device
npm run build      # The MCP Apps, then the static export to out/
npm run lint       # ESLint
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run icons      # Re-render the icons after changing the mark's SVGs
npm run mcp:build  # The MCP Apps and the stdio server, to mcp/dist/
npm run mcp:preview  # A stand-in MCP host for the apps, at localhost:5174
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
- The MusicXML export is checked against the
  [MusicXML 4.0](https://github.com/w3c/musicxml) schema, W3C Music Notation
  Community Group, [W3C Community Final Specification Agreement](https://www.w3.org/community/about/agreements/final/).

See `NOTICE.md` for the details and the changes made.
