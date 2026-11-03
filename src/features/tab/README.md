# Tab editor (`src/features/tab/`)

The Tab page, `/tab` (`docs/specs/2026-10-24-tab-editor-design.md`). One
line per file: the file — what it does — its spec (in `docs/specs/`, date
left out where the topic is plain). Add a line when you add a file, and
keep the line short: the detail belongs in the file's own header comment
and in its spec.

## Rules that span files

- A clip's own format is alphaTex (`2026-10-25-tab-alphatex-design.md`;
  for agents `public/tab-alphatex.txt`), read with alphaTab's parser
  (`@coderline/alphatab`, pinned to 1.8.4, loaded on first read; its
  renderer is not used). What Frets doesn't draw is kept as written
  (`extra` and `header` in the clip), so a clip writes back exactly.
- Durations are ticks, whole = 3548160, so a double-dotted thirty-second
  and a sixty-fourth in any tuplet of up to twelve notes are whole numbers.
  Grace notes take no time.
- Bars stay full, as MuseScore keeps them: Delete leaves rests, and a
  length change on a picked column writes over what follows or leaves
  rests after it (`2026-10-31-tab-bars-stay-full-design.md`,
  `2026-11-01-tab-rest-lengths-design.md`).
- `layoutClip` (`layout.ts`) is the one source of where things are: the
  drawing, every hit test, the fields over the tab and the exports all work
  on its result.
- Each built-in arrangement but those in `samples/` must read with no
  warnings and write back exactly (`src/__tests__/tab/examples.test.ts`),
  and every newly drawn feature gets one.
- A key added or changed goes in `shortcuts.ts` in the same PR.
- What is selected or picked is drawn in `--select`, blue
  (`2026-11-01-tab-selection-look-design.md`); a picked word, bar line or
  mark has Edit and Delete in a right-click menu, and a double-click opens
  its Edit (`2026-11-01-tab-double-click-edit-design.md`).

## The page

