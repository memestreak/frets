# Tab: the lead sheet

Issue #295. Asked 2026-11-01 (Jeremy): tablature that defines the chord
shapes once at the top and then writes the song by chord name only. On
2026-11-05 it became a view of the same arrangement first; the look and
its details were settled on 2026-11-08 in the design doc
(https://claude.ai/artifact/2S7AMm8K72BGVHZ1pKeQhV, mocks in the project
files under `tab-editor/lead-sheet/`). Lyrics (issue #408,
`2026-11-09-tab-lyrics-design.md`) landed first; the grid draws them.

## What

- **Where.** A fourth choice in the switch over the clip: Staff | Tab |
  Both | Lead sheet. It is saved as the other three are (Tab › Notation's
  Show, listed in Settings), and a link opens it for one visit with
  `?show=lead` (`2026-11-06-tab-show-link-design.md`).
- **The look: a bar grid.** No staff and no tab: a box per bar, as iReal
  Pro and Nashville charts draw it. The score head and the Chord chart
  stay at the top, as in the other choices.
- **A row.** As many boxes as the arrangement's own bars per line (its
  `\systemsLayout` / `\defaultSystemsLayout`, read whether or not View
  options' "Clip's line breaks" is on), four when it sets none. Every box
  in a row is as wide as the row's count allows, so a short row's boxes
  line up with a full row's. A section starts a new row. On a narrow page
  a row holds fewer boxes, never one narrower than about 90 px.
- **Chord names**, large, each at its time in the bar: a change on beat
  3 of 4/4 starts halfway across the box. Names that would touch are
  drawn smaller, down to about half size.
- **A bar with no new chord** shows the chord that is still sounding,
  its name again at the bar's start. So does a bar whose first new chord
  comes after its start.
- **Slashes.** A light slash on each beat that has no chord starting on
  it and no name drawn over it. A beat is the time signature's beat over a
  quarter or longer (4/4: four, 2/2: two), else its Beat group (6/8: two,
  7/8 as 2+2+3: three).
- **A silent bar** (no notes in any Voice, and no chord name) is an empty
  box: no name, no slashes. The chord carried on is not forgotten: the
  bar after it shows it again.
- **Time signature**: small, stacked, before the first box, and again at
  each bar that changes it: in front of the box when it starts a row,
  just inside the box's left edge when it doesn't.
- **Repeats and endings** on the box edges: a repeat's start and end as
  thick-thin lines with dots, "×3" over the end for three or more times;
  a 1st, 2nd … ending as a bracket over its boxes; a double bar as two
  thin lines; the arrangement's end as a thick line.
- **Sections** over their row, bold, with the rehearsal mark boxed first.
  **Texts** in a small row over the boxes, at their time.
- **Bar numbers** small in each box's top-left corner, as View options'
  Bar numbers say (every bar, first on each row, or none).
- **No diagrams under the names.** The Chord chart at the top shows every
  shape once; View options' Chord diagrams is not listed while the lead
  sheet shows, nor is "Clip's line breaks".
- **Lyrics** (issue #408) under each row of boxes, as decided on
  2026-11-08: each syllable starts at its note's time in its bar, in the
  Lyrics' own size, each Lyric line under the one before; a joined
  syllable's hyphen sits halfway to the next. A syllable that would touch
  the one before is pushed on; when that would take one out of its bar or
  off the row, the row's Lyrics are drawn smaller (down to about 8 px).
  Another Voice's are drawn muted. A row with none keeps a small gap. They
  are drawn, not edited, here: Shift+L and a press on one do nothing, as
  for the notes they belong to.

### Editing

- **Chord names, sections and texts**, as on the staff and the tab
  (`2026-11-01-tab-double-click-edit-design.md`): a press picks one, blue;
  Enter, a double-click or the right-click menu's Edit edits it (a chord
  name opens the Chords panel at it); Delete or the menu takes it away.
  A chord name carried into a later bar is not a chord there: a press on
  it puts the caret on that beat.
- **The caret.** A press in a box puts the caret on that beat: on the
  column sounding at the beat's start (an empty bar's first place). It is
  a thin blue line across the box. Left and Right move it a column,
  Ctrl/⌘+Left and Right a bar; Esc, or a press outside the boxes, lets
  it go.
