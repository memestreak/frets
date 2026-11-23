# Tab: export and copy selected bars (issue #532)

Issues and PRs referenced:
[issue:frets#532](https://github.com/memestreak/frets/issues/532) FR: Export and copy selected bars from Tab;
[issue:frets#531](https://github.com/memestreak/frets/issues/531) FR: Export and copy Tab chords as the Chords page does.

Jeremy asked (2026-11-21) to select one or more bars on the Tab page and
export them the way the Chords page exports a chord. The Chords page's
right-click menu on a shape ends with **Copy as PNG** and **Export
options…** (`src/components/chords/export/useShapeExport.tsx`); issue #531
brings those to Tab's chords. This brings the same two items to Tab's bars.
Export options… opens Tab's own Export dialog
(`docs/specs/2026-10-30-tab-export-format-list-design.md`), cut down to
those bars; nothing else about that dialog changes.

The questions were put to Jeremy on a commentable page; he took every
recommendation, and asked (Q5, Q6) for the bar numbers and what the first
bar starts with to be choices.

What the others do: MuseScore's File › Save Selection… saves the selected
bars as a new score counting from bar 1, and its Image Capture snaps part
of the page, numbers as drawn. Guitar Pro 8 has no selection export.
Dorico (from memory, unchecked) exports by page or flow, not by a
selection.

## The menu items

- The tab's right-click menu (and a long press, and Shift+F10) gets **Copy
  as PNG** and **Export options…**, as on the Chords page. The words are the Chords page's: the dialog's heading
  says which bars.
- They come after the page's own items, before **Chat…**, which stays last.
- **Bar menu** (beside the notes): always. They take the bars a selection
  touches, whole, else the bar pressed: the bars Delete bar takes.
- **Note menu** (on a note): only while something is selected, and then
  every bar the selection touches, whole. On one note with nothing
  selected they aren't there.
- A word's, mark's or bar line's menu doesn't get them.

## Copy as PNG

The Export dialog's PNG of those bars, with the saved Export choices
(width, background, clip name) and the page's View options, as the clip's
own Copy as PNG makes it. The line under the tab says "Copied bars 2–3 as
PNG." ("bar 4" for one); a failure says "Couldn't copy: …" in red.

## Export options…

- The Export dialog, on those bars only, in every format (PNG, SVG, ASCII
  tab, alphaTex, MusicXML, Guitar Pro), every track as for the whole clip.
- Its heading is "Export bars 2–3" ("Export bar 4"); the page's Export
  button still opens it on the whole clip, headed with the clip's name.
- Files are named after the clip and the bars: `Riff_bars_2-3.png`,
  `Riff_bar_4.alphatex.txt`.
- It doesn't change the clip, the cursor or the selection.

## The bars cut out (`clipOfBars`)

- Every track's bars `first` to `last`, every Voice, with each track's
  tuning, capo, sound, FX and Chord set.
- The first bar says the time signature (with its Beat groups), key and
  tempo in force there, even when an earlier bar set them, as a copy of
  those bars does (`docs/specs/2026-11-15-tab-paste-keeps-key-meter-tempo-design.md`).
  A clip that sets no key (or no tempo) anywhere doesn't say one.
  Beat groups that are only the time signature's default aren't written.
- A Pickup bar stays only when bar 1 is in the range.
- A note tied over from before the first bar is a plain note there: the
  excerpt shows what sounds, and a tie from nothing can't be drawn. (A copy
  leaves such a note out, because a paste ties it on to what is there.)
- Marks set inside the range (repeats, sections, a later tempo) stay where
  they are.
- The clip's own line layout (`\systemsLayout`) was for the whole clip, so
  the cut fills its lines by width.

## The bars' image has no head (Jeremy, 2026-11-21)

An image of some bars (PNG, SVG, Copy as PNG) draws over the tab only the
clip's name, when Clip name shows: no credits, tuning, tempo or Chord
chart (`excerpt` in `TabImage`, `tabSvg`, `tabImageSize`). The whole
clip's keeps them. The files still say the key, time signature and tempo
as Start with sets.

Music none of whose lines reaches the image's width (a bar or two) is
drawn in the middle, under the centred name, not at the left
(`musicShift`); music that fills a line stays where it is. This holds for
the whole clip's image too.

The Export dialog scrolls between its heading and its buttons when it is
taller than the window, so its last row (Start with) is never cut off.

## Start with (a choice)

- Under the Format list, only for some bars and for every format: **Start
  with**, three toggles, **Key**, **Time signature** and **Tempo**, all on
  by default. Each one on says the value in force at the first bar, as
  above. Off, the first bar says only what it sets itself: no key (C
  major) or tempo, and a time signature it doesn't set is the clip's first
  (with its Beat groups). Time signature off can make the bars not add up;
  that is the person's choice.
- Saved with the Export choices (`frets.tab.export`: `startKey`,
  `startTime`, `startTempo`), listed in Settings › Tab › Export as
  "Selected bars start with the key" (time signature, tempo), and used by
  Copy as PNG too.

## More choices (Jeremy, 2026-11-21, after the first preview)

All saved with the Export choices (`frets.tab.export`) and listed in
Settings › Tab › Export; they apply to the whole clip's export as well as
to some bars', and Copy as PNG follows them.

- **Background**: **White** (the default) | **Transparent**, the image
  choice that was "Transparent background" On | Off (`transparent`).
- **Time signature**, **TAB** and **Rhythm**, Show | Hide, only while the
  page shows the tab alone (with the staff, which carries the rhythm, all
  three always stay). Hide leaves out every time signature drawn on the tab
  (the first line's and each change), "TAB" at each line's start, or the
  rhythm under the strings (stems, beams, flags, dots, tremolo slashes,
  tuplet numbers and rests), and the room each takes: the first number
  moves left, the lines get shorter (`timeSignatures`, `tabLetters`,
  `rhythm`; `LeftOut` in `layout.ts`). Rhythm is for the images; the ASCII
  tab's rhythm line still follows the View options.
- **Chord diagrams**, Show | Hide (Hide by default), in the images: a
  diagram under each chord name over the notes, whatever the page's View
  options show; Hide leaves the names alone (`chordDiagrams`, set on the
  view by `exportView`). The Chord chart still follows the View options
  for the whole clip.
- **Text annotations**, Show | Hide, in every format: Hide leaves every
  text annotation out of the image and the files (`texts`;
  `exportedClip`). The arrangement keeps them.
- A press outside the dialog closes it, as Esc and × do. A press that
  starts inside (a drag out of a field) doesn't (as `Modal` does).

## Bar numbers (a choice)

- The images' choices get **Bar numbers**: **From arrangement** (the
  default), **From 1** or **None**. Saved as `barNumbers` in the Export
  choices and listed in Settings › Tab › Export; Copy as PNG (the bars' and
  the clip's) uses it too. None draws none whatever the View options say;
  the other two draw them as the View options do (every bar, each line's
  first, or none).
- From arrangement, the images (PNG, SVG, and Copy as PNG) number the bars
  as the song does: an image of bars 9–12 reads 9 to 12, as a picture of
  the page would. The part drawn carries `firstNumber`, which `barNumber`
  counts from. For the whole clip From arrangement and From 1 are the same.
- The files (ASCII tab, alphaTex, MusicXML, Guitar Pro) are new pieces and
  count from 1, as MuseScore's Save Selection does.
- A Pickup bar isn't counted, as everywhere: the bar after it is bar 1.
  The heading and file name call it "pickup bar" ("Export pickup bar",
  "Export pickup bar to bar 2"; `Riff_pickup_bar.png`), never bar 0.

## How

1. `src/features/tab/barExport.ts`: `clipOfBars`, `barsName`, `imagePart`.
   `editing.ts` exports `tempoAt`; `clip.ts` adds `Part.firstNumber`;
   `exportTab.tsx` adds the four Export choices and `exportView`;
   `tabSettings.tsx` lists them.
2. `TabExportDialog` takes `bars`; with them it saves `clipOfBars`, draws
   `imagePart`, and names the heading and files.
3. `TabPage`: `exporting` holds the bars (null for the whole clip); the
   two menu items, on `menuBars`.
4. Tests, the test arrangement `editing_tests/export-bars-menu.atex`, the
   Tab README.

## Tests

- The cut holds only the bars asked for; all of them is the whole clip.
- Time signature, key and tempo in force at the first bar are carried; a
  later tempo inside the range stays on its bar.
- No key or tempo when the clip sets none.
- Beat groups carried; default ones not written.
- A Pickup kept only with bar 1 in range.
- A note tied over from before is plain; a tie inside the range stays.
- Every track and Voice, with its tuning and capo.
- `\systemsLayout` and `\defaultSystemsLayout` left out.
- The whole clip is left unchanged.
- `barsName`: "bar 2", "bars 2–4"; a Pickup not counted; "pickup bar",
  "pickup bar to bar 2".
- An image of bars 3–4 numbers them 3 and 4; the whole clip from 1; the
  image draws the track the page shows.
- Page: Export options… on a selection opens "Export bars 2–3", its
  preview numbered 2 and 3, the clip unchanged.
- Page: with nothing selected, the bar pressed ("Export bar 4").
- Page: the alphaTex download holds only those bars, named
  `…_bars_2-3.alphatex.txt`.
- Page: the page's Export button still exports the whole clip.
- Page: Copy as PNG copies the image of those bars, numbered 2 and 3, and
  the notice names them.
- Page: the note menu has the items on a selection, not on one note.
- Page: Shift+F10 on a selection offers them.
- Start with off: only what the first bar sets; a bar's own time
  signature kept; each toggle on its own.
- Bar numbers From 1: the cut counts from 1.
- The parser keeps the four new choices and defaults invalid ones.
- Page: From 1 and None change the preview's numbers; Start with's toggles
  are saved; the whole clip's Export has no Start with.
- Leaving out the tab's time signatures removes both of them and moves
  the first number left; TAB likewise; Rhythm removes the beams, rests and
  tuplet numbers and makes the image shorter; with the staff, nothing
  changes.
- Text annotations left out of the image and of the files' clip; the
  arrangement keeps them; the parser keeps the four new choices.
- Page: a press outside closes the dialog, a press starting inside doesn't.
- Chord diagrams over the notes only with the choice on, whatever the
  View options; Hide by default; the parser keeps it.
- Some bars' image: no tempo or Chord chart, the name alone or nothing,
  shorter than the whole clip's; the whole clip keeps both.
- Music short of the width is drawn in the middle; a full line isn't
  moved.
- Size scales the whole image: 1200 is 1.5 times 800 in height too, the
  same drawing.
- Page: the bars' Copy as PNG and preview have no tempo; the whole clip's
  preview does.
- Page: Time signature, TAB and Rhythm only with the tab alone, Rhythm's
  Hide shortening the preview; Background reads
  White | Transparent; Text annotations shows for alphaTex too.
- Page: the bar menu lists them before Chat…, which stays last
  (`barMenu.test.tsx`, `export.test.tsx`, `chatPopover.test.tsx`).
