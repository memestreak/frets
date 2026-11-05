# Tab: Voices in the arrangement and in alphaTex

Step 2 of the build order in the Tab editing principles
(`docs/tab-editing-principles.md`, choice A2). Jeremy
settled the questions below on 2026-11-03 (Q1–Q13 in the thread "Add
voices to the arrangement model", run with /grill-with-docs). Why the
editor works on one Voice at a time:
`docs/adr/2026-11-03-part-is-one-voice.md`.

An Arrangement can now hold more than one Voice per Track, read from and
written to alphaTex's `\voice`. The page still draws and edits Voice 1
only. Playback, and the alphaTex and Guitar Pro exports, carry every Voice.
Drawing every Voice, the other exports, and editing a second Voice are
step 8.

**Music with one Voice is unchanged**: its alphaTex text, drawing,
playback and every export stay as they are.

## What the page holds

- A Track has Voice 1 in every bar and up to three more (Q2). A Voice
  other than Voice 1 is absent from any bar it has no notes in (Q4).
- A Voice that is present in a bar fills it, as Voice 1 does, with its
  Gaps written as rests.
- Voices are numbered from 1 wherever the page says them ("voice 2"),
  and from 0 in code.
- Joins (tie, hammer-on, pull-off, slide) and Tie chains stay within one
  Voice: a note joins from the previous note on its string in its own
  Voice, as alphaTab reads them.

## Reading alphaTex

- `\voice` is read both bar-wise (`\voiceMode barWise`, each bar's voices
  together) and staff-wise (all of voice 1, then all of voice 2), in every
  Track (Q3).
- A Track with more than 4 Voices is refused: "Frets reads up to 4
  voices; this has 5."
- A Voice other than Voice 1 with no notes in a bar (nothing, or only
  rests) is absent from that bar.
- A present Voice that doesn't fill its bar is named by the uneven-bars
  line and ⚠ as Voice 1 is, with its Voice: "Bar 4's voice 2 doesn't add
  up to 4/4: 1 beat short."
- The import warnings name what isn't shown (Q8): "Bars 3–8 have a second
  voice, not drawn yet." With a third or fourth Voice: "Bars 3–8 have
  more voices, not drawn yet." Bars are listed as ranges, as the
  uneven-bars line lists them.
- Two Voices sounding on one string at the same time are kept and warned
  about (Q5): "Bar 3 has two voices on string 2." Strings are numbered as
  tab numbers them, 1 the high e.

## Writing alphaTex

- A clip with one Voice in every Track writes no `\voice` and no
  `\voiceMode`: its text is exactly as before.
- A clip with a second Voice anywhere writes `\voiceMode barWise` once, in
  its first lines, and writes each bar's Voices together (Q3):
  `\voice 3.3.4 5.3.4 r.2 \voice 0.6.2 0.6.2 |`.
- A bar where only Voice 1 is present is written as before, with no
  `\voice`.
- An absent Voice between present ones (voices 1 and 3 in a bar) is
  written as a whole-bar rest, since bar-wise voices are counted in order.

## Under the clip

Step 9 draws, exports and edits every Voice, replacing this section: `2026-11-04-tab-voices-drawn-edited-design.md`.

The quiet line under the clip, where the uneven-bars line goes, adds (Q8,
Q12):

- the hidden-Voice sentence, as on import, for the Track shown;
- one sentence for each bar with two Voices on one string.

Both show whenever the arrangement has them, not only after an import.

## Playback

Every Voice of the Track plays (Q6). Where two Voices sound on one string
at once, the later note cuts off the earlier one, as a real string does
(Q5).

## Exports

Step 9 draws, exports and edits every Voice, replacing this section: `2026-11-04-tab-voices-drawn-edited-design.md`.

- alphaTex and Guitar Pro carry every Voice (Q7).
- ASCII tab, MusicXML, PNG and SVG carry Voice 1 until step 8. When the
  arrangement has another Voice, the export dialog says so in the ⚠
  beside the format, where it already names what MusicXML and Guitar Pro
  leave out: "Voice 1 only; other voices aren't in this format yet." It
  goes when the format holds every Voice.

## Edits

Step 9 draws, exports and edits every Voice, replacing this section: `2026-11-04-tab-voices-drawn-edited-design.md`.

The page edits Voice 1. Other Voices (Q9):

- go with their bar when bars are added, moved or taken away;
- keep a bar from being taken away while they have notes in it: the bar
  stays, with Voice 1 as rests, as a bar another Track has music in stays
  (#237, "an edit never takes away music that isn't shown");
- are never changed by cut or Delete;
- are not copied: copy takes Voice 1 only.

Paste takes Voice 1 of what is pasted (Q11). When the pasted text has
another Voice, the paste notice says "Pasted voice 1 only." No edit puts
two Voices on one string at the same time.

## Saved arrangements

The stored shape changes, and old saved arrangements don't open
(`docs/adr/2026-11-02-no-users-yet.md`, Q10). Jeremy exports any he wants
to keep as alphaTex before this merges. Built-in arrangements are alphaTex
files and aren't affected.

## How

- `clip.ts`:
  - `TrackBar` holds `voices: Column[][]` (1 to 4; `voices[0]` is Voice
    1, possibly `[]` in an empty clip's bar; an absent Voice is `[]`, and
    trailing absent Voices are left off). `MAX_VOICES = 4`.
  - `Part` gains `voice` (from 0), the Voice its bars' `columns` are.
    `Bar` keeps `columns`, and carries the Track's other Voices read-only
    as `otherVoices` (each Voice's index and Columns, absent ones left
    out). Bars copied by an edit carry them along; a bar an edit adds has
    none.
  - `partOf(clip, track = 0, voice = 0)`; `withPart` writes `columns`
    back into `voices[part.voice]` and the other Voices from
    `otherVoices`. `keptBars` counts a bar the edit took away whose other
    Voices have notes, as it counts other Tracks'.
  - `onlyRests` and multi-bar rests: a bar is rests only when every Voice
    is.
  - `parseClip` checks `voices` (1 to `MAX_VOICES`, each Column checked).
  - `hiddenVoicesMessage(part)` and `stringClashes(part)` give the
    sentences above.
- `alphatexRead.ts`: reads every Voice, both modes, mapping the parse
  tree's bars to voices; refuses more than `MAX_VOICES`; joins per Voice.
- `alphatex.ts`: writes `\voiceMode barWise` and `\voice` as above;
  `originMarks` per Voice. `writePart` writes `otherVoices` too, so
  playback hears them; `sliceClip` (copy) drops them.
- `sounding.ts`: `readVoice(part)` reads `part.voice`; the step 1 spec's
  `readVoice(part, voice = 0)` changes to that.
- `playback.ts`: a later note on a string cuts off another Voice's note
  still sounding on it.
- `TabPage.tsx`: the line under the clip; the paste notice.
  `TabExportDialog.tsx`: the Voice 1 ⚠.
- `public/tab-alphatex.txt` and `public/skills/frets-tab/SKILL.md`: the
  page now reads `\voice`, up to 4, and draws Voice 1 only.
- `GLOSSARY.md`: Voice (done in this session).

## Tests

`src/__tests__/tab/voices.test.ts` (alphaTex, the Clip, Sounding notes,
edits, playback and Guitar Pro) and `src/__tests__/tab/page/voices.test.tsx`
(the page), with the round trips of every built-in arrangement in the
existing alphaTex and Guitar Pro tests:

- alphaTex:
  - A one-Voice clip's text is unchanged (every built-in arrangement
    round-trips exactly), with no `\voice` or `\voiceMode`.
  - Bar-wise and staff-wise texts with two Voices read to the same clip.
  - A two-Voice clip writes `\voiceMode barWise` once and
    `\voice … \voice … |` per bar, and reads back to the same clip.
  - A bar with only Voice 1 writes no `\voice`; voices 1 and 3 write
    voice 2 as a whole-bar rest and read back with voice 2 absent.
  - Up to 4 Voices read; 5 are refused with "Frets reads up to 4 voices;
    this has 5."
  - The warnings "Bars 3–8 have a second voice, not drawn yet.", the
    "more voices" form, and "Bar 3 has two voices on string 2."
  - A hammer-on in Voice 2 joins from Voice 2's previous note on the
    string, not Voice 1's.
  - Multi-track: each Track keeps its own Voices.
  - A Voice 2 of only rests in a bar reads as absent there.
  - A short Voice 2 bar gives "Bar 4's voice 2 doesn't add up to 4/4: 1
    beat short."
- The Clip:
  - `partOf(clip, 0, 1)` gives Voice 2's Columns; `withPart` puts them
    back and leaves Voice 1 alone.
  - An edit that adds a bar gives the other Voices nothing there; one that
    takes away a bar with notes in a hidden Voice keeps it, Voice 1 as
    rests.
  - `parseClip` refuses 0 or 5 Voices.
  - A bar is rests for multi-bar rests only when every Voice is.
- Sounding notes: `readVoice` reads the Part's Voice.
- Edits: cut and Delete leave Voice 2 as it
  was; copy writes no `\voice`.
- The page: the line under the clip names the hidden
  Voice and a string clash after opening a saved arrangement; pasting
  two-Voice text pastes Voice 1 and says "Pasted voice 1 only."; the
  export dialog's ⚠ says "Voice 1 only" for ASCII, MusicXML, PNG and SVG
  and not for alphaTex or Guitar Pro.
- Playback: both Voices are in the MIDI; a
  Voice 2 note on a string cuts off a Voice 1 note still sounding there.
- Guitar Pro: a two-Voice clip's file has both
  Voices.
