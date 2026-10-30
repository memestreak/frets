# Hear notes as you enter them

Jeremy, 2026-10-27: "I'd like to add a feature that plays back as we create
notes, so that we can hear what we're putting down if we want to. We'd need a
little toggle button for this."

## Behaviour

- A toggle with a music note sounding (a quarter note with a speaker's three
  waves; it was an ear until Jeremy asked for this, 2026-10-27), after Loop in the playback footer: "Hear notes as you
  enter them". Off at first; saved with the other playback settings
  (`hearNotes` in `frets.tab.playback`).
- On, and with the playback controls showing, each note entered sounds:
  a fret typed on the tab (each digit, so "12" sounds 1 then 12), or a note
  added on the staff with Enter. Only that note sounds, not the rest of its
  column (Jeremy, 2026-10-27: "it should just play the note added").
- The note sounds as a plain picked note (no ties, slides or bends, which need
  the notes round them; harmonics, palm mutes and ghost notes kept) for a
  quarter note at 120 bpm, in the chosen Sound and Volume, then rings out.
  The next note entered lets the last one ring out to its end (issue #258,
  Jeremy, 2026-10-30: "the previous note gets cut off by the new one"), even
  on the same string ("They should ring the same. The ring is for the
  preview"). Play fades out any still ringing.
- Nothing sounds while the clip plays (an edit stops it anyway), nor with the
  controls hidden.

## How

`noteAlone` makes a one-bar clip of the note (`playback.ts`);
`TabPlayer.hear` loads its MIDI in place of the clip's and plays it, so the
next Play loads the clip again. alphaTab's one-time MIDI files
(`playOneTimeMidiFile`) played no notes in testing, so they aren't used.
`usePlayback().hear(bar, column)` asks for it from the edit; it sounds once
the edit has drawn, after the clip change has stopped any playback. That stop
(`TabPlayer.stop`) leaves a note heard on its own sounding. To let it ring
beside the next one, `WebAudioOutput.ringOn` has the synthesizer render the
rest of it at once (it ends with the note's MIDI, under two seconds) and plays
that on its own audio node; the next note then loads into the synthesizer and
starts on a new node. `chokeAll` fades the ringing nodes out on Play.
