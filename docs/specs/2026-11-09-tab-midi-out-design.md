# Tab: playback out over MIDI (issue #457)

Jeremy, 2026-11-09: "The consumer I would like to send the MIDI to is a web application that I wrote
called fmlab … having a frets tab arrangement send its MIDI output to the FMLAB synthesizer."

When Tab plays, it can send the notes as live MIDI to an output port picked in Settings (on macOS,
the IAC Driver bus), through Web MIDI. fmlab, or any MIDI app, listens on the same port. A direct
link to fmlab (`postMessage` or `BroadcastChannel`) is a later option, not this one.

He answered ten questions in a commentable page (https://claude.ai/artifact/PwrLnkHYWwHTfjHXqXX9RB);
the Q numbers below are its.

## What goes out

- **Playback only** (Q8): Play, loops, the count-in's bars and Tap all send. A note heard as it is
  entered, or a chord picked in the Chords panel, plays in the built-in sound only.
- **Notes, pitch bends and controllers**, as alphaTab plays them. Bends, slides and vibrato go out
  as pitch bend (Q4). alphaTab writes bends for a 16-semitone range; Frets scales each to the
  receiver's **Pitch bend range** (Settings, 1 to 24 semitones, default 2, MIDI's own default that
  most synths keep), so a whole step bends a whole step; a bend past that range stops at its end.
  At each Play, every channel used first gets that range as the standard message (RPN 0: CC 101 0,
  CC 100 0, CC 6 <range>, CC 38 0, then RPN null), and its pitch bend centred. alphaTab's own RPN
  and data entry (CC 100, 101, 6, 38) are not sent. Jeremy, 2026-11-09: fmlab barely bent at 16,
  so a receiver that ignores RPN 0 must be matched by the setting.
- **No program or bank changes** (Q9): the footer's Sound picks the built-in sound only; the
  synth's patch is set in the synth.
- **The clicks stay in Tab** (Q3): the metronome's and the count-in's channels never go out.
- **No MIDI clock, Start or Stop** (Q5); they come in a later PR.
- **Transpose applies** (Q10): the notes go out at the pitch heard. A note sounding when Transpose
  changes ends on the key it started on.
- Velocities are the dynamics as written, as the built-in sound hears them.

## Channels (Q2)

