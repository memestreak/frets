# Tab examples

Jeremy, 2026-10-26: "a feature that allows the user (and the developer!) to
load example tab showing the syntax … a small library of sample tablature
clips that allow the user to see the features in action. The sample clips
should allow editing, but should not save. They should be static." He
expects it to make the Tab page easier to test as more of alphaTex is drawn.

## What it does

- **Examples…** in the page header, beside Import… and Export options, opens a
  dialog listing the examples. Each row is the example's name with a line on
  what it shows below it. The example being shown is filled. Choosing one
  shows it in place of the clip and closes the dialog.
- While an example is shown:
  - the line under the clip's name adds "Example: edits aren't saved";
  - a **Back to my clip** button leads the header's buttons;
  - every edit works as usual, with its own undo history, but nothing is
    saved. The saved clip (`frets.tab.clip`) is not touched.
- **Back to my clip** brings back the clip and its undo history as they were.
- An import over an example (the Import dialog, a drop, a `#tab=` link)
  replaces the clip the example set aside. The import is then saved as
  usual, and undo goes back to that clip. A paste goes in at the cursor, in
  the example.
- **Links:** `/tab#example=<id>` opens an example. The link stays in the
  address while the example is shown, so a reload or a copied link shows it
  again. Leaving the example or importing clears it. An unknown id says
  `There is no example called "<id>".` under the clip.

## The library

`src/features/tab/examples.ts`: id, name, one line on what it shows, and the
clip as the canonical alphaTex Frets writes.

| Id | Name | Shows |
| --- | --- | --- |
| durations | Durations and rests | whole to sixteenth notes, rests, dots |
| short-notes | Triplets and short notes | triplets, 32nds, 64ths, beaming |
| tuplets | Tuplets | tu 3, 5, 6 and 7 |
| grace-tremolo | Grace notes and tremolo picking | gr (one and two together), tp 8, 16, 32 |
| joins | Hammer-ons, slides and ties | h, p, sl, ss, sib, sia, ties |
| bends | Bends and vibrato | ¼, ½ and full bends, release, pre-bend, vibrato |
| techniques | Palm mute, dead notes, harmonics, tap | pm, x, nh, tt |
| accents | Accents, ghost notes and staccato | ac, hac, g, st |
| let-ring | Let ring | lr, and the note that ends the run |
| lead | Pinch harmonics, wide vibrato, slides out | ph, vw, sod, sou |
| strumming | Strummed chords | chords, sd / su, a chord tied over |
| song-form | Sections, tempo and chord names | ch, \section, \tempo, \capo |
| repeats | Repeats and endings | \ro, \rc 2 and 3, \ae 1 and 2 |
| compound-time | Six-eight time | 6/8 beamed in threes |
| time-changes | Changing time | \ts in later bars: 3/4, 7/8, back to 4/4 |
| drop-d | Drop D | a tuning, shown in the score's head |

Every feature Frets learns to draw gets an example. `examples.test.ts`
checks each one:

- it reads with no warnings;
- every bar adds up;
- its name matches;
- it writes back exactly as written.

So the library is also a test of the reader and the writer.

## Samples (2026-10-28)

Jeremy: "I would like a directory that I can drop sample alphatex files in
such that they show up automatically as examples that I can load in the app
for testing -- in the Examples... chooser."

- The folder is `src/features/tab/samples/`. Every `.atex` (alphaTex) or
  `.txt` (ASCII tab) file in it is listed in Examples… under "Samples",
  above the examples (which then get their own "Examples" heading). Each is
  titled by its `\title` (or ASCII `Title:`), else its file name, with the
  file name as its line. Nothing else needs editing.
- They open like examples (never saved; `/tab#example=sample-<name>`).
  Unlike examples they are not tests, so a sample may read with warnings.
- `src/app/tab/samples.json/route.ts` lists the folder: written once by
  `next build`, read afresh by the dev server when the page opens and each
  time the dialog opens, so a file dropped in shows up without a restart.
  A press opens the text the dialog listed, with no fetch in between, and
  closes the dialog at once (2026-10-29: a fetch per press made opening
  one feel slow); an `#example=` link fetches the list itself.
