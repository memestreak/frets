# Tab: Guitar Pro export

Jeremy asked on 2026-10-30 for a `.gp` export as a follow-up to the MusicXML
export (issue #241, approach 4; this PR's issue is #253). Guitar Pro,
MuseScore and TuxGuitar open `.gp` files, and Guitar Pro and MuseScore can
then save the song as MusicXML or PDF.

## Where

- **Export dialog:** **Download Guitar Pro** after Download alphaTex,
  Download ASCII and Download MusicXML, writing `<name>.gp`. The row's label,
  which said "As text", now says "Other formats", since a `.gp` file isn't
  text. When any track's FX are on, a red ⚠ after it says "The Guitar Pro
  file leaves out the FX.", as Download MusicXML's does.
- **Notation's Save as list:** **Guitar Pro…** after MusicXML…, through the
  browser's Save As dialog where it has one (`saveFile.ts`), as the other
  formats are.

Both write the **whole clip, every track**, as Download alphaTex does; the
images and ASCII tab are of the shown track.

## How

`guitarPro.ts` writes the clip as alphaTex (`writeAlphaTex`), reads it with
alphaTab's own reader (`AlphaTexImporter`, as playback does) and writes the
score with alphaTab's `Gp7Exporter` (Guitar Pro 7 and later: a zip holding
`Content/score.gpif`). alphaTab (1.8.4, pinned) is already loaded when the
page opens, so nothing new is downloaded. No new dependency.

## What is carried, and what isn't

The file holds what alphaTab reads from the alphaTex: the title and
credits, every track with its name, tuning, capo and General MIDI sound,
time and key signatures, repeats and endings, tempos, sections, chord
names, every beat's rhythm, and the techniques Frets draws.

Left out, because alphaTab doesn't read them:

- **The FX** (`// frets:fx`, a comment to alphaTab); the ⚠ says so.
  The alphaTex Frets keeps without drawing is carried, since alphaTab reads
  it.
- **Frets' own sounds:** the file names the General MIDI program (Steel
  Guitar, Clean Electric Guitar, Acoustic Grand Piano); the app that opens
  it plays its own.
- **View options** (bar numbers, size, colours): they belong to the page.

alphaTab's Guitar Pro reader drops a double bar on a clip's last bar, where
Guitar Pro draws the closing bar line anyway.

## Tests

`src/__tests__/tab/guitarPro.test.ts`: every built-in arrangement is
written as `.gp`, read back by alphaTab's Guitar Pro reader and compared
with the score alphaTab reads from its alphaTex: tracks, tunings, sounds,
every bar's marks, and every beat and note with its techniques. The
two-track arrangement keeps both tracks. `TabPage.test.tsx` presses both
buttons and reads the downloaded file back.

Opening a file in Guitar Pro 8 or MuseScore 4 is a manual check.
