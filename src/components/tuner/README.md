# Mic and tuner (`src/components/tuner/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/components/tuner/` — the mic and the tuner, shared by the Note
  trainer and the Tuner page: `pitch.ts` (pure YIN detector, note names),
  `hold.ts` (pure: a note held since its onset, and how long counts),
  `listener.ts` (`MicListener`: getUserMedia, an analyser and a loop
  publishing readings outside React; `MicStatus` and the error words),
  `tuner.ts` (pure: nearest string, cents, strobe step), `pluck.ts` (the
  simulated string), `sounds.ts` (the recorded sets in `public/sounds/`
  and each one's measured tuning), `reference.ts` (plays a reference
  note; `referenceSounding` so the mic ignores it), `useTunerPitch.ts`,
  `settings.ts` (meter and sound, saved), `Dial.tsx`, `Strobe.tsx` and
  `TunerPanel.tsx` (switch, meter, reading, strings). The page itself is
  `src/features/tuner/TunerPage.tsx`, with its own mic.
