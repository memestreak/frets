# Tab: Lyrics

Issue #408. Asked 2026-11-09 (Jeremy): "a feature request that tracks the
addition of lyrics to our tab arrangements". The ten questions and their
answers are in the design doc
(https://claude.ai/artifact/9KtZy978bFk6bp6TfW32MX); he took every
recommendation.

alphaTex already holds Lyrics: `{lyrics "Hel-"}` on a beat, and
`\lyrics "Hel-lo world"` before the bars, which alphaTab hands out one
syllable a note. Frets kept both as written but drew neither.

## What

- **A syllable on a note.** Lyrics belong to notes, as in Dorico,
  MuseScore and Guitar Pro 8: a column that is played (not a rest, a grace
  note, or notes all tied on from before) takes one syllable per Lyric
  line. It moves, copies and is deleted with its note; a rest left by
  Delete has none. Written over by a longer note, it goes with the note.
- **Lyric lines.** As many as typed (up to eight), counted from 1 in the
  page, from 0 in alphaTex: a second verse or a chorus under the first. A
  line with no syllables on a System takes no room there.
- **Joined syllables.** A syllable ending in `-` ("Hel-") is joined to the
  next one on its line: the hyphen is drawn halfway between them, or just
  after it at the end of a System. No extender lines (alphaTex has none).
- **Drawn** in every view, centred under the note, each Lyric line under
  the one before, in plain type the size of free text:
  - Staff: under the staff and everything under it.
  - Both: between the staff and the tab, under the staff's hairpins and
    over the tab's marks (strokes, P.M., let ring), as guitar songbooks
    print them.
  - Tab: under the tab's stems and tuplet numbers.
  A note with a long syllable gets the room it needs, so neighbouring
  syllables never run together. Another Voice's syllables are drawn with
  its notes, muted as they are; the lines are shared.
- **Typing (Shift+L).** Dorico's lyrics popover: with the cursor on a note,
  Shift+L (or the Lyrics button in Bars › Text) opens the Lyrics field
  on Lyric line 1; on a rest it opens on the next note, and with none
  after it says so and opens nothing. The field is small, as Dorico's
  popover (Jeremy's screenshot, 2026-11-09): the Lyric line's number in a
  tinted cell, then the text, which starts over the note. It sits over
  the staff, clear of its up stems (over the tab when only it is drawn),
  so the syllables already typed stay in sight. Its grip drags it off
  what it covers; it keeps that place as it goes note to note, and opens
  over the note again the next time. In the field:
  - Space sets the syllable and moves to the next note; a hyphen sets it
    joined ("Hel-") and moves on; Shift+Space sets it and goes back a note.
    Past the last note (or before the first) the field stays on that note,
    so the keys typed next never reach the tab as tools.
  - Down and Up set it and move to the Lyric line below or above, on the
    same note.
  - Enter sets it and closes; Esc closes, leaving the note's syllable as it
    was; leaving the field sets it.
  - An empty field clears the note's syllable. Alt+Space (Option+Space
    on a Mac) types a space in the syllable without moving on, for two
    words sung on one note, and Alt+hyphen a hyphen, as in Dorico.
  - The cursor follows the field from note to note. Each syllable set is
    one undo step.
  - While the field is open, its note is drawn as selected (blue, Jeremy,
    2026-11-09), and the syllable it set last (on the note before, after Space)
    is drawn in burnt orange (`--typing`, Fretwood's `--degree-root`;
    Jeremy's picks, 2026-11-09), as Dorico shows its last lyric. Nothing
    is orange until the field has set one.
- **Picking.** A press on a syllable picks it (blue, its notes tinted).
  Enter, a double-click or the right-click menu's Edit opens the field on
  it; Delete or the menu's Delete takes it away. Alt+← → step through
  syllables after each column's notes and marks.
- **alphaTex.** Written on each note: `lyrics "Hel-"` for line 1 alone,
  else `lyrics 0 "Hel-" lyrics 1 "Good-"` for each line that has one.
  A `\lyrics` block is read (alphaTab's rules: from its start bar, one
  syllable per note, rests skipped, Voice 1 only) and written back as
  syllables on the notes, so an arrangement typed with one does not write
  back byte for byte. That is the one exception to "writes back exactly".
- **Exports.** PNG and SVG draw what the view draws. MusicXML writes a
  `<lyric number="n">` with `syllabic` (single, begin, middle, end) and
  `text` on the staff's first note of the column. Guitar Pro (alphaTab's
  writer) carries them as it is. ASCII tab writes a line of words under
  the strings for each Lyric line, each syllable from its column, as typed
  ("Hel-"); reading ASCII back ignores those lines.
- **Agents.** `public/tab-alphatex.txt` (section 4, the checklist and a
  "Sung" example), the frets-tab skill, and through the guide the Chat
  panel's prompt, teach the note form.
- **Playback** is unchanged.

## Words

"Lyrics" for the words, "Lyric line" for each numbered line (Dorico's
word: a line may be a chorus, not only a verse). Neither is in the
glossary yet; the PR says so.

## How

1. `clip.ts`: `Column.lyrics` (one string per line, `""` where a line has
   none, no trailing `""`), checked by `parseClip`. `hasNotes` counts it.
2. `alphatexRead.ts` reads `beat.lyrics` (both forms; `\lyrics` no
   longer kept as written); `alphatex.ts` writes them on the beat.
3. `lyrics.ts`: sizes, `syllableOf`, `takesLyric`, `setLyric`,
   `lyricNote` (the field's next and last note), `lyricValue`.
4. `rows.ts`: `Rows.lyrics` and `lyricCount`, per view as above;
   `widths.ts`: `minColumnWidth` takes the syllables' room.
5. `ClipWords.tsx` draws them; `layoutText.ts` adds the `lyric` WordHit,
   its box (`lyricBox`) and press; `elements.ts` its Alt+← → stop;
   `attachment.ts` its tint.
6. `LyricField.tsx`, opened by `useHeadPanels` (`openLyric`), placed by
   `fieldSpots.lyricSpot`; the Lyrics tool and Shift+L in `tools.ts`;
   Edit and Delete in `useTabPicking.ts`; the field's keys in
   `shortcuts.ts`.
7. `sounding.ts` keeps them on a note's first piece when its bar is
   written again by the meter.
8. `musicxml.ts`, `ascii.ts`.
9. The guide, the skill, a built-in (`song_structure/lyrics.atex`) and a
   test arrangement (`editing_tests/lyrics-typing.atex`).

## Not yet

- Syllables on an empty bar's beats (a chord sheet with words and no
  melody), as their own FR if wanted.
- Extender lines (repeated Space and underscore), and a literal hyphen
  at the end of a syllable (it reads as joined).
- Dorico's Chorus line (Up from line 1), translation line (Alt+Down) and
  lyrics above the staff (Shift+Up): alphaTex can't store them (Jeremy,
  round 2 of the design doc, 2026-11-09).