- `TabLoader.tsx` — `TabPageClient`, which loads `TabPage` on the client
  only (it reads storage and the link's hash); `src/app/tab/page.tsx`
  renders it.
- `TabPage.tsx` — the editor: holds the whole clip, shows and edits one
  track of it as a `Part` through `clipAction`, lays the drawn clip out
  once per change and hands that layout to `TabClip`, the playhead, the
  loop handles and `fieldSpots.ts`, and wires the hooks below together —
  `2026-10-25-tab-editing-design.md`. Its tests are in
  `src/__tests__/tab/page/`, one file per area, sharing `helpers.tsx`.
- `useEditorState.ts` — the cursor, selection, picked thing, note input and
  `commit`.
- `useTabPicking.ts` — presses, drags and Alt+← → on the tab.
- `useHeadPanels.tsx` — the word fields, the signature panels and the
  score head's panels.
- `useArrangementFile.tsx` — New, Arrangements…, Save, Save as…, ⌘S/⌘O and
  "Save changes?".
- `useStableHandlers.ts` — gives `TabClip` the same handlers each render,
  so a playback step doesn't draw it again.
- `tab.css` — the page's CSS (`.tab-*`, `.score-*`), imported from
  `src/app/globals.css`.
- `views.ts` — the three views (Notation, ASCII Tab, AlphaTex) and the
  switch's order.
- `notice.ts` — what the line under the clip says (an import's guesses, a
  failure, a copy).
- `useWidth.ts` — an element's width, kept up to date.
- `usePopover.ts` — places and closes the small panels opened at a press or
  under a button.
- `shortcuts.ts` — the page's keys for the `?` overlay: the palette's from
  `tools.ts`, the rest listed by hand from `editorKeys.ts`, `TabPage.tsx`
  and `useSpaceKey`.
- `tabSettings.tsx` — the page's preferences, one Settings section each
  (Playback, Metronome, Notation, Colours, ASCII Tab, AlphaTex, Editing,
  Export), held as page state so Settings and the page's own controls
  change the same values — `2026-10-29-settings-design.md`.
- `editingPrefs.ts` — Tab › Editing (`frets.tab.editing`): `fillBars`, off
  by default — `2026-10-29-tab-fill-bars-setting-design.md`.

## The clip and its formats

- `clip.ts` — the model: a clip of tracks over shared `masterBars`
  (signatures, repeats, tempo, sections); `Part` is one track with those
  marks, made by `partOf` and put back by `withPart`; `parseClip`,
  `timeAt`, `titled`, `barsPerLine`, `bendRaises`, `bendLandings` —
  `2026-10-26-tab-rhythm-design.md`, `2026-10-30-tab-tracks-design.md`.
- `clipState.ts` — the clip with undo and redo, which arrangement it is,
  and the clip as last saved (`base`), so undoing back to it leaves nothing
  unsaved; `sameMusic` lets an FX change play on without a stop.
- `alphatexRead.ts` — reads alphaTex with alphaTab's parser and maps its
  score onto a clip — `2026-10-25-tab-alphatex-design.md`.
- `alphatex.ts` — writes a clip as plain alphaTex, the canonical form.
- `alphatexText.ts` — pure helpers for the AlphaTex view's editor: where
  the comments are, and which line a spot in the text is on —
  `2026-10-27-tab-alphatex-editing-design.md`.
- `ascii.ts` — `readAscii` (errors, warnings, guessed durations) and
  `writeAscii`; `public/tab-ascii.txt` is the format, its examples are
  tests, and `src/__tests__/tab/fixtures/` holds the forgiven spellings.
- `readTab.ts` — tells ASCII tab from alphaTex by the text alone.
- `credits.ts` — the artist, words and music from the clip's header, the
  tuning line ("Tune down 1/2 step"), `foldsTuning`, `shownTuning`, and the
  head's sizes in `HEAD` — `2026-10-29-tab-credits-tuning-design.md`.
- `tuning.ts` — the common tunings and setting a string's note, frets kept.
- `instrument.ts` — the clip's Sound as `\instrument`; one Frets has no
  sound for is kept and played by the nearest —
  `2026-10-29-tab-sound-and-fx-in-clip-design.md`.
- `fxLine.ts` — a track's FX as a `// frets:fx` comment line —
  `2026-10-30-tab-track-effects-design.md`.
- `shareLink.ts` — Copy link's `#tabz=` (deflated alphaTex) and reading
  `#tab=` — `2026-10-29-tab-share-link-design.md`.

## Layout and hit testing (pure)

- `layout.ts` — `layoutClip`: systems, bars and columns at a width; `rowsFor`
  (the rows over the staff each line uses), `lineAt`, `spreadLines`,
  `multiRests`, `bendShape` — `2026-10-28-tab-line-spacing-design.md`,
  `2026-10-28-tab-line-breaks-design.md`,
  `2026-10-30-tab-track-rests-design.md`.
- `layoutText.ts` — the words over the tab and the signatures: sizes,
  boxes, and `textAt` — `2026-10-26-tab-words-design.md`.
- `beatText.ts` — free text over a column: its size and `wrapBeatText`,
  which breaks a long one onto more lines — `2026-11-03-tab-text-wrap-design.md`.
- `hitTest.ts` — what a press is on (a string at a column, a staff line, a
  gap, a stem via `rhythmAt`) and where the cursor is drawn.
- `runs.ts` — marks over runs of columns (vibrato, let ring, P.M.) and
  legato joins.
- `beams.ts` — which notes a beam joins; plain eighths four together in 4/4.
- `marks.ts` — where each technique mark is so a press picks it, its
  palette tool, `markLights`, `mordentSign` —
  `2026-10-27-tab-pick-marks-design.md`.
- `barLines.ts` — the repeat signs, ×N counts and double bar lines a press
  picks; `hasEdit` (issue #276).
- `elements.ts` — every pickable thing in reading order, for Alt+← →
  (MuseScore's next element, issue #238).
- `rectangle.ts` — Shift+drag from blank space: the rectangle and the run
  of columns it takes in (issue #238).
- `whammy.ts` — where the whammy bar's lines and labels go, `whammyJoins` —
  `2026-10-29-tab-whammy-design.md`.
- `fieldSpots.ts` — where the fields and panels over the tab open.

## Editing (pure)

- `editing.ts` — the cursor, selection and frets; edits that add, move or
  remove columns and bars; `normalize`, cut, copy, `pasteOver`,
  `insertPaste`, `clearToRests`, `fillBar` —
  `2026-10-25-tab-editing-design.md`,
  `2026-10-31-tab-bars-stay-full-design.md`.
- `noteEdits.ts` — the palette's changes to notes: rhythm, tuplets, grace
  notes, marks, joins, bends, and `changeLength` —
  `2026-11-01-tab-rest-lengths-design.md`.
- `barEdits.ts` — the words over the tab and what a bar carries (repeats,
  endings, double bars, signatures).
- `normalMode.ts` — normal mode's edits: MuseScore's length digits, frets
  ±1, the next note in a chord, dragging a fret to another string —
  `2026-10-30-tab-note-input-mode-design.md`,
  `2026-10-31-tab-drag-fret-string-design.md`.
- `inputLength.ts` — note input's length, set before a note goes in.
- `jumps.ts` — Ctrl/⌘+← → a bar, Home / End, with Shift growing the
  selection — `2026-10-30-tab-musescore-selection-design.md`.
- `staffEntry.ts` — the staff's own cursor, the string and fret chosen for
  a note entered on the staff, `moveNotes` —
  `2026-10-27-tab-staff-entry-design.md`,
  `2026-10-28-tab-staff-drag-design.md`.
- `tools.ts` — the palette's table (name, key, edit, whether lit), shared
  by the palette, the keys and the `?` overlay.
- `editorKeys.ts` — the keys on the tab, on the staff cursor and on the
  playback line.

## Drawing

- `TabClip.tsx` — draws a layout as SVG (a `memo`), with the cursor and selection;
  `rangeBoxes`, `WahMark`, `SystemRowMarks`.
- `TabColumn.tsx` — one column: its numbers, joins, bends and marks;
  `hiddenNumber`, `BendCarry`.
- `TabStems.tsx` — the tab's own stems, beams and rests when no staff
  carries the rhythm.
- `tabLook.ts` — the colours a clip is drawn in (tokens on the page,
  concrete colours in an export), and the selection's look.
- `notation.ts` — each note's pitch, staff step and accidentals,
  `writtenStrings`, `pickedBendSemitones` (spelling is
  `src/lib/theory/keys.ts`) — `2026-10-27-tab-notation-design.md`.
- `StaffDrawing.tsx` — the treble staff an octave up; carries the rhythm in
  Both; `ghostChord`, `TimeBrackets`.
- `staffGeometry.ts` — heads, stems and beams across a bar.
- `staffMarks.ts` — the technique marks on the staff and their boxes;
  `staffInk`, `bendLabelLines`.
- `smufl.ts` — Bravura glyph outlines (from `scripts/smufl-glyphs.mjs`;
  licence in `BRAVURA-LICENSE.txt`).
- `TapSign.tsx` — a tap's circled T —
  `2026-10-28-tab-circled-tap-design.md`.
- `TempoNote.tsx` — the quarter note of "♩ = 92", drawn the same
  everywhere.
- `ScoreHead.tsx` — the score's head: title, artist and credits, tuning;
  `HeadPick`, `FoldedTitle` — `2026-10-28-tab-score-head-design.md`,
  `2026-11-01-tab-arrangement-header-design.md`,
  `2026-11-01-tab-tuning-collapse-design.md`.

The Sweet Child and book-marks specs (`2026-10-28-tab-sweet-child-*`,
`2026-10-29-tab-book-marks-design.md`) set how printed guitar books draw
ties, bends, grace notes, mordents, wah, fermatas and free time.

## Palette, panels and fields

- `TabPalette.tsx` — the symbol palette, Guitar Pro style, from `tools.ts`; draws all its groups or only some (`groups`).
- `TabRail.tsx` — the tools in a rail of panels on the clip's left, as Dorico has them: Notes (note input, Duration, Rhythm), Articulations (Joins, Bends, Techniques, Accents) and Bars (Bars, Text), one open at a time and kept across visits in `frets.tab.layout`; it grows into the page's left margin, so the clip keeps its right edge (`docs/specs/2026-11-02-tab-rail-design.md`, issue #301).
- `BarTimePanel.tsx` — the time signature from a bar on.
- `TimeSignatureFields.tsx` — the time signature panel's two fields.
- `BarKeyPanel.tsx` — the key signature from a bar on (`\ks`).
- `barPanel.ts` — keeps the bar panels inside the tab.
- `WordField.tsx` — the field over the tab for a chord name, text, section,
  capo, ending number or repeat count — `2026-10-26-tab-words-design.md`.
- `TempoPanel.tsx` — bpm, Tap (`src/lib/tapTempo.ts`) and a label —
  `2026-10-29-tab-tempo-button-design.md`.
- `CreditsPanel.tsx` — title (needed), artist, words and music.
- `TuningPanel.tsx` — the common tunings and each string on the
  `KeyPicker`.
- `ViewOptions.tsx` — Colours, then only the shown view's own options —
  `2026-11-01-tab-view-options-per-view-design.md`.
- `viewOptions.ts` — the view options' values and their parser (`laidOut`),
  saved per viewer, not in the clip.
- `AlphaTexEditor.tsx` — the editable AlphaTex view: read half a second
  after typing, errors marked ⚠ —
  `2026-10-27-tab-alphatex-editing-design.md`.

## Arrangements, import and export

- `arrangements.ts` — My arrangements in the browser: one key per clip, an
  index, and the draft — `2026-10-28-tab-arrangements-design.md`.
- `useArrangements.ts` — the arrangements as React state, with Undo for a
  delete.
- `ArrangementChooser.tsx` — Arrangements… as a file chooser: places,
  files, preview — `2026-10-31-tab-arrangement-chooser-design.md`.
- `SaveDialogs.tsx` — Save as… and "Save changes to ‹name›?".
- `builtins.ts` — the built-in arrangements, opened by
  `/tab#example=<name>`; served by `src/app/tab/builtin.json/`.
- `builtinFiles.ts` — finds the built-in files on disk (server and tests).
- `builtin_arrangements/` — one `.atex` or `.txt` per arrangement, a
  folder per topic (its README says how to add one). `editing_tests/`
  there shows one editing behaviour per file, for people to try; a change
  to editing behaviour adds or updates one (the `test-arrangement` skill,
  `.claude/skills/test-arrangement/`).
- `useClipImport.ts` — import, built-ins, links and drops, each opened as
  a new arrangement.
- `TabDialogs.tsx` — the Import dialog.
- `ClipActions.tsx` — the buttons over the clip: View options, copy, Copy
  link and Download….
- `saveFile.ts` — saves through the browser's Save As dialog where there is
  one, else downloads.
- `exportTab.tsx` — the clip as PNG and SVG, with the score head, and the
  Export section's settings — `2026-10-26-tab-export-design.md`.
- `TabExportDialog.tsx` — Export: one Format list and one Download, Copy
  for the formats that paste — `2026-10-30-tab-export-format-list-design.md`.
- `musicxml.ts` — the clip as MusicXML 4.0, `musicXmlLosses` —
  `2026-10-30-tab-musicxml-export-design.md`.
- `guitarPro.ts` — the clip as a `.gp` file via alphaTab's `Gp7Exporter` —
  `2026-10-30-tab-guitar-pro-export-design.md`.

## Playback

- `playback.ts` — plays a clip with alphaTab's synthesizer and the
  soundfonts in `public/soundfont/` (`OWN_FONTS`, built by
  `scripts/build-soundfonts.py`); `countOf`, `withCountIn`, `heardPosition`
  — `2026-10-26-tab-playback-design.md`,
  `2026-10-27-tab-instruments-design.md`,
  `2026-10-28-tab-sound-preload-design.md`.
- `audioOutput.ts` — the Web Audio output the synthesizer plays through;
  `ringOn`, `chokeAll`.
- `dryChannels.ts` — keeps the clicks' channels out of the effects.
- `effects.ts` — distortion and reverb as Web Audio nodes —
  `2026-10-28-tab-playback-effects-design.md`.
- `plateReverb.ts` — fmlab's plate reverb, baked into a convolver.
- `soundDecode.ts` — decoding a soundfont's Ogg Vorbis samples, shared by
  both sides — `2026-10-29-tab-sound-decoding-design.md`.
- `soundDecoder.ts` — asks the worker to decode.
- `soundDecoder.worker.ts` — the Web Worker that decodes.
- `click.ts` — the metronome click (`src/lib/click.ts`) as a tiny
  SoundFont — `2026-10-28-tab-metronome-design.md`.
- `PlaybackFooter.tsx` — the footer under the tab: Play, Loop, Hear notes,
  Metronome, Speed, Transpose, Volume, Sound, FX; the playhead in
  `--playhead`; `trackLabel` — `2026-10-27-tab-hear-notes-design.md`.
- `PinnedPlayback.tsx` — keeps the footer at the window's bottom while the
  card runs past it — `2026-10-28-tab-pinned-playback-design.md`.
- `PlaybackOptions.tsx` — Play's right-click menu —
  `2026-10-27-tab-playback-options-design.md`.
- `ClickOptions.tsx` — the Metronome toggle's right-click menu: count-in
  and click volume.
- `FxButton.tsx` — FX and its light switch, and the FX dialog.

## Specs

- `docs/specs/2026-11-03-tab-text-wrap-design.md`: a long Text over a
  column wraps onto more lines
- `docs/specs/2026-11-03-tab-test-arrangements-design.md`: test
  arrangements, the `editing_tests/` folder and its skill
- `docs/specs/2026-11-01-tab-view-options-per-view-design.md`: View options
  per view, and Size over the clip
- `docs/specs/2026-11-01-tab-tuning-collapse-design.md`: the tuning is picked
  and folds to its name
- `docs/specs/2026-11-01-tab-selection-look-design.md`: how a selection looks
- `docs/specs/2026-11-01-tab-rest-lengths-design.md`: changing a rest's or
  note's length keeps bars full
- `docs/specs/2026-11-01-tab-double-click-edit-design.md`: a double-click
  opens a word's edit dialog
- `docs/specs/2026-11-01-tab-arrangement-header-design.md`: the title and
  credits are picked, not edited, and the header folds
- `docs/specs/2026-10-31-tab-drag-fret-string-design.md`: a fret number drags
  to another string
- `docs/specs/2026-10-31-tab-bars-stay-full-design.md`: bars stay full:
  removed notes become rests, pastes write over
- `docs/specs/2026-10-31-tab-arrangement-chooser-design.md`: Arrangements… as
  a file chooser; Save instead of autosave
- `docs/specs/2026-10-30-tab-tracks-design.md`: a Clip holds several Tracks
  (the model)
- `docs/specs/2026-10-30-tab-track-rests-design.md`: a Track's empty bars
  drawn as multi-bar rests
- `docs/specs/2026-10-30-tab-track-effects-design.md`: effects belong to a
  Track; the metronome stays dry
- `docs/specs/2026-10-30-tab-track-chooser-design.md`: pick the Track the page
  shows, edits and plays
- `docs/specs/2026-10-30-tab-note-input-mode-design.md`: normal mode and note
  input, as separate modes
- `docs/specs/2026-10-30-tab-musicxml-export-design.md`: MusicXML export
- `docs/specs/2026-10-30-tab-musescore-selection-design.md`: selecting and
  editing as MuseScore does (#238 step 1)
- `docs/specs/2026-10-30-tab-guitar-pro-export-design.md`: Guitar Pro (.gp)
  export
- `docs/specs/2026-10-30-tab-export-format-list-design.md`: the Export
  dialog's formats in one list, one Download button
- `docs/specs/2026-10-30-music-theory-core-design.md`: all music theory moves
  into src/lib/theory/, the only tonal importer
- `docs/specs/2026-10-30-keyboard-shortcuts-design.md`: ? shows the page's
  keyboard shortcuts; each page keeps its list
- `docs/specs/2026-10-29-tab-whammy-design.md`: the whammy bar, drawn and
  played
- `docs/specs/2026-10-29-tab-uneven-bar-amounts-design.md`: a bar that doesn't
  add up says by how much
- `docs/specs/2026-10-29-tab-tempo-button-design.md`: the tempo in the score's
  head, with tap tempo
- `docs/specs/2026-10-29-tab-sound-decoding-design.md`: sounds decode off the
  main thread
- `docs/specs/2026-10-29-tab-sound-and-fx-in-clip-design.md`: the Sound and FX
  are saved with the clip
- `docs/specs/2026-10-29-tab-share-link-design.md`: an arrangement shared as a
  /tab#tab= link
- `docs/specs/2026-10-29-tab-fill-bars-setting-design.md`: filling short bars
  with rests becomes a Preference, off by default
- `docs/specs/2026-10-29-tab-delete-at-line-design.md`: Delete at the playback
  line removes the rest before it
- `docs/specs/2026-10-29-tab-credits-tuning-design.md`: the title, artist,
  credits and tuning set from the score's head
- `docs/specs/2026-10-29-tab-book-marks-design.md`: bend starts, capital X and
  ghost chords as the book prints them
- `docs/specs/2026-10-29-settings-design.md`: one Settings dialog for every
  Preference, one key per Section
- `docs/specs/2026-10-28-tab-sweet-child-verse-design.md`: Sweet Child round
  2: the verse and chorus
- `docs/specs/2026-10-28-tab-sweet-child-solo-two-design.md`: Sweet Child
  round 4: the second solo
- `docs/specs/2026-10-28-tab-sweet-child-solo-three-design.md`: Sweet Child
  round 5: the end of Chorus 3 and Guitar Solo 3's start
- `docs/specs/2026-10-28-tab-sweet-child-solo-six-design.md`: Sweet Child
  round 8: Guitar Solo 3 to the Outro
- `docs/specs/2026-10-28-tab-sweet-child-solo-four-design.md`: Sweet Child
  round 6: the rest of Guitar Solo 3's first half
- `docs/specs/2026-10-28-tab-sweet-child-solo-five-design.md`: Sweet Child
  round 7: Guitar Solo 3 under the wah
- `docs/specs/2026-10-28-tab-sweet-child-solo-design.md`: Sweet Child round 3:
  the first solo
- `docs/specs/2026-10-28-tab-sweet-child-outro-design.md`: Sweet Child round
  9: the Outro's riff and solo
- `docs/specs/2026-10-28-tab-sweet-child-intro-design.md`: Sweet Child round
  1: a printed score's header and lines
- `docs/specs/2026-10-28-tab-sweet-child-ending-design.md`: Sweet Child round
  10: the end of the outro solo
- `docs/specs/2026-10-28-tab-staff-drag-design.md`: notes move up and down on
  the staff by dragging
- `docs/specs/2026-10-28-tab-sound-preload-design.md`: an instrument loads
  once, before Play, until it changes
- `docs/specs/2026-10-28-tab-score-head-design.md`: the title, credits and
  tuning drawn in the score's head
- `docs/specs/2026-10-28-tab-playback-effects-design.md`: distortion and plate
  reverb on playback
- `docs/specs/2026-10-28-tab-pinned-playback-design.md`: the playback controls
  stay in sight while scrolling
- `docs/specs/2026-10-28-tab-metronome-design.md`: a metronome and count-in
  for playback
- `docs/specs/2026-10-28-tab-line-spacing-design.md`: each line only as tall
  as what it draws
- `docs/specs/2026-10-28-tab-line-breaks-design.md`: the clip's own line
  breaks, from alphaTex's systems layout
- `docs/specs/2026-10-28-tab-guitar-solo-3-design.md`: the Guitar Solo 3
  excerpt drawn as Guitar Pro draws it
- `docs/specs/2026-10-28-tab-fewer-bands-design.md`: fewer highlighted bands;
  playback never highlights a region
- `docs/specs/2026-10-28-tab-circled-tap-design.md`: a tap's circled T over
  the tab and the staff
- `docs/specs/2026-10-28-tab-arrangements-design.md`: My arrangements
  (autosave and the one-list dialog since replaced)
- `docs/specs/2026-10-27-tab-staff-entry-design.md`: notes can be entered from
  the staff
- `docs/specs/2026-10-27-tab-playback-options-design.md`: Play's right-click
  options: where Stop leaves the cursor, a pause
- `docs/specs/2026-10-27-tab-pick-marks-design.md`: a technique mark on the
  tab can be picked and changed
- `docs/specs/2026-10-27-tab-notation-design.md`: a standard-notation staff
  over, under or instead of the tab
- `docs/specs/2026-10-27-tab-instruments-design.md`: better playback
  instruments, including a real piano
- `docs/specs/2026-10-27-tab-held-bends-design.md`: held and released bends
  round-trip from Guitar Pro
- `docs/specs/2026-10-27-tab-hear-notes-design.md`: Hear notes plays each note
  as it is entered
- `docs/specs/2026-10-27-tab-alphatex-editing-design.md`: the AlphaTex view's
  text can be edited directly
- `docs/specs/2026-10-26-tab-words-design.md`: chord names, sections, tempo
  and capo over the tab
- `docs/specs/2026-10-26-tab-rhythm-design.md`: tuplets, grace notes, tremolo
  picking and time signature changes
- `docs/specs/2026-10-26-tab-playback-design.md`: playback with alphaTab's
  synth: a transport, loop and speed
- `docs/specs/2026-10-26-tab-note-marks-design.md`: the note marks: bends,
  slides, hammer-ons and the rest
- `docs/specs/2026-10-26-tab-export-design.md`: an Export options dialog for
  the tab image
- `docs/specs/2026-10-26-tab-examples-design.md`: a library of example clips
  showing the syntax
- `docs/specs/2026-10-25-tab-editing-design.md`: the keys and toolbar for
  editing a clip
- `docs/specs/2026-10-25-tab-alphatex-design.md`: alphaTex becomes the clip's
  format
- `docs/specs/2026-10-24-tab-editor-design.md`: the Tab page: a clip from
  ASCII tab, drawn with rhythm, edited, exported

## Decisions

- `docs/adr/2026-11-02-no-users-yet.md`: no migrations of URLs, keys or saved
  state
- `docs/adr/2026-11-02-one-theory-core.md`: all theory in src/lib/theory/, the
  only tonal importer
