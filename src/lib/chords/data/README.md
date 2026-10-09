# Chord shape data

`haus-of-chords.json` holds the chord shapes the Chord library, the Chord
lab and the Scale lab show first. It is converted from the chord data of
[Haus of Chords](https://github.com/dersergioni/haus-of-chords) by
dersergioni, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The app footer
carries the credit.

Changes made in converting: the finger letters and the citations are left
out; each shape keeps its count of independent sources; only the shapes
that at least two independent sources publish (or that the author kept)
are included; chord types are keyed by Frets' type ids. The commit it was
converted from is in the file.

Every shape in Haus of Chords is cited from published teaching sources, so
corrections go upstream, with a link to a source, and then come here by
re-running the import:

```sh
git clone https://github.com/dersergioni/haus-of-chords /tmp/haus-of-chords
uv run --no-project scripts/import-haus-of-chords.py /tmp/haus-of-chords
```

`src/__tests__/chords/publishedShapes.test.ts` checks every shape against
Frets' own chord spelling, so a bad import fails the tests.
