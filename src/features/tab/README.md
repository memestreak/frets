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
- Editing follows the Tab editing principles, P1–P14
  (`docs/tab-editing-principles.md`): Dorico first, then MuseScore, then
  Guitar Pro 8 (`docs/adr/2026-11-05-tab-editing-follows-dorico-musescore-gp8.md`).
  A change to how editing behaves follows them or changes them in the
  same PR.
- Bars are always full (P1): every edit goes through one timeline, longer
  writes over, shorter leaves a Gap, and only Insert, Insert paste and
  Ctrl/⌘+Delete move later music
  (`2026-11-04-tab-bars-always-full-design.md`). Rests are Gaps written by
  the meter (P4, `2026-11-03-tab-rests-are-gaps-design.md`).
- `layoutClip` (`layout.ts`) is the one source of where things are: the
  drawing, every hit test, the fields over the tab and the exports all work
  on its result.
- Each built-in arrangement but those in `samples/` must read with no
  warnings and write back exactly (`src/__tests__/tab/examples.test.ts`),
  and every newly drawn feature gets one.
- A key added or changed goes in `shortcuts.ts` in the same PR.
- What is selected or picked is drawn in `--select`, blue
  (`2026-11-01-tab-selection-look-design.md`); a picked word, signature,
  bar line or mark has Edit and Delete in a right-click menu, and a
  double-click opens its Edit (`2026-11-01-tab-double-click-edit-design.md`).
  A picked Mark tints its notes and draws its Attachment line; a Span has
  Handles (`2026-11-04-tab-pick-every-mark-design.md`).

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
- `useEditorState.ts` — the cursor, selection, picked thing, note input mode and
  `commit` (and `commitVoices` for an edit of several Voices), which refuse
  an edit that sounds one string in two Voices.
- `useTabPicking.ts` — presses, drags and Alt+← → on the tab.
- `useVoicePick.ts` — the Active voice (`useActiveVoice`) and the edits that
  cross Voices: a press on another Voice's note, Alt+1–4, Move to voice,
  Select only voice, an edit of every Voice a selection covers, Alt+← →.
- `usePlayRange.ts` — playback (`usePlayback`), the playback line, where
  Play starts and stops, Loop, and a press above or below the staff.
