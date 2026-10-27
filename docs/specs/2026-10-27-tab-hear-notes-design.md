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
  added on the staff with Enter. The whole column sounds, so a chord built note
  by note is heard as a chord.
- The column sounds as plain picked notes (no ties, slides or bends, which need
  the notes round them; harmonics, palm mutes and ghost notes kept) for a
  quarter note at 120 bpm, in the chosen Sound and Volume, then rings out.
  The next note entered fades the last one out first.
- Nothing sounds while the clip plays (an edit stops it anyway), nor with the
  controls hidden.

## How

`columnAlone` makes a one-bar clip of the column (`playback.ts`);
`TabPlayer.hear` loads its MIDI in place of the clip's and plays it, so the
next Play loads the clip again. alphaTab's one-time MIDI files
(`playOneTimeMidiFile`) played no notes in testing, so they aren't used.
`usePlayback().hear(bar, column)` asks for it from the edit; it sounds once
the edit has drawn, after the clip change has stopped any playback.
