# Tuner

Jeremy, 2026-10-17. A guitar tuner, through the microphone, in a modal.
It starts on the Note trainer; it is built to go in the app's header
later, and its strobe and string reading are parts a small tuner embedded
in the page can reuse.

## What the user sees

- **Opening:** T, or the **Tuner** button (with a T keycap) in the Note
  trainer's header beside Settings, in either mode. T or Esc closes it, as
  does the close button or a click on the backdrop.
- **The mic:** opening the tuner turns the mic on; closing it puts the
  Mic button back as it was, and the saved choice never changes. While
  the tuner is open the quiz judges nothing and doesn't auto-advance. If
  the mic won't start, the tuner says why, in the Mic button's words.
- **Reading:** the string's note large with its octave ("A₂") and how far
  off: "Play a string", "30¢ flat", "8¢ sharp", or "In tune" within ±5
  cents, when the note and the words turn green.
- **Strobe:** a band of stripes that drift right when sharp and left when
  flat, faster the further off (2 px a second per cent, no faster past
  50), and stand still in tune. Faded and still when nothing is heard.
- **Strings:** E₂ A₂ D₃ G₃ B₃ E₄, low E first. The tuner follows the open
  string nearest the note heard, outlined; tapping a string locks it
  (pressed) and measures against it, however far off; tapping it again
  goes back to following. A line under them says which.
- **Reference notes:** ▶ under each string plays it: a synthesized pluck,
  about two seconds, dying away like a string. The mic would hear it
  through the speakers, so the tuner ignores the mic until it and its
  echo have died away.
- Standard tuning at A440 only, nothing to set. Nothing moves as the
  readings change.

## How

- `MicReading.pitch`: the fractional MIDI note the detector heard. The
  tuner steadies it with the median of the last five readings and keeps
  the last one up for 400 ms after the note stops.
- `useMic` takes `borrowed`: true listens whatever the choice, false goes
  back to it, saving nothing.
- The reference pluck adds up seven overtones from exact sines, each dying
  away, the higher ones faster, so it is exactly in tune.
- `Modal`: the native-`<dialog>` shell the Settings dialog used, now
  shared by both. It focuses the dialog itself on opening, not its close
  button, so no focus ring shows until the user tabs.
