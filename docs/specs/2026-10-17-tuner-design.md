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
- **Strings:** a column down the left, high e at the top and low E at the
  bottom, as on the board, each labelled with its note (E₄ … E₂). The
  tuner measures against the open string nearest the note heard, and
  lights that string's button. There is no locking a string.
- **Reference notes:** pressing a string plays it, in the sound chosen in
  the tuner itself, a "Reference sound" dropdown above the
  strings: Acoustic guitar (the default), Nylon-string guitar,
  Electric guitar, Piano, or Simulated string. The choice is saved with
  the Note trainer's settings, but is not in its Settings dialog, whose
  Defaults leave it alone; pressing a string is its preview. Notes ring on together, as strings do:
  a second press never cuts off the first. The recordings come from
  tonejs-instruments (CC BY 3.0), credited in `NOTICE.md` and the footer;
  each recording's own tuning was measured and is corrected in playback,
  so every reference note is in tune. A set's recordings are fetched when
  the tuner opens. The mic would hear the note through the speakers, so
  the tuner ignores it from the press until the note and its echo have
  died away.
- Standard tuning at A440 only, nothing to set. Nothing moves as the
  readings change.

## How

- `MicReading.pitch`: the fractional MIDI note the detector heard. The
  tuner steadies it with the median of the last five readings and keeps
  the last one up for 400 ms after the note stops.
- `useMic` takes `borrowed`: true listens whatever the choice, false goes
  back to it, saving nothing.
- The reference pluck is a simulated string (Karplus-Strong, as extended
  by Jaffe and Smith): a noise burst notched where the pick strikes
  circulates in a loop one period long, losing its highs on each pass,
  then sounds through three body resonances. An allpass tunes the loop's
  fractional length, so each string is within a tenth of a cent.
- `Modal`: the native-`<dialog>` shell the Settings dialog used, now
  shared by both. It focuses the dialog itself on opening, not its close
  button, so no focus ring shows until the user tabs.
