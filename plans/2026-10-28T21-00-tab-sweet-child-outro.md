# Plan: Sweet Child O' Mine, round 9 (the Outro, bars 154–169)

Spec: `docs/specs/2026-10-28-tab-sweet-child-outro-design.md`.

1. Transcribe bars 154–169 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 9 and list the differences.
2. `joinToNext` in `alphatexRead.ts`: a slide may leave a dead note.
3. `Bend.to` in `clip.ts` (validated: a release's landing, lower than the peak), read and written;
   `bendCarries` carries on after it, `bendRaises` lands the next note a step under, `bendLandings`
   tells `BendCarry` (`TabColumn.tsx`) to rise from the landing; `releaseEnd` and `ReleaseLabel` draw it.
4. `Column.hairpin` (cre, dec): read, written, its row in `rowsFor`, its wedges in `SystemRowMarks`.
5. `harmonic: 'artificial'` and `Note.harmonicFret` (ah): read, written, "AH" in `columnMarks`, its
   mark box, `removeMark`, and the N key's cycle.
6. Example `outro-solo` (bars 157–165); tests in `soloLook.test.tsx`; the Tab README and
   `public/tab-alphatex.txt`.
7. Check in a browser: the example in Both, Staff and Tab.
