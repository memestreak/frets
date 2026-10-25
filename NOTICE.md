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

## alphaTex parser: alphaTab

The Tab page reads alphaTex with
[alphaTab](https://github.com/CoderLine/alphaTab) by Daniel Kuschny and
contributors (the npm package `@coderline/alphatab`, used unmodified),
under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/). Its
source is available from that repository. Frets uses its parser only;
Frets draws tab itself.
