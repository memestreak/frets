# Third-party material

Frets ships material made by others, under their licences.

## Chord shapes: Haus of Chords

`src/lib/chords/data/haus-of-chords.json` holds chord shapes from
[Haus of Chords](https://github.com/dersergioni/haus-of-chords) by
dersergioni, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
See `src/lib/chords/data/README.md`.

## Reference notes: tonejs-instruments

`public/sounds/` holds recordings of open strings from
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by
Nicholaus P. Brosowsky, whose samples are released under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). That project
credits their sources as:

| Folder | Instrument | Source |
|---|---|---|
| `acoustic/` | Acoustic guitar | [University of Iowa Electronic Music Studios](http://theremin.music.uiowa.edu/) |
| `nylon/` | Nylon-string guitar | [Freesound](https://freesound.org): 11573, quartertone, "classicalguitar-multisampled" |
| `electric/` | Electric guitar | [Karoryfer Samples](https://www.karoryfer.com/karoryfer-samples) |
| `piano/` | Piano | [VSCO 2 Community Edition](http://vis.versilstudios.net/vsco-community.html) |

Changes: each recording was cut to 3 seconds with a fade over the last 0.6,
mixed to mono and re-encoded as 96 kbps MP3. See `public/sounds/README.md`.
The acoustic set is also built into the tuner's MCP App (`mcp/dist/tuner.html`).

## alphaTex parser and synthesizer: alphaTab

The Tab page reads alphaTex with
[alphaTab](https://github.com/CoderLine/alphaTab) by Daniel Kuschny and
contributors (the npm package `@coderline/alphatab`, used unmodified),
under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/). Its
source is available from that repository. Frets uses its parser, and its
MIDI generator and synthesizer to play clips; Frets draws tab itself.

## Playback soundfont: SONiVOX EAS

`public/soundfont/sonivox.sf3` is the SONiVOX EAS General MIDI soundfont,
Copyright (c) 2004-2006 Sonic Network Inc., under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) (its
`LICENSE` is beside it). It comes unchanged from alphaTab's package, which
ships it from the [Android Open Source Project](https://android.googlesource.com/platform/external/sonivox/).
See `public/soundfont/README.md`.

## Piano: Salamander Grand Piano

`public/soundfont/piano-salamander.sf3` is made from the
[Salamander Grand Piano](https://github.com/sfzinstruments/SalamanderGrandPiano) by Alexander
Holm, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The samples were changed:
three velocity layers kept, mixed to mono, shortened with a fade, resampled and compressed
(`scripts/build-soundfonts.py`). See `public/soundfont/README.md`.

## Guitar: University of Iowa acoustic guitar, via tonejs-instruments

`public/soundfont/guitar-iowa.sf3` is an acoustic guitar from the
[University of Iowa Electronic Music Studios](https://theremin.music.uiowa.edu/)' Musical Instrument
Samples, as edited in [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by
Nicholaus P. Brosowsky, samples under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
Changed: shortened with a fade and compressed (`scripts/build-soundfonts.py`).

## Electric guitar: Karoryfer Samples, via tonejs-instruments

`public/soundfont/guitar-electric-karoryfer.sf3` is a clean electric guitar from
[Karoryfer Samples](https://www.karoryfer.com/karoryfer-samples), as edited in
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus P. Brosowsky,
samples under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Changed: compressed
(`scripts/build-soundfonts.py`).

## Notation symbols: Bravura, via VexFlow

`src/features/tab/smufl.ts` holds the outlines of a few music symbols (the
clef, note heads, accidentals, rests, flags and the bracket's ends) from the
[Bravura](https://github.com/steinbergmedia/bravura) font by Steinberg Media
Technologies GmbH, under the
[SIL Open Font License 1.1](https://openfontlicense.org) (its licence is
`src/features/tab/BRAVURA-LICENSE.txt`). They were taken from the outlines
packaged in [VexFlow](https://github.com/vexflow/vexflow) 4.2.5, Copyright (c)
2010 Mohit Muthanna Cheppudira, under the
[MIT License](https://opensource.org/licenses/MIT). Changes: each outline was
converted from VexFlow's units to SVG paths in staff spaces by
`scripts/smufl-glyphs.mjs`; no font file is shipped.

## MusicXML 4.0 schema: W3C Music Notation Community Group

`src/__tests__/tab/musicxml/` holds the MusicXML 4.0 XSD (`musicxml.xsd`,
`xml.xsd`, `xlink.xsd`) from [w3c/musicxml](https://github.com/w3c/musicxml),
Copyright © 2004-2021 the Contributors to the MusicXML Specification,
published under the
[W3C Community Final Specification Agreement](https://www.w3.org/community/about/agreements/final/).
The tests use it to check the Tab page's MusicXML export; it is not shipped
in the app. Changes: `musicxml.xsd`'s two `schemaLocation`s point at the
files beside it. See `src/__tests__/tab/musicxml/README.md`.