- `usePageKeys.ts` — the keys that work anywhere on the page (the grid keys,
  Esc and N, L, Space, the playback line's keys), paste, copy, cut, undo
  and redo, and the tab taking and letting go of the keys.
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
  `tools.ts`, the rest listed by hand from `editorKeys.ts`, `usePageKeys.ts`
  and `useSpaceKey`.
- `tabSettings.tsx` — the page's preferences, one Settings section each
  (Playback, Metronome, Notation, Colours, ASCII Tab, AlphaTex, Editing,
  Export), held as page state so Settings and the page's own controls
  change the same values — `2026-10-29-settings-design.md`.
- `editingPrefs.ts` — Tab › Editing (`frets.tab.editing`): note input mode's
  grid — `2026-11-01-tab-note-input-grid-design.md`.

## The clip and its formats

- `clip.ts` — the model: a clip of tracks over shared `masterBars`
  (signatures, repeats, tempo, sections), each track's bars holding up to
  four Voices; `Part` is one Voice of one track with those marks, the
  other Voices carried read-only (`otherVoices`), made by `partOf` and put
  back by `withPart`; `stringClashes` for the
  line under the clip; `parseClip`, `timeAt`, `titled`, `barsPerLine`,
  `bendRaises`, `bendLandings` — `2026-10-26-tab-rhythm-design.md`,
  `2026-10-30-tab-tracks-design.md`, `2026-11-03-tab-voices-design.md`.
- `clipState.ts` — the clip with undo and redo, which arrangement it is,
  and the clip as last saved (`base`), so undoing back to it leaves nothing
  unsaved; `amend` joins a change to the last undo step (a Chat reply's later changes); `sameMusic` lets an FX change play on without a stop.
- `alphatexRead.ts` — reads alphaTex with alphaTab's parser and maps its
  score onto a clip — `2026-10-25-tab-alphatex-design.md`.
- `alphatex.ts` — writes a clip as plain alphaTex, the canonical form; `alphaTexTracks` gives it a track and a bar at a time, for the Chat panel.
- `alphatexText.ts` — pure helpers for the AlphaTex view's editor: where
  the comments are, and which line a spot in the text is on —
  `2026-10-27-tab-alphatex-editing-design.md`.
- `ascii.ts` — `readAscii` (errors, warnings, guessed durations) and
  `writeAscii`, every Voice merged onto the one tab (`mergedVoices`); `public/tab-ascii.txt` is the format, its examples are
  tests, and `src/__tests__/tab/fixtures/` holds the forgiven spellings.
- `readTab.ts` — tells ASCII tab from alphaTex by the text alone.
- `credits.ts` — the artist, words and music from the clip's header, the
  tuning line ("Tune down 1/2 step"), `foldsTuning`, `shownTuning`, and the
  head's sizes in `HEAD` — `2026-10-29-tab-credits-tuning-design.md`.
- `tuning.ts` — the common tunings and setting a string's note, frets kept.
- `instrument.ts` — the clip's Sound as `\instrument`; one Frets has no
  sound for is kept and played by the nearest —
  `2026-10-29-tab-sound-and-fx-in-clip-design.md`.
- `chordSet.ts` — a track's Chord set: its `\chord` definitions
  (`Track.chords`, each a name and shape) and the names only typed over
  columns, each read by `readChordName` — `2026-11-05-tab-chord-set-design.md`;
  `withChordShape`, `withNewChord`, `withRenamedChord` and `withoutChord`, the Chords panel's changes to it.
- `fxLine.ts` — a track's FX as a `// frets:fx` comment line —
  `2026-10-30-tab-track-effects-design.md`.
- `shareLink.ts` — Copy link's `#tabz=` (deflated alphaTex), reading
  `#tab=`, and a link's `?show=` — `2026-10-29-tab-share-link-design.md`,
  `2026-11-06-tab-show-link-design.md`.

## Layout and hit testing (pure)

- `layout.ts` — `layoutClip`: systems, bars and columns at a width;
  `lineAt`, `spreadLines` and `justify` (the line breaking),
  `multiRests`, `isWholeBarRest` and `wholeRestX` (an empty
  full bar drawn as one rest) — `2026-10-28-tab-line-spacing-design.md`,
  `2026-10-28-tab-line-breaks-design.md`,
  `2026-10-30-tab-track-rests-design.md`,
  `2026-11-03-tab-rests-are-gaps-design.md`; every Voice on one time line
  (`PlacedBar.voices`), stems, rests and heads by Voice —
  `2026-11-04-tab-voices-drawn-edited-design.md`.
- `rows.ts` — `rowsFor` (the rows each line uses, top to bottom: words,
  the staff, the tab's marks, the tab, and the Lyrics' row in each view), `textRowOf`, the staff's `stepY`
  and `SPACE`, and the bend constants with `bendShape` (issue #413).
- `widths.ts` — how wide each thing on a line is drawn: `columnWidth`,
  `noteInset`, `noteLabel`, `chordWidth` and `prettyChord`, a bar's lead,
  key signatures, heads and accidentals (`signRoom`) (issue #413).
- `voiceLayers.ts` — each other Voice as a layout and a part of its own,
  so `TabClip` draws it as it draws the part's own, muted while editing.
- `layoutText.ts` — the words over the tab and the signatures: sizes,
  boxes, and `textAt` — `2026-10-26-tab-words-design.md`.
- `beatText.ts` — free text over a column: its size and `wrapBeatText`,
  which breaks a long one onto more lines — `2026-11-03-tab-text-wrap-design.md`; and
  `textGoesUnder`, which puts a short one under the chord names (`Rows.textUnder`) —
  `2026-11-07-tab-short-text-under-chords-design.md`; and `beatTextLines`, the
  wrapped lines as bold and plain runs to draw — `2026-11-09-tab-text-markdown-design.md`.
- `textMarks.ts` — a Text's `**bold**` read by the Chat panel's Markdown
  reader with only bold on, and `toggleBold` for Ctrl/⌘+B in the Text field —
  `2026-11-09-tab-text-markdown-design.md`.
- `sectionText.ts` — a section over its bar: its size, `sectionBoxes`, and
  `placeSections`, which wraps a long one and moves it up if it still
  runs into the next —
  `2026-11-06-tab-section-overlap-design.md`.
- `lyrics.ts` — the Lyrics under the notes: their size and room, which
  notes take a syllable (`takesLyric`), `setLyric`, and where the Lyrics
  field goes next (`lyricNote`) — `2026-11-09-tab-lyrics-design.md`.
- `stackWords.ts` — words along a line that wrap and move up clear of each
  other, without moving the music: the Text's and the section's rule.
- `hitTest.ts` — what a press is on (a string at a column, a staff line, a
  gap, a stem via `rhythmAt`) and where the cursor is drawn.
- `runs.ts` — where marks over runs of columns are drawn (vibrato, let
  ring, P.M.) and legato joins.
- `beams.ts` — which notes a beam joins: by the Beat groups (or the beat),
  plain eighths four together in 4/4, then each note's Beam override
  (`beamGroups`, `isBeamable`, `unbeamed`) —
  `2026-11-04-tab-beat-groups-beams-design.md`.
- `spans.ts` — the Spans (let ring, P.M., vibrato, octave lines, hairpins):
  which columns one covers, and moving its ends (`clampSpan`, `moveSpan`)
  — `2026-11-04-tab-pick-every-mark-design.md`.
- `attachment.ts` — what a picked Mark belongs to: its notes' tint, its
  Attachment lines and a Span's Handles —
  `2026-11-04-tab-pick-every-mark-design.md`.
- `marks.ts` — where each technique mark is so a press picks it, its
  palette tool, `markLights`, `mordentSign` —
  `2026-10-27-tab-pick-marks-design.md`.
- `barLines.ts` — the repeat signs, ×N counts and double bar lines a press
  picks; `hasEdit` (issue #276).
- `elements.ts` — every pickable thing in reading order, for Alt+← →
  (MuseScore's next element, issue #238).
- `rangeBox.ts` — the box round a selected run, and its Range handles:
  where they are and where a dragged end lands —
  `2026-11-05-tab-range-handles-design.md`.
- `rectangle.ts` — Shift+drag from blank space: the rectangle and the run
  of columns it takes in (issue #238).
- `dynamics.ts` — a dynamic's letters (`dynamicWord`) and where a hairpin
  beside one stops (`hairpinSpan`) — `2026-11-09-tab-dynamics-design.md`.
- `whammy.ts` — where the whammy bar's lines and labels go, `whammyJoins` —
  `2026-10-29-tab-whammy-design.md`.
- `fieldSpots.ts` — where the fields and panels over the tab open.

## Editing (pure)

- `editing.ts` — the cursor, selection and frets; edits that add, move or
  remove columns and bars; `normalize`, cut, copy, `pasteOver`,
  `insertPaste`, `insertTime`, `clearToRests` —
  `2026-10-25-tab-editing-design.md`,
  `2026-10-31-tab-bars-stay-full-design.md`.
- `timeline.ts` — the edits that change time, on a Voice as one stream
  with the bar lines taken out, laid back into bars by their time
  signatures: write over (`writeOver`, `writeSpan`), push (`pushTime`),
  pull back (`pullTime`), re-bar after a time signature or Pickup bar
  changes (`reBar`, `reBarClip`) and Move extra (`layFrom`) —
  `2026-11-04-tab-bars-always-full-design.md`.
- `noteEdits.ts` — the palette's changes to notes: rhythm, marks, joins,
  bends, and `changeLength` — `2026-11-01-tab-rest-lengths-design.md`; the
  Beam override tools (`setBeam`, `beamLit`, `canBeamTarget`).
- `tuplets.ts` — tuplets and grace notes that keep bars full: a tuplet over
  one note (`tupletOver`), a selection squeezed (`squeezeTuplet`), a tuplet
  taken away (`untuplet`), lengths and frets inside one (`lengthInTuplet`,
  `typeInTuplet`), Tuplet entry's first note (`startTuplet`), and a grace
  note added or removed (`addGrace`, `enterGrace`, `removeGrace`) —
  `2026-11-04-tab-tuplets-grace-rest-design.md`.
- `ties.ts` — a Tie chain as one note: where it starts and ends
  (`chainStart`, `chainPlaces`), a move past it as one stop (`overTiedOn`), the notes an edit on a selection takes
  (`takenNotes`), its length (`lengthAnchor`, `chainDuration`), what is
  drawn picked with it (`litTiedNotes`) and T, which ties forward
  (`tieForward`, `tieOnInput`) —
  `2026-11-04-tab-ties-forward-design.md`.
- `voices.ts` — editing every Voice: a selection's runs in the other
  Voices (`voiceSelections`), an edit run on each (`perVoice`), the string
  clash check (`clashMessage`), Move to voice (`moveToVoice`), copy and
  paste of several Voices (`sliceVoices`, `pasteVoices`) and Alt+← → by
  time across them (`stepAcrossVoices`) —
  `2026-11-04-tab-voices-drawn-edited-design.md`.
- `barEdits.ts` — the words over the tab and what a bar carries (repeats,
  endings, double bars, signatures, the Pickup bar), and an Uneven bar's
  fixes (`moveExtra`, `fillWithRests`, `makePickup`), and a time
  signature's Beat groups (`setBeatGroups`).
- `sounding.ts` — a part's Voice's Columns read as Sounding notes (`readVoice`) and
  written back by the meter (`writeVoice`, `spell`, `beatGroups`) —
  `2026-11-03-tab-sounding-notes-design.md`.
- `rewrite.ts` — after every edit (`clipAction`'s replacePart, `commit`),
  the bars whose rhythm changed written again by the meter (`rewrite`),
  and the cursor and selection moved to the same time (`cursorAtTime`,
  `selectionAtTime`) — `2026-11-03-tab-rests-are-gaps-design.md`.
- `normalMode.ts` — normal mode's edits: MuseScore's length digits, frets
  ±1, the next note in a chord, dragging a fret to another string —
  `2026-10-30-tab-note-input-mode-design.md`,
  `2026-10-31-tab-drag-fret-string-design.md`.
- `inputLength.ts` — note input mode's length, set before a note goes in.
- `grid.ts` — note input mode's grid, as Dorico's rhythmic grid: ← → stop at
  each grid line inside a rest and once on a note, a note entered there
  splits the rest, a press snaps to the nearest stop, Shift+Space moves on
  by note input mode's length — `2026-11-01-tab-note-input-grid-design.md`.
- `jumps.ts` — Ctrl/⌘+← → a bar, Home / End, with Shift growing the
  selection — `2026-10-30-tab-musescore-selection-design.md`.
- `staffEntry.ts` — the staff's own cursor, the string and fret chosen for
  a note entered on the staff, `moveNotes` —
  `2026-10-27-tab-staff-entry-design.md`,
  `2026-10-28-tab-staff-drag-design.md`.
- `tools.ts` — the palette's table (name, key, edit, whether lit), shared
  by the palette, the keys and the `?` overlay.
- `editorKeys.ts` — the keys on the tab, on the staff cursor and on the
  playback line: `editorKeyDown` tries the keys every mode takes first,
  then the mode's own, then the shared ones; normal mode's keys
  (`normalKeyDown`) are here too.
- `noteInputModeKeys.ts` — note input mode's own keys: frets typed on the tab,
  letters and Enter on the staff caret, the next note's length, the caret
  between staff and tab, ← → through a rest's grid lines, Shift+Space and
  Insert.

## Drawing

- `TabClip.tsx` — draws a layout as SVG (a `memo`), with the cursor and selection;
  keeps the hit testing and the layers, and draws each line's strings and notes
  with the parts below. `rangeBoxes`.
- `ClipWords.tsx` — `SystemWords`: the words over a line (endings, the capo,
  sections, tempos, "Free time", chord names and their diagrams, free text),
  and the Lyrics under its notes with their hyphens.
- `ClipMarks.tsx` — `SystemRowMarks`: the marks in their own rows over the tab
  (P.M., let ring, w/ bar, fermatas, hairpins, dynamics, vibrato, mordents,
  strokes, `WahMark`, accents).
- `ClipBars.tsx` — `BarDrawing` (bar lines, repeat signs and counts, double
  bars), `TimeNumbers` (a time signature on the tab) and `StaffJoin` (the
  bracket joining staff and tab).
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
- `chordDiagrams.ts` — which chords draw a diagram (a `\chord` with a shape), the Chord chart's chords and
  layout, and the diagrams under the names (`drawnOnLine`) — `2026-11-06-tab-chord-diagrams-design.md`.
- `ChordGrid.tsx` — one chord diagram in plain ink, upright or lying, for the page and the image.
- `ChordChart.tsx` — the Chord chart under the score head, on the page and in the image; on the page each chord is picked by a press and opens Edit chord on a double-click, Enter or right-click Edit.
- `leadSheet.ts` — the lead sheet's grid (issue #295): `layoutLeadSheet` (rows of
  bar boxes: chord names at their time, carried into bars with no new one, a
  slash per beat, signatures, repeats, sections, texts, the Lyrics under each
  row), `leadAt` for presses,
  `leadCaret`, `leadPlayX`, `leadWordSpot` and its keys (`leadKey`) —
  `2026-11-08-tab-lead-sheet-design.md`. `Show`, the switch's four choices,
  is in `layout.ts` beside `Parts`.
- `LeadSheetDrawing.tsx` — draws it (`LeadSheetDrawing`, the page's and the image's),
  takes presses on the page (`LeadSheet`) and draws the playhead over it
  (`LeadPlayhead`).
- `ScoreHead.tsx` — the score's head: title, artist and credits, tuning;
  `HeadPick`, `FoldedTitle` — `2026-10-28-tab-score-head-design.md`,
  `2026-11-01-tab-arrangement-header-design.md`,
  `2026-11-01-tab-tuning-collapse-design.md`.

The Sweet Child and book-marks specs (`2026-10-28-tab-sweet-child-*`,
`2026-10-29-tab-book-marks-design.md`) set how printed guitar books draw
ties, bends, grace notes, mordents, wah, fermatas and free time.

## Palette, panels and fields

- `TabPalette.tsx` — the symbol palette, Guitar Pro style, from `tools.ts`; draws all its groups or only some (`groups`); Duration's note values get a row of their own, shortest to longest (`docs/specs/2026-11-09-tab-duration-row-design.md`); the Input group holds the note input mode pencil and, after it, the Grid button naming its setting (`2026-11-01-tab-note-input-grid-design.md`, issue #449).
- `TabRail.tsx` — the tools in a rail of panels on the clip's left, as Dorico has them: Notes (note input mode and the Grid, Duration, Rhythm), Articulations (Joins, Bends, Techniques, Accents), Bars (Bars, Text), Chords (`ChordPanel.tsx`) and Chat (`chat/ChatPanel.tsx`), one open at a time and kept across visits in `frets.tab.layout` with the panels' width, set by dragging the line between the panel and the clip (`docs/specs/2026-11-08-tab-rail-width-design.md`, issue #431); it grows into the page's left margin, so the clip keeps its right edge (`docs/specs/2026-11-02-tab-rail-design.md`, issue #301).
- `chat/` — the Chat panel (`docs/specs/2026-11-08-tab-chat-design.md`, issue #424): `ChatPanel.tsx` the panel; `useChatSession.ts` its conversation and running reply, held by the page so they outlast the panel, and the status the rail's Chat button shows (issue #442); `markdown.ts` and `ReplyMarkdown.tsx` a reply's markdown read and drawn as elements, never HTML (`docs/specs/2026-11-08-tab-chat-markdown-design.md`, issue #427); `reply.ts` one reply's loop of model calls and tool runs, and the system prompt (the instructions, the agent guide, the custom prompt; `docs/specs/2026-11-09-tab-chat-prompt-design.md`, issue #426); `guide.ts` the agent guide fetched once a visit; `promptFields.tsx` Settings' Instructions and Custom prompt fields; `arrangementTools.ts` the tools a model gets (read the arrangement with numbered bars, replace a run of bars or the whole) and how each is checked by the alphaTex reader; `openRouter.ts` the call to OpenRouter from the browser with the viewer's key; `chatPrefs.ts` Settings › Tab › Chat (`frets.tab.chat`, with the default instructions).
- `ChordPanel.tsx` — the rail's Chords panel: the track's Chord set as diagram tiles, each with a dot counting its uses (none when unused), as many to a row as the panel's width holds and two rows to a page (folding, kept in `frets.tab.chordPanel`), each with a right-click menu (Insert, Edit, Rename, Copy to new chord, Delete when unused); + to add a chord; Insert name, notes or both at the cursor for the chord picked, its button saying where; the Hear toggle in the panel's head (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issues #251 and #400).
- `ChordEditor.tsx` — under the Chord set: Edit chord (`ChordShapesEditor`), opened by a tile's double-click or Edit or a chord name's in the tab, its name renamed apart and a shape picked applying at once; and the chord dialog (`ChordEditor`), the same for + (Add chord), Copy to new chord and Edit chord's Change chord (Save chord, or Save as new chord): a chord's name (free text, following the chord until typed), its root and type (or a name looked up), its shapes and `ShapeEditor` to draw your own.
- `chordShapes.ts` — a chord name read into a chord, its shapes on a track's tuning, a shape both ways round, and the names and fingering of a column's notes; shared by the panel and the dialog.
- `LyricField.tsx` — the small Lyrics field Shift+L opens over the staff at a note, as Dorico's lyrics popover (its grip drags it out of the way): Space, hyphen, Shift+Space, Up and Down set the syllable and move on (`useHeadPanels` keeps it going note to note, where it was dragged to); Alt+Space and Alt+hyphen type their character — `2026-11-09-tab-lyrics-design.md`.
- `BarTimePanel.tsx` — the time signature from a bar on, its Beat groups
  field (for 5 beats or more, or a bar with groups of its own), and bar 1's
  Pickup field.
- `BarFixPopover.tsx` — an Uneven bar's ⚠, pressed: its fix.
- `TupletPanel.tsx` — the Tuplet panel `;` opens at the cursor, kept to the keyboard.
- `TimeSignatureFields.tsx` — the time signature panel's two fields.
- `BarKeyPanel.tsx` — the key signature from a bar on (`\ks`).
- `barPanel.ts` — keeps the bar panels inside the tab.
- `WordField.tsx` — the field over the tab for a chord name, text, section,
  capo, ending number or repeat count — `2026-10-26-tab-words-design.md`; the
  Text's is a textarea taking Shift+Enter and Ctrl/⌘+B —
  `2026-11-09-tab-text-markdown-design.md`.
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
- `rolls.ts` — how much a Downstroke or Upstroke chord, a Strum and a Rolled
  chord roll in playback, from Tab › Playback (issue #385) —
  `2026-11-06-tab-chord-rolls-design.md`.
- `seamlessLoop.ts` — loops the synthesizer with no gap at the loop's end
  (issue #346) — `2026-10-26-tab-playback-design.md`.
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
- `BpmField.tsx` — Speed's bpm field, its "bpm" a Tap button reading
  "Tap" on hover; show_tab's too — `2026-11-05-tab-speed-bpm-design.md`.
- `PinnedPlayback.tsx` — keeps the footer at the window's bottom while the
  card runs past it — `2026-10-28-tab-pinned-playback-design.md`.
- `PlaybackOptions.tsx` — Play's right-click menu —
  `2026-10-27-tab-playback-options-design.md`.
- `ClickOptions.tsx` — the Metronome toggle's right-click menu: count-in
  and click volume.
- `FxButton.tsx` — FX and its light switch, and the FX dialog.

## The MCP App (`show_tab`)

Issue #340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`: a line of
guitar music in a chat, on Frets' MCP server (`src/mcp/README.md`). The
model writes the line as JSON (the clip model, notes on a `string` and
`fret` or at a `pitch`); the app draws and plays it, and nothing is edited
or saved. Standard tuning only.

- `mcp/tool.ts` — the tool's name, description and zod input; the whole
  schema is in the definition, so its descriptions stay short.
- `mcp/lineJson.ts` — `lineFromInput` checks a call and makes its `Part`
  (pitches placed by `choosePlace`, as in staff entry; full bars; joins
  with a note to join), each error naming the bar and column; `lineOf`
  turns a `Part` back into the JSON, every note on its string and fret;
  `describeLine`; `loopPoints`, `loopOf` and `describeLoop` for the loop
  points a call sets and the model hears back.
- `mcp/register.ts` — `show_tab` and its app's resource. The result is a
  line of text with the Frets link, and the checked line for the app.
- `mcp/TabApp.tsx` — the app: shows the call's line and loop points, tells
  the model when the user changes the bpm or the loop points, unmounts the
  line on teardown so the sound goes.
- `mcp/ChatTab.tsx` — the line as the chat shows it: `TabClip`, the
  playhead and the loop bracket with its handles, then Play, Loop (L), the
  bpm (its "bpm" taps, T too; `BpmField`), Staff | Tab | Both and Open in
  Frets; a selection, made as on the Tab page, only for Loop to loop.
- The app's entry is `mcp/apps/tab/` (`main.tsx` builds the steel-string
  guitar's soundfont in, `setBuiltInFonts` in `playback.ts`), built to
  `mcp/dist/tab.html`.

## Specs

The principles every editing spec since step 1 follows, with Dorico,
MuseScore and Guitar Pro 8 compared: `docs/tab-editing-principles.md`.

- `docs/specs/2026-11-08-tab-lead-sheet-design.md`: Lead sheet, a fourth
  choice beside Staff, Tab and Both (`?show=lead`): a bar grid with the
  chord names at their time and a slash per beat, the Chord chart on
  top; chord names, sections and texts edited there, notes not (issue #295)
- `docs/specs/2026-11-09-tab-dynamics-design.md`: dynamics (alphaTex `dy`)
  drawn on the hairpins' row, entered with Shift+D or the Dynamic tool,
  picked, edited and deleted like any Mark (issue #437).
- `docs/specs/2026-11-09-tab-lyrics-design.md`: Lyrics, a syllable on a
  note per Lyric line, read and written as alphaTex `lyrics`, drawn under
  the staff, between staff and tab, or under the tab; typed with Shift+L as
  in Dorico; MusicXML and ASCII carry them (issue #408)
- `docs/specs/2026-11-08-tab-rail-width-design.md`: drag the line between
  the open Rail panel and the clip to set every panel's width, 224 to 560px,
  kept across visits (issue #431)
- `docs/specs/2026-11-09-tab-duration-row-design.md`: the palette's note
  values on a row of their own, shortest to longest, over the Grid button,
  dot and rest
- `docs/specs/2026-11-09-tab-chat-prompt-design.md`: Settings › Tab › Chat
  edits the system prompt's instructions (with Reset to default), shows the
  alphaTex guide read-only, and adds a custom prompt sent last (issue #426)
- `docs/specs/2026-11-08-tab-chat-markdown-design.md`: the Chat panel draws
  a reply's markdown, links in a new tab, never raw HTML (issue #427)
- `docs/specs/2026-11-08-tab-chat-design.md`: the Chat panel, on
  the rail for everyone since 2026-11-09: ask a model through OpenRouter about the arrangement or for a
  change; each reply's changes are one Undo step (issue #424)
- `docs/specs/2026-11-06-tab-delete-keeps-marks-design.md`: Delete and cut
  leave rests that keep the column's text, chord name and other marks of
  its time; a note written over them takes them; only Ctrl/⌘+Delete
  removes them (issue #393)
- `docs/specs/2026-11-06-tab-section-overlap-design.md`: a long section
  name wraps, and moves up a row if it still runs into the next (issue #389)
- `docs/specs/2026-11-06-tab-show-link-design.md`: a link's
  `?show=staff|tab|both` picks what the Notation view shows for that visit,
  unsaved
- `docs/specs/2026-11-05-tab-range-handles-design.md`: a selection box's
  left or right edge drags that end, the other staying
- `docs/specs/2026-11-05-tab-speed-bpm-design.md`: Speed as one bpm
  field, its percentage in the caption and its "bpm" a Tap button, on
  the Tab page and in show_tab (issue #373).
- `docs/specs/2026-11-05-tab-chord-panel-design.md`: the rail's Chords
  panel, opened at a chord by its name's Edit or double-click: the Chord
  set as tiles with a right-click menu, Edit chord (its shapes, its name
  renamed apart), one chord dialog for adding and changing a chord,
  deleting an unused chord, and Insert (issues #251 and #400)
- `docs/specs/2026-11-05-tab-chord-set-design.md`: each track's Chord
  set, its `\chord` shapes kept in the clip and its chord names understood
- `docs/specs/2026-11-05-show-tab-selection-design.md`: select notes in
  the show_tab app, as on the Tab page, and Loop loops them
- `docs/specs/2026-11-05-tab-shift-press-grows-design.md`: a Shift+press
  outside the selection only grows it; inside, it trims the nearer end
- `docs/specs/2026-11-05-show-tab-loop-points-design.md`: loop points in
  show_tab, set by the model and dragged by the user in the chat
- `docs/specs/2026-11-04-show-tab-mcp-app-design.md`: a line of guitar
  music in a chat as staff over tab that plays (show_tab), then generated
  phrases and progressions (show_phrase)
- `docs/specs/2026-11-04-tab-voices-drawn-edited-design.md`: every Voice
  drawn, exported and edited, one at a time: the Active voice, Alt+1–4,
  the others muted while you edit, selections over every Voice as Dorico
- `docs/specs/2026-11-04-tab-pick-every-mark-design.md`: every Mark can
  be picked: P.M. and let ring lines, signatures, staff stems and beams;
  Spans get a Handle at each end; a picked Mark shows an Attachment line
  and tints its notes
- `docs/specs/2026-11-04-tab-beat-groups-beams-design.md`: beams follow
  the Beat groups; a Beat groups field for time signatures of five or
  more; Break before and Join to previous per note
- `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`: tuplets take
  a note's time or squeeze a selection, grace notes are added before;
  Tuplet entry and Grace entry in note input mode; `,` is Rest; Dorico's keys
- `docs/specs/2026-11-04-tab-ties-forward-design.md`: T ties forward;
  a Tie chain is picked, deleted, lengthened and re-fretted as one note;
  Alt+press picks one Tied note for its own marks
- `docs/specs/2026-11-04-tab-bars-always-full-design.md`: no edit makes an Uneven bar: long notes
  write over and tie by the meter, runs are laid out again, Insert and
  Ctrl/⌘+Delete push and pull every Voice, time signatures re-bar, the
  Pickup bar, the ⚠'s fixes; the Fill setting goes
- `docs/specs/2026-11-03-tab-rests-are-gaps-design.md`: rests are Gaps
  written by the meter after each rhythm edit; an empty bar is one
  Whole-bar rest; a rest's length can't be set
- `docs/specs/2026-11-03-tab-voices-design.md`: up to 4 Voices per Track,
  read and written as alphaTex `\voice`; Voice 1 drawn and edited, every
  Voice played
- `docs/specs/2026-11-03-tab-sounding-notes-design.md`: Sounding notes
  read from Columns and written back by the meter (no visible change)
- `docs/specs/2026-11-03-tab-text-wrap-design.md`: a long Text over a
  column wraps onto more lines
- `docs/specs/2026-11-07-tab-short-text-under-chords-design.md`: a short
  Text goes under the chord names and their diagrams, a long one over
- `docs/specs/2026-11-09-tab-text-markdown-design.md`: `**bold**` and new
  lines in a Text; Ctrl/⌘+B and Shift+Enter in its field
- `docs/specs/2026-11-03-tab-test-arrangements-design.md`: test
  arrangements, the `editing_tests/` folder and its skill
- `docs/specs/2026-11-01-tab-note-input-grid-design.md`: note input mode's grid,
  following note input mode's length or fixed, and ← → / Shift+Space by it
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
- `docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`: edits work on
  Sounding notes; the Clip stores written Columns
- `docs/adr/2026-11-03-part-is-one-voice.md`: a Part is one Voice of one
  Track; other Voices ride along read-only
- `docs/adr/2026-11-05-tab-editing-follows-dorico-musescore-gp8.md`: Tab
  editing is self-consistent and follows Dorico, then MuseScore, then
  Guitar Pro 8; guitar use cases only
