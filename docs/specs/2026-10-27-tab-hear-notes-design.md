# Hear notes as you enter them

Jeremy, 2026-10-27: "I'd like to add a feature that plays back as we create
notes, so that we can hear what we're putting down if we want to. We'd need a
little toggle button for this."

## Behaviour

- A toggle with an ear, after Loop in the playback footer: "Hear notes as you
  enter them". Off at first; saved with the other playback settings
  (`hearNotes` in `frets.tab.playback`).
- On, and with the playback controls showing, each note entered sounds:
  a fret typed on the tab (each digit, so "12" sounds 1 then 12), or a note
  added on the staff with Enter. Only that note sounds, not the rest of its
  column (Jeremy, 2026-10-27: "it should just play the note added").
- The note sounds as a plain picked note (no ties, slides or bends, which need
  the notes round them; harmonics, palm mutes and ghost notes kept) for a
  quarter note at 120 bpm, in the chosen Sound and Volume, then rings out.
  The next note entered fades the last one out first.
- Nothing sounds while the clip plays (an edit stops it anyway), nor with the
  controls hidden.

## How

`noteAlone` makes a one-bar clip of the note (`playback.ts`);
`TabPlayer.hear` loads its MIDI in place of the clip's and plays it, so the
next Play loads the clip again. alphaTab's one-time MIDI files
(`playOneTimeMidiFile`) played no notes in testing, so they aren't used.
`usePlayback().hear(bar, column)` asks for it from the edit; it sounds once
the edit has drawn, after the clip change has stopped any playback.