- **Tracks 1 to 4** go out over MIDI (Jeremy, 2026-11-09: "a limit of four tracks that we support
  for output"). Each has its own channel, 1 to 16, Track N on channel N by default. Tab plays the
  track shown (`2026-10-30-tab-tracks-design.md`), so that track's channel is the one used.
- Track 5 and later play the built-in sound, as with no port, and the footer's ⚠ says "Only Tracks
  1 to 4 go out over MIDI. Track N plays the built-in sound."
- Both of the channels alphaTab plays a track on (the second for notes with a bend, slide or
  vibrato) go out on the track's one channel. So a bend in a chord bends every note of the chord in
  the receiver; a single line bends as written.

## The built-in sound (Q1)

- With a port picked and found, the built-in sound's **notes go quiet**; the clicks still play.
  "Also play the built-in sound" in Settings keeps them, off by default.
- The playhead, loops and every other control work as before: alphaTab's synthesizer still runs
  and is the clock (it plays muted).

## Timing (Q6)

- Each message is sent with a Web MIDI time stamp, so it sounds when the built-in sound would and
  the playhead lands with it. Nothing to set.
- How: the synthesizer renders sound ahead of the speakers. Each event it plays is tagged with the
  sample it was rendered at; the output (`audioOutput.ts`) knows when each sample reaches the
  speakers (the AudioContext's output time stamp), once the speakers have taken the first block of
  a Play. Messages wait in Frets' own queue and go to the port about 40 ms before they are due
  (300 ms while the page is hidden, when timers slow down), so Stop can drop what has not gone yet.
- **Stop, a seek, an edit, the end, a loop going round**: every note still sounding gets its
  note-off, so nothing hangs in the receiver. At a loop's end the note-offs are timed where the loop
  goes round; elsewhere they go at once (after anything already sent). A note-off alphaTab plays
  later for a note already ended this way isn't sent.

## Settings (Q7)

A Tab section **MIDI output**, key `frets.tab.midi`:

- `port`: the output's name, `''` for none (the default). Kept by name, since a browser gives a
  port a new id each visit. The list offers None and every output the browser reports. A saved
  port not there now is listed as "<name> (not found)".
- `builtIn`: "Also play the built-in sound", usable only with a port picked (boxed with it, as
  Output).
- `bendRange`: "Pitch bend range", 1 to 24 semitones, default 2.
- `channels`: Tracks 1 to 4's channels, as a list from Track 1; a table of Track and Channel,
  a row and a number field per track, whatever the open arrangement has. A missing or bad entry is its default; entries
  past the fourth are dropped.
- The browser asks for permission to use MIDI devices the first time the section shows. Where the
  browser has no Web MIDI (Safari), the section says so and offers no port.

## When the port is missing

A port picked but not found (unplugged, the IAC bus off, permission refused, no Web MIDI) shows a
small red ⚠ beside the footer's Sound, whose tip names the port and says the built-in sound plays
instead. Playback then plays the built-in sound, as with no port. When the port comes back, the
⚠ goes and MIDI goes out on the next Play.

## What others do

Guitar Pro 8 switches a track between its own sound and MIDI (two channels per track by default,
"force 11-16" for one per string) and has a MIDI output Latency setting. Dorico routes an
instrument to a MIDI port instead of its VST sound. MuseScore 4 has no MIDI output.

## How

1. `midiOut.ts`: the `frets.tab.midi` section (type, defaults, parser); `messageOf`, an alphaTab
   MIDI event as the bytes to send (or none), on the track's channel and transposed; `MidiTap`,
   which watches the synthesizer, tags each event with its sample, keeps the sounding notes, queues
   and sends.
2. `audioOutput.ts`: count samples handed over and played, and say when a sample is heard
   (`soundsAt`, in `performance.now()` time).
3. `playback.ts`: `TabPlayer` takes a MIDI output (`setMidi`): mutes the note channels when it
   should, turns the tap on for Play (not for a note heard alone), and releases notes on Stop, a
   seek and an edit.
4. `useMidiOutput.ts`: Web MIDI access and the port found by name, for the footer and Settings.
5. `PlaybackFooter.tsx`, `TabPage.tsx`, `tabSettings.tsx`: the section, the ⚠, the wiring.

## Tests

- `parseMidiSettings`: defaults `{ port: '', builtIn: false, channels: [] }`; a bad port, flag or
  channel (0, 17, 1.5, a string) takes its default; channel for track 1 is 1, track 4 is 4 when
  unset; a saved channel wins; track 5 has none, and a fifth saved entry is dropped.
- `messageOf`: a note on (alphaTab's type 128) on channel 0 key 60 velocity 100 to channel 3 is
  `[0x92, 60, 100]`; a note off (144) is `[0x82, …]`; the second alphaTab channel goes to the same
  channel; a pitch bend of 8192 + 4096 at range 16 is `[0xE2, 0, 96]`; a half step (8192 + 512) is
  `[0xE2, 0, 96]` at range 2 and `[0xE2, 43, 69]` at 12; a bend past the range stops at 0 or 16383;
  CC 100, 101, 6 and 38 aren't sent; a bad `bendRange` (0, 25, 1.5) is 2; CC 7 goes out; program changes and CC 0
  and 32 (bank select) don't; the metronome and count-in channels don't; transposed +2, key 60 is
  62; a key pushed past 127 or under 0 is not sent.
- `MidiTap`: nothing is sent before the speakers' first block; an event rendered 4410 samples after
  another is sent 100 ms later; a note on, then
  `release()`, sends its note-off once and no more; a note sounding when Transpose changes ends on
  its first key; at Play the range message and a centred pitch bend go out on the track's channel;
  nothing goes out while the tap is off (a note heard alone).
- Settings: the MIDI output section lists None and the outputs, "(not found)" for a saved one that
  is gone; "Also play the built-in sound" is disabled with no port; a Track and Channel table of
  four rows, Track 1 to 4, and no Track 5.
- Footer: the ⚠ shows only with a port picked and not found, or a track past 4 shown with a port;
  its tip names the port, or says only Tracks 1 to 4 go out.