- At the caret, C or the Bars panel's Chord name, Text and Section open
  their fields, and the Chords panel's Insert puts a chord in.
- **Notes cannot be edited** in the lead sheet: digits, the length keys,
  N and the other palette tools do nothing here. A right-click with nothing
  picked opens no menu.

### Playback

- As written, the same as in the other choices: Play, Space, L and the
  footer work. A playhead line moves through the boxes at the time heard,
  and the playback line Stop leaves (with "Stop leaves the cursor where it
  stopped") is drawn at its column's time. The loop's bracket and handles
  are not drawn here.

### The rest, as elsewhere

- The track shown; the Chord chart follows its own setting (issue #406).
- A name with no shape in the Chord set is still drawn as a name.
- Export's PNG and SVG (and Copy as PNG) draw the grid under the head and
  the chart, at the page's Size and colours. MusicXML, Guitar Pro,
  alphaTex and ASCII are unchanged.
- The AlphaTex and ASCII Tab views are unchanged.

## Not now

- Typing Lyrics in the lead sheet, and chord-sheet import and export
  (#295's follow-ups).
- A strummed chord-per-beat playback (#364).
- Key signatures and tempo changes in the grid (the head shows the first
  tempo).

## Tests

- `?show=lead` reads as the lead sheet and draws it, saving nothing;
  `shareLink(…, 'lead')` writes `?show=lead`.
- The switch has four choices; pressing Lead sheet draws the grid and
  saves `show: 'lead'`; Settings › Tab › Notation lists Lead sheet.
- Four bars to a row with no line breaks; `\defaultSystemsLayout 3` gives
  rows of three; a section on bar 3 starts a row there; a 300 px width
  holds fewer than four.
- A bar with no new chord draws the name again; a chord on beat 3 of 4/4
  is drawn halfway; G on beat 1 draws slashes on beats 3 and 4 only
  (beat 2 is under the name); 6/8 has two beats and 7/8 (2+2+3) three.
- A silent bar has no name and no slashes; the bar after it draws the
  chord carried on.
- The time signature is drawn before the first box and at a change, not
  on other bars.
- A repeat's start, end and ×3, an ending's bracket, a double bar and the
  end's thick line are drawn on the edges.
- A press in a box puts the caret on that beat's column; Right moves it a
  column; a press on a chord name picks it (blue); Delete takes it away;
  Enter opens the Chords panel at it; C opens the chord name field at the
  caret; digits change no note.
- A press on a section picks it and a double-click opens its field.
- The playhead line is drawn in the box of the column heard.
- The exported SVG with the lead sheet shown draws the grid, not a tab.
- Lyrics: each syllable from its note's time under the boxes, a joined
  one's hyphen between it and the next; a second Lyric line 15 under the
  first, the row taller for it; syllables never touch, and a crowded row
  draws them smaller, each starting in its own bar.

## How

- `leadSheet.ts` (pure): `Show`, `SHOWS`, `SHOW_NAMES`, `partsOf`;
  `layoutLeadSheet(clip, width, barNumbers)` → rows of boxes (names,
  slashes, signatures, repeats, sections, texts); `leadAt` for presses;
  `leadCaretX` and `leadTimeX` for the caret and the playhead;
  `leadWordSpot` for the fields; `leadKey` for the keys.
- `LeadSheetDrawing.tsx`: draws a lead layout as SVG (`LeadSheetDrawing`, also
  in the image) and, on the page, takes presses and draws the caret and
  playhead (`LeadPlayhead`).
- `TabPage.tsx`: the switch from `SHOWS`; with the lead sheet, the
  editor's focus target holds `LeadSheet` and its keys, `onTool` acts
  only on the word tools, N and the playback line's keys rest.
- `useHeadPanels.tsx`: a word's field opens where the lead sheet draws
  it.
- `viewOptions.ts`, `tabSettings.tsx`, `shareLink.ts`: `Show` for Show.
- `exportTab.tsx`: with the lead sheet, the image draws it.
- `shortcuts.ts`: the lead sheet's keys.
- Guides: `public/tab-alphatex.txt` section 8 and the frets-tab skill name
  `?show=lead`.
