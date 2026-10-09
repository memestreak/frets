# Chord library: space toggles the arpeggio

Jeremy, 2026-10-09: space should toggle the Arpeggio view, and with a
shape chosen it should go back and forth between that shape and the
arpeggio. Spec: `docs/specs/2026-10-06-chord-arpeggio-design.md`.

1. `ChordLibrary` already keeps `selectedKey` while the arpeggio is on
   (only `index` ignores it), so turning the arpeggio off brings the shape
   back. The Arpeggio button becomes a toggle (`toggleArpeggio`) instead of
   only turning it on.
2. New hook `library/useSpaceKey.ts`: a window keydown listener for a bare
   space, skipped in `input, select, textarea, nav, footer`. It prevents the
   default (page scroll; a focused button's click), ignores `repeat`, and
   also prevents the keyup default, since some browsers click a focused
   button on keyup.
3. Tests in `ChordLibrary.test.tsx`: button and space swap shape and
   arpeggio and back; space on a focused shape doesn't click it; a held key
   toggles once; space in a chord menu is left alone. The old "pressing it
   again keeps it" check goes.

Checked in Chromium (Playwright, dev server): click shape 2, space, space
returns to shape 2; space on the focused Arpeggio button toggles once;
space in the Root menu doesn't toggle.

The Scale lab's Arpeggio toggle is left as is: its card has its own
selection model, and Jeremy asked about the library.
