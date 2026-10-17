# Note trainer: answer Find it by playing

Jeremy, 2026-10-17. In the Note trainer's Find it, the user can play the
asked note on a real guitar and the microphone checks it, beside tapping
the board, which keeps working.

## What the user sees

- In Find it the answer card has a **Mic** button beside Skip. Off, it
  reads "Mic". On, it is pressed and shows, in the same fixed-size button,
  the note it hears with its octave ("A₂", "–" in silence) and a small
  level meter. Turning it on or off, and every reading, moves nothing.
- Name it has no Mic button.
- The first press asks the browser for the microphone. Refused, missing,
  or on a page that is not https (or localhost), the button stays off and
  the card's instruction ("Tap a fret on the board") gives way to why:
  "Mic blocked — allow it in the site settings", "No microphone found",
  "The mic needs https", until the next press.
- The choice is remembered with the trainer's settings. Coming back with
  it on, listening starts by itself if the browser still grants the mic;
  otherwise the button shows off until pressed.

## What counts

The mic hears a pitch, not a string. Find it names a string and a fret
range, so the trainer knows the exact pitch it wants: the asked note on
that string within the range (two pitches an octave apart when the range
holds it twice). A played pitch is placed on the asked string at the fret
that sounds it, when there is one (0–15).

| Played | Result |
|---|---|
| The asked pitch | Correct, as if that fret were tapped; the found dot is drawn there |
| The asked note on the asked string, outside the range | Explained, not scored, as a tap there ("Right note, but outside your range") |
| The asked note in an octave the string can't play (0–15) | Explained, not scored: "Right note, wrong octave — look in frets a–b on the X string" |
| Another note | A miss, as a tap: ✕ on the asked string where that pitch sits, if it does; feedback "That's G — try again" |

A note counts once it has held steadily: 150 ms for the right pitch,
250 ms for anything else, so the pluck's attack and stray sounds don't
count. A note is judged once: the same note still ringing into the next
question is ignored until it is played again (silence, a new pitch, or a
fresh pluck). While a question is answered or Settings is open the mic
judges nothing.

A setting, **Mic: wrong notes count as misses** (on by default), turned off
makes wrong notes show only in the live readout: the mic can then only
mark an answer right or explain it.

Not in this version: Name it by playing, the Interval trainer (the
listening parts are shared practice code so its Find it can use them
later), a tuner's cents needle.

## How

- Pitch: a YIN detector over the analyser's 4096-sample window, 75–1100 Hz
  (low E is 82 Hz; fret 15 on the high e is 784 Hz), with the browser's
  echo cancellation, noise suppression and auto gain turned off. All in
  the browser; no server, no library.
- Live readings update only the Mic button, so the board does not redraw
  thirty times a second.
- Testing locally: `http://localhost:3000` is a secure context; from
  another device use `npm run dev:https` (`next dev --experimental-https`,
  a self-signed certificate to click through once).
