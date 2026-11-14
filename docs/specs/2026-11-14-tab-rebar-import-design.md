# Tab: Re-bar by time signature, on import and paste

Issue #482, phase 1 (Jeremy, 2026-11-14). He converted a 60-bar guitar tab
to alphaTex, "16th-note rests, syncopated chords and notes tied across bar
lines", and most of the work went into making each bar add up to 4/4.
Frets should lay the bar lines for him. Phase 2 of the issue is Insert
mode and phase 3 is Anchors. This spec covers only the import option and
what it reports until Anchors exist.

Words used here, from `GLOSSARY.md`: **Re-bar**, **Source bar line**,
Uneven bar, Pickup bar, Gap, Voice, Track. A "section mark" is the
musical section over a bar ("Chorus", `MasterBar.section`), not a
Settings Section.

## What the person sees

### The option

- The Import dialog has a checkbox under its text box: **Re-bar by time
  signature**, with the hint line "Notes flow into bars by the time
  signatures, tied over bar lines."
- It is a Preference, **on by default**, kept in a new Settings › Tab ›
  Import section (`frets.tab.import`, `{ reBar: boolean }`). The checkbox
  and Settings change the same saved value, as the Export dialog and Tab ›
  Export do (`2026-10-29-settings-design.md`).
- A file or text dropped on the page follows the same Preference.
- Links (`#tab=`, `#tabz=`) and built-in arrangements never re-bar.
  Frets wrote them, so their bars are already full.
- With the option off, import works as it does today: Uneven bars keep
  their ⚠ and its fixes (`2026-11-04-tab-bars-always-full-design.md`).
- A file whose bars all add up comes out the same with the option on or
  off. The option only changes files with Uneven bars.

### Paste

Paste already re-bars, so it has no option. `pasteOver` and `insertPaste`
drop the pasted bar lines and write the notes through the meter, split
and tied where they cross a bar line.

- **Paste or Insert paste into an empty clip** always re-bars the way
  Import does. Bar Marks move as described below, and misses are listed.
  Until now, pasting Uneven bars into an empty clip flowed them into a
  one-bar clip, which lost their sections, repeats, tempos and time
  signature changes. That loss goes away.
- **A copy's short first bar** (most copies start inside a bar): on paste
  only, a short first bar is placed so that it *ends* on a bar line, with
  a Gap before it, so a copy from beat 2 lands on beat 2 again and nothing
  misses (Jeremy, 2026-11-14). A short last bar is never a miss, because
  the closing bar line isn't a Source bar line. Import doesn't do this: it
  doesn't guess, and gives the Pickup hint instead.
- **Paste into a clip that already has music** doesn't change, and lists
  no misses. A paste at beat 3 would make every Source bar line miss,
  which only adds noise.

### How the notes flow

- Each Voice of each Track is read as one stream, with its Source bar
  lines taken out. The stream is laid into bars by the source's time
  signatures, and every note that crosses a bar line is split and tied by
  the meter (P1, P3, P5 in `docs/tab-editing-principles.md`). A Tie chain
  stays one Sounding note.
- Every Track gets the same number of bars, as many as the longest needs.
  A shorter Voice ends in Gaps, as `reBarClip` lays it out today.
- What sits on a Column (chord names, Text, Lyrics, dynamics, and the
  marks on its notes) moves with its notes.
- A Pickup bar written `\ac` stays a Pickup bar.
- **Free-time bars** (`\ft`) have no meter, so each one stays a bar exactly
  as written. The flow stops before it, so the bar before ends in a Gap if
  it is short, and starts again after it on a fresh downbeat.
- **A tuplet that would cross a bar line stops the import.** Nothing
  opens, and the dialog lists: "Can't re-bar: the tuplet in source bar 12
  would cross a bar line. Turn off Re-bar by time signature to import it as
  written." For a drop or a paste, the same text shows in the line under
  the clip. Frets never falls back to importing the file without
  re-barring and without saying so.
- What Frets saves is always plain alphaTex with every bar full. Nothing
  about the source bar lines is stored.

### Bar Marks