## Tests

- Both alphaTex forms read: `{lyrics "Hel-"}`, `{lyrics 1 "lo"}` and a
  `\lyrics` block with a rest and two spaces; no warning either way.
- The note form writes back exactly; a block writes as notes; a quote in
  a syllable is escaped; a column whose lines are all empty has none.
- `parseClip` refuses a trailing empty line and a non-string.
- `setLyric` pads and trims lines, clears with blank, refuses a rest.
- `lyricNote` skips rests, grace notes and tied-on notes, crosses bars,
  and is null past either end.
- `lyricValue`: a hyphen joins once ("Hel--" is "Hel-"), and an empty one
  stays empty.
- Rows: Tab puts them under the stems, Both between staff and tab (tab
  lower than without), Staff under the staff; two lines are 15 apart; a
  System with none has no row.
- A long syllable widens its column.
- Drawing: a hyphen between joined syllables, after one at a System's end.
- Page: Shift+L on a note opens the field; "Hel" `-` "lo" Space "world"
  Enter writes `lyrics "Hel-"`, `lyrics "lo"`, `lyrics "world"`;
  Shift+Space goes back; Alt+Space types "a ver" and Alt+hyphen "x-y" on one note; the field's
  grip drags it, it keeps that place to the next note and opens over the
  note again next time; the field's note is drawn blue and the syllable just
  typed is drawn in `--typing` while it is open; Down types on line 2; Esc leaves it; Space past
  the last note keeps the field there; Shift+L on
  a rest opens on the next note; a press picks a syllable, Delete takes it
  away, Enter opens it in the field.
- A length change in the bar (`=`) keeps the syllable on its note; Delete
  on the note takes it away.
- MusicXML: single, begin, end and a second line's number, valid against
  the schema. ASCII: a words line under the strings, read back with no
  error.
- The Lyrics tool and Shift+L are in the `?` overlay, and the field's keys.
