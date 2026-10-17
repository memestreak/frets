# Tuner page

Jeremy, 2026-10-17. The tuner gets its own page at `/tuner`, and a new
look that the Note trainer's tuner (`2026-10-17-tuner-design.md`) shares.
Picked from three mocks: A, the dial, with a strobe to switch to.

## What the user sees

- **Where:** Tuner is a top-level section with no pages, so it is a page
  itself, as Chords is: last on the home page (its card with a tuner
  icon), last in the menu, and in the breadcrumbs. The Note trainer keeps
  its tuner on T and the Tuner button, now drawn the same way.
- **The page:** one card, "Tuner" and "Standard tuning · A440" at the top
  with the reference sound beside them; then a Dial / Strobe switch, the
  meter, the note and how far off, and the strings in a row.
- **Dial:** a half-circle gauge from −50 to +50 cents, ticks every 5 and
  labels at ±25 and ±50, ♭ and ♯ at the ends. A needle points at the
  cents heard (pinned at the ends past 50), resting upright and faded when
  nothing is heard. A zone ±5 cents round the top is faint green, solid
  when in tune, when the needle turns green too.
- **Strobe:** three bands of stripes on a rosewood face, in the dial's box.
  They drift right when sharp and left when flat, the finer bands faster
  (1×, 2×, 4× the strobe speed in the first tuner's spec), and stand still
  in tune, when they turn gold. Still and faded when nothing is heard.
- **Reading:** the string's note large (its letter, the octave small
  beside it) and the words under it, as before: "Play a string", "20¢
  flat", "In tune" (green, as is the note). A dash when nothing is heard.
- **Strings:** six round buttons, low E on the left to high e on the
  right, each its note with the octave. The string heard is filled with
  the primary colour, green in tune. Pressing one plays its reference note.
- **Remembered:** the meter and the reference sound, for both the page
  and the trainer's tuner (one choice for the two).
- **The mic** listens for as long as the page is open, from the moment it
  opens (the browser asks the first time). If it won't start, the words
  under the note say why.
- Nothing moves as the readings change or the meter switches: the meter,
  the note and the words each keep a fixed size. Fits a phone at 360 px.

## How

- The tuner's parts move out of `features/practice/mic/` into
  `src/components/tuner/`, since two sections now use them: the listener
  (with `MicStatus` and the error words), the detector, hold tracking, the
  tuner maths, the reference sounds, `useTunerPitch`, and the new
  `TunerPanel` (switch, meter, reading, strings), `Dial` and `Strobe`.
  `useMic`, `MicButton` and `TunerDialog` stay with the trainer.
- `localStorage["frets.tuner.settings"]` holds `{ meter, sound }`, parsed
  field by field. The reference sound leaves the Note trainer's settings.
- `TunerDialog` is `Modal` round `TunerPanel`; the page is a card round it
  with its own `MicListener`, started on mount and stopped on unmount.