A bar's own Marks: time signature, key signature, tempo, section mark,
repeat start, repeat end, ending, double bar, free time, and Line break.

- Each source bar's Marks go to the **bar line nearest to where that
  source bar's music now starts**, meaning its first Column, whether a
  note or a rest. When the music starts exactly halfway between two bar
  lines, the Marks go to the later one, so a section mark never sits
  before its music.
- A closing Mark (a repeat's end, a double bar) closes the bar before the
  bar line its next source bar goes to.
- When two source bars go to the same bar line, the later source bar's
  Mark wins for each kind.
- A time signature takes effect from the bar line it goes to. The music
  after it is laid in the new meter.
- A Line break goes with the source bar that starts its System.
- With several Tracks or Voices, the first Track's Voice 1 decides where
  the Marks go. Bar Marks are shared by every Track.
- Example: source bar 8 is a 16th short, so source bar 9 starts a 16th
  before bar 9's downbeat. Its "Chorus" goes on bar 9, and bar 9's line is
  listed as a miss.

### The miss report

A Source bar line **misses a downbeat** when, after the re-bar, it doesn't
fall on a bar line. A missing 16th makes every later Source bar line miss,
so misses are grouped into runs, and each run gives its offset:

> Source bar lines miss a downbeat at bars 9–22 (a 16th early) and 30–60
> (an 8th late).

- Bars are numbered as the source numbers them: bar 9's line is the one
  that opens source bar 9.
- A run is consecutive Source bar lines missing by the same amount, in the
  same direction. A run of one says "at bar 9 (a 16th early)".
- **Early** means the Source bar line now falls before the nearest
  downbeat. **Late** means it falls after it. Amounts are worded as the
  Uneven bar message words them (`timeInWords`): "a 16th", "1 beat",
  "1 beat and an 8th".
- At most **4 runs** are listed, then "and N more".
- In a clip with several Tracks, each Track's sentence starts with its name,
  as the reader's other warnings do ("Lead: …"). A Voice after the first
  starts its own clause ("Voice 2: …").
- **The Pickup hint:** when source bar 1 is short and not written `\ac`,
  and the only run starts at bar 2 and runs to the last Source bar line,
  the report adds: "If bar 1 is a pickup, set its length in bar 1's Pickup
  field." Frets doesn't guess that it is one. Setting the Pickup bar
  re-bars the clip back onto the beats, as it does today.
- The report is part of the import's notice in the line under the clip,
  next to the reader's other guesses (ASCII tab's guessed durations, for
  example), and goes when they go. With the option on there are no Uneven
  bars, so the reader's Uneven bar warning doesn't show.
- No misses, no report.

Phase 3 turns each miss into an Anchor with its ⚠, and this line then
says so instead.

## What the others do

