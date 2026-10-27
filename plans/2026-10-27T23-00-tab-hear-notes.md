# Plan: hear notes as you enter them

1. `columnAlone` in playback.ts: one column as a one-beat clip at 120 bpm, plain notes.
2. `TabPlayer.hear`: load that MIDI in place of the clip's and play it; Loading goes back to idle.
3. `usePlayback().hear(bar, column)`: a request state heard after the edit's render; player made on first use.
4. Ear toggle after Loop, `hearNotes` saved in `frets.tab.playback`.
5. TabPage: typed frets and staff Enter call `hearColumn` when on and the controls show.
6. Tests; Chromium check measuring the output level (off silent, on sounds, Play still plays the clip).
