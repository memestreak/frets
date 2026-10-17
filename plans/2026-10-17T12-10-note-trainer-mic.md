# Note trainer mic

Jeremy, 2026-10-17. Spec: `docs/specs/2026-10-17-note-trainer-mic-design.md`.

1. `src/features/practice/mic/pitch.ts` (pure): `detectPitch` (YIN with
   parabolic interpolation), `rms`, `freqToMidi`, `levelOf`, `pitchLabel`.
2. `mic/hold.ts` (pure): `trackHold`, a note held since its onset; a new
   pitch, a gap longer than the dropout allowance or a jump in level
   starts a new one.
3. `mic/listener.ts`: `MicListener` (getUserMedia with processing off,
   AnalyserNode, a throttled animation-frame loop, subscribe for readings,
   `micError` for the failure kinds); `micGranted` asks the Permissions
   API.
4. `mic/useMic.ts`: owns a listener for a trainer; starts and stops it,
   reports status, calls back with each steady note once per onset.
   `mic/MicButton.tsx`: the fixed-size toggle with the live note and meter.
5. Shared reducer: `answerPitch` (place the pitch, then correct, out of
   range, wrong octave, or a miss when misses count), state `heard` and
   `octaveLast`; rules gain optional `placePitch` and `rightPitch`.
   `attemptFeedback` gains the octave and "That's G" lines.
6. Notes: `mic` and `micMisses` settings (parsed, Defaults keeps `mic`),
   `placeNotePitch`, the Mic button in the Find it card, the setting in the
   dialog.
7. `npm run dev:https`.
8. Tests: pitch on synthetic tones (low E to fret 15 high e, silence,
   noise), hold tracking, the reducer's pitch cases, settings parsing, the
   trainer with a fake listener.
9. CLAUDE.md: the mic folder, the spec, the storage fields.