| | Re-bar on import | A source bar line that misses |
|---|---|---|
| Frets | An Import option, on by default; paste into an empty clip always | Listed as runs in the line under the clip (phase 3: an Anchor's ⚠) |
| Guitar Pro 8 | The Bar Arranger, run by hand, "repositions barlines based on the actual note durations" | Lost: the arranger keeps no trace of the old bar lines |
| MuseScore 4 | Re-bars only when a time signature changes ("some items may be lost"); an import keeps irregular bars | Not checked |
| Dorico | Bar lines always follow the meter, so there is nothing to re-bar | Not checked |
| LilyPond | Bars come from `\time`; the notes are a stream | `\|` is a bar check: a warning, nothing moves |

Frets follows Guitar Pro 8's Bar Arranger, run at import, and LilyPond's
bar check for what it reports.

## Tests

- `frets.tab.import` parses to `{ reBar: true }` when it is missing or
  malformed. Settings › Tab › Import lists it, and the Import dialog's
  checkbox shows and changes the same value.
- Every built-in arrangement, except those in `samples/`, imported with the
  option on gives the same clip as with it off, and no report.
- 4/4, `5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 7.1.4 7.1.4 |` re-barred:
  `5.1.4 5.1.4 5.1.4 7.1.4 | 7.1.4 7.1.4 7.1.4 r.4 |`, with the report
  "Source bar lines miss a downbeat at bar 2 (1 beat early). If bar 1 is a
  pickup, set its length in bar 1's Pickup field."
- A note over a bar line splits and ties: 4/4, `5.1.2 5.1.2 7.1.8 |
  9.1.1 |` gives `5.1.2 5.1.2 | 7.1.8 9.1.2.. | -.1.8 r.8 r.4 r.2 |`
  (spelled by the meter), with bar 2's line a run of one "(an 8th late)".
- Runs: source bars 8 and 22 each a 16th short, all others even, in a
  60-bar 4/4 file. The report lists "at bars 9–22 (a 16th early) and
  23–60 (an 8th early)".
- More than 4 runs: the fifth and later become "and N more".
- Bar Marks: "Chorus" on source bar 9, with bar 8 a 16th short, lands on
  bar 9. With bar 8 short by exactly half a bar, it lands on the later bar
  line. A `\ts 3/4` on a source bar that lands mid-bar takes effect from
  its nearest bar line, and the music after it is in 3/4. A repeat's end
  on source bar 8 closes the bar before the one source bar 9 goes to.
- A clash: two source bars going to one bar line, each with a tempo. The
  later one's tempo is kept.
- A tuplet that would cross a bar line: the import is refused with the
  error above, the dialog stays open, and nothing changes.
- A free-time bar stays as written. The short bar before it ends in a Gap,
  and the music after it starts on a downbeat.
- Two Tracks of different lengths end with the same number of bars, and
  each Track's misses start with its name. A Voice 2 miss reads "Voice 2:
  …".
- The option off: the same file opens with its Uneven bars and the
  reader's Uneven bar warning, as today.
- A drop follows the Preference. A `#tab=` link and a built-in
  arrangement never re-bar.
- Paste into an empty clip of Uneven bars with a section mark and a time
  signature change: both kept, placed as Import places them, and the misses
  listed. Paste of the same text into a clip with music: written as today,
  with no report.
- A Frets copy from beat 2 to the middle of the next bar, pasted into an
  empty clip: its first note on beat 2 of bar 1, a quarter's Gap before
  it, a Gap after its last note to the end of its bar, and no report. The
  same text through Import starts on beat 1 and gets the Pickup hint.

## How

- `src/features/tab/reBarImport.ts` (new, pure): `reBarImport(clip, {
  pasted })` (`pasted` puts a short first bar's end on a bar line) returns `{ clip, misses }` or a refusal naming the source bar. It is
  built on `timeline.ts`'s stream (`itemsOf`, `layStream`), laid a bar at
  a time so each source bar's start can pick its nearest bar line and its
  time signature can set the next bars' meter. `missReport(misses, clip)`
  writes the line.
- `readTab.ts`: `readTab(text, { reBar })`. With `reBar`, it runs
  `reBarImport` and swaps the reader's Uneven bar warning for the miss
  report. The readers themselves don't change.
- `useClipImport.ts`: Import and drops pass the Preference. Links and
  built-ins pass `reBar: false`.
- `TabDialogs.tsx`: the checkbox and its hint line.
- `tabSettings.tsx`: the Import section, `parseImportPrefs`.
- `TabPage.tsx` (`pasteTab`): paste into an empty clip reads the text
  with `{ reBar: true, pasted: true }`, so its bars are full before
  `insertPaste` takes the clip whole, and shows the miss report.
- `src/lib/README.md`: the new key.
- No new key on the keyboard, and no change to editing behaviour, so no
  test arrangement and no `shortcuts.ts` change.

## Sources

- Guitar Pro 8,
  [assistants (Bar Arranger)](https://www.guitar-pro.com/docs/gp8/score/assistant/note-score-assistants)
- MuseScore 4,
  [time signatures](https://handbook.musescore.org/notation/rhythm-meter-and-measures/time-signatures)
- LilyPond 2.25,
  [bars](https://lilypond.org/doc/v2.25/Documentation/notation/bars)
- Dorico Pro 6.2,
  [Insert mode](https://www.steinberg.help/r/dorico-pro/6.2/en/dorico/topics/write_mode/write_mode_insert_mode/write_mode_insert_mode_c.html)
