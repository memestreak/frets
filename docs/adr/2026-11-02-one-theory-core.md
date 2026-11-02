# One music-theory core, the only importer of tonal

All music theory (notes, intervals, chord types and symbols, scales,
modes, keys, numerals) lives in `src/lib/theory/`, which is the only
place that imports tonal and knows nothing about the guitar. Before, it
lived in four places, two chord-symbol tables disagreed on five chords,
and Tab kept its own key and spelling. A page's theory goes in the core,
not in its feature.

See `docs/specs/2026-10-30-music-theory-core-design.md`.
