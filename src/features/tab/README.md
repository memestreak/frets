# Tab editor (`src/features/tab/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/features/tab/` — the Tab page (`docs/specs/2026-10-24-tab-editor-design.md`;
  not in `sections.ts` until it is ready): `clip.ts` (the model: bars of
  columns, six notes each, durations in ticks, whole = 3548160, so a double-dotted
  thirty-second and a sixty-fourth in any tuplet of up to twelve notes (alphaTex's
  tu 3 … 12, or any ratio `tu (n d)`) are whole numbers too; grace notes take no time; a bar may change the time signature, `timeAt`;
  `parseClip`; `docs/specs/2026-10-26-tab-rhythm-design.md`),
  `ascii.ts` (`readAscii` with its errors, warnings and guessed durations,
  and `writeAscii`, the canonical form; `public/tab-ascii.txt` is the
  format, and its examples are tests; `src/__tests__/tab/fixtures/` holds
  golden input and output pairs for the spellings it forgives, see its
  README), `layout.ts` (pure: where systems,
  bars and columns go at a width, and `rowsFor`, the rows over the staff,
  each there only when the clip uses it;
  `docs/specs/2026-10-26-tab-note-marks-design.md`) and `TabClip.tsx` (draws a layout as
  SVG, with the editor's cursor and selection), `marks.ts` (pure: where each
  drawn technique mark is, so a press picks it, and its palette tool;
  `docs/specs/2026-10-27-tab-pick-marks-design.md`), `clipState.ts` (the clip
  with undo and redo), `editing.ts` (pure: the cursor, selection and every
  edit, `normalize` keeping ties, hammer-ons and slides true, cut, copy
  and paste at the cursor), `tools.ts` (the symbol palette's table, shared
  with the keys) and `TabPalette.tsx`, `BarTimePanel.tsx` with
  `TimeSignatureFields.tsx` (the time signature from a bar on, opened by a
  press on a drawn one or the palette; nothing in the header sets it),
  `WordField.tsx` (the field over the tab for a chord name, section, tempo or
  the capo, "Capo 3" over the first line;
  `docs/specs/2026-10-26-tab-words-design.md`, `2026-10-26-tab-rhythm-design.md`), `exportTab.tsx` and
  `TabExportDialog.tsx` (the Export options button; the Tab view's copy button copies the PNG;
  `docs/specs/2026-10-26-tab-export-design.md`, on the chord export's
  helpers), and `TabPage.tsx` (the editor: keys
  on the drawn tab, `docs/specs/2026-10-25-tab-editing-design.md`; import
  by dialog (typed, or Open file… for a local `.atex` / `.txt`), drop or a `#tab=` link replaces the clip, read on load or
  hashchange and then cleared, while a paste goes in at the cursor;
  Notation | ASCII Tab | AlphaTex, each with copy and save buttons at the top right of the clip, after the view switch (Notation copies the PNG; Staff | Tab | Both takes the top left) (`saveFile.ts`; Notation lists PNG, SVG, ASCII tab and alphaTex); Notation shows Staff, Tab or Both (`docs/specs/2026-10-27-tab-notation-design.md`): `notation.ts` (pure: pitch, spelling in the key, staff steps, accidentals), `StaffDrawing.tsx` (the treble staff an octave up, carrying the rhythm in Both, where the tab drops its stems), `staffEntry.ts` (pure: the staff cursor's pitch, the string and fret Frets picks for a note entered on the staff, Enter and Alt+↑ ↓; `docs/specs/2026-10-27-tab-staff-entry-design.md`; a press on the staff puts its own cursor there and hands it the keys, a press on the tab hands them back; Staff alone is edited the same way), `staffGeometry.ts` (pure: heads, stems and beams across a bar) and `staffMarks.ts` (pure: the technique marks on the staff and their boxes, which `marks.ts` picks), `smufl.ts` (Bravura's glyph outlines, from `scripts/smufl-glyphs.mjs`), and `BarKeyPanel.tsx` (the key signature from a bar on, `\ks`, opened like the time signature's panel); the AlphaTex view is editable (the × in its text box's top right clears it), `AlphaTexEditor.tsx` (`docs/specs/2026-10-27-tab-alphatex-editing-design.md`: read half a second after typing, errors marked ⚠ and underlined, text as typed until an edit elsewhere changes the clip); Export options,
  the Export dialog, which also downloads the clip as alphaTex or ASCII). The clip's own format is alphaTex
  (`docs/specs/2026-10-25-tab-alphatex-design.md`; for agents
  `public/tab-alphatex.txt`): `alphatexRead.ts` reads it with alphaTab's
  parser (`@coderline/alphatab`, pinned to 1.8.4, loaded on first read;
  its renderer is not used) and keeps what Frets doesn't draw as written
  (`extra` and `header` in the clip), `alphatex.ts` writes it, and
  `readTab.ts` tells ASCII from alphaTex. `examples.ts` is the library of
  example clips (Examples…, or `/tab#example=<id>`; any `.atex` or `.txt` dropped into `samples/` is listed there too, under Samples, via `samples.ts` and the route `src/app/tab/samples.json/`), shown in place of the
  clip and never saved (`clipState.ts` sets the clip aside;
  `docs/specs/2026-10-26-tab-examples-design.md`); each must read with no
  warnings and write back exactly, and every newly drawn feature gets one.
  `playback.ts` plays a clip: alphaTab's MIDI generator and synthesizer
  (loaded on the first Play) with the SONiVOX soundfont in
  `public/soundfont/` (Acoustic Grand Piano is the Salamander Grand and Steel Guitar the Iowa
  acoustic and Clean Electric Guitar Karoryfer's, each its own soundfont loaded when used, `OWN_FONTS`, built by `scripts/build-soundfonts.py`; `docs/specs/2026-10-27-tab-instruments-design.md`), through a small Web Audio output; `PlaybackFooter.tsx`
  is the footer under the tab (shown, it sticks to the window's bottom inside the card, `PinnedPlayback.tsx`; `docs/specs/2026-10-28-tab-pinned-playback-design.md`) (Play from the cursor, Loop setting loop points,
  Speed, a number field in `NumberField.tsx`, Transpose, the Volume knob in `VolumeKnob.tsx`, Sound) and the playhead (`docs/specs/2026-10-26-tab-playback-design.md`); a right-click on Play opens `PlaybackOptions.tsx`, Stop leaves the cursor where it stopped, and a pause between loops (`docs/specs/2026-10-27-tab-playback-options-design.md`). `ScoreHead.tsx` is the score's head, drawn in the clip's card over the drawing (Notation only) as a printed score's first page has it (`docs/specs/2026-10-28-tab-score-head-design.md`): the title (`ClipTitle.tsx`, the page's h1, a click renaming the clip), the artist and "Words & Music by" centred, then the tuning ("Tune down 1/2 step") on the left, from `credits.ts` (pure, with the sizes in `HEAD` that the exported image's head shares); a guitar with all six strings tuned alike is written on the staff as fingered (`writtenStrings` in `notation.ts`). The eye button before copy, in every view, opens `ViewOptions.tsx`, each view's options under its name (`viewOptions.ts`: Notation's bar numbers on every bar, each line's first or none, and Size 50–200%, CSS zoom on the drawing and all over it, laid out at the width over the zoom; ASCII Tab's Rhythm line; AlphaTex's Line numbers), which the views, copies and exports follow; lines run to the full width but the last, and 4/4 beams plain eighths four together (`docs/specs/2026-10-28-tab-sweet-child-intro-design.md`). A double bar is `\db`; with `\multiBarRest` bars of rest in a row draw as one with their count (`multiRests` in `layout.ts`, each bar keeping its slice so the cursor steps through); under a staff the tab names a tied note only where a bar starts; the last line runs full when it has as many bars as the one before (`docs/specs/2026-10-28-tab-sweet-child-verse-design.md`). Under a staff a held bend's note, too, is named only where a bar starts, and a let-down note is named when a pull-off leaves it (`legatoStarts`; `docs/specs/2026-10-28-tab-sweet-child-solo-design.md`). A mordent (`umordent`, `lmordent`; `Note.mordent`, `mordentSign` in `marks.ts`, Bravura's sign) is drawn over the staff and in the vibrato's row over the tab, set from two Techniques buttons; a let-down note is named where a bar starts, and a tied note when a slide leaves it or under a mordent (`hiddenNumber` in `TabClip.tsx`; `docs/specs/2026-10-28-tab-sweet-child-solo-two-design.md`). `usePopover.ts` places and closes the small panels. The note toggle after Loop (a music note with sound waves) sounds each note, alone, as it is entered (`docs/specs/2026-10-27-tab-hear-notes-design.md`).
  Images and dragging are PR 3 in the spec.
