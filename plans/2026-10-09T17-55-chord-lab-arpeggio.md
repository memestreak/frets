# Chord lab: remove Build it, add Arpeggio

Jeremy, 2026-10-09. Spec: `docs/specs/2026-10-09-chord-lab-arpeggio-design.md`.

1. Delete `lab/ToneChips.tsx`, `toggleTone` and the notice state in
   `ChordLab`, the `.tone-chip` CSS and `plainToneLabel` (its only user).
   The left column keeps `VoicingGroups`; drop its `showKey` prop so both
   pages show `ToneKey`.
2. Move `library/useSpaceKey.ts` to `features/chords/`; move the library's
   caption text into `arpeggioCaption.ts` for both pages.
3. `ChordLab` gains `arpeggio` state. `play` (taps, shapes, Clear) turns it
   off; `setNameIndex` doesn't. `toggleArpeggio` is a no-op with nothing on
   the neck. Dots come from `arpeggioDots` while on; `selectedKey` is null.
4. Neck card: the hint moves below the board, next to the Arpeggio button,
   and shows the arpeggio caption while on.
5. Tests: chip tests go; new ones for button and space, a name change
   keeping it on, a tap or shape turning it off, disabled when cleared.
6. Update the lab spec, the arpeggio spec's paths, the `sections.ts`
   summary and CLAUDE.md.
