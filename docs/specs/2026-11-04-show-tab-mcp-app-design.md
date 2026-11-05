# Staff and tab in a chat (show_tab, show_phrase)

Issue #340. A line of guitar music, drawn as staff over tab and played,
inside an AI chat: the third and fourth tools on Frets' MCP server
(`docs/specs/2026-11-01-frets-mcp-server-design.md`), beside
`show_metronome` and `show_tuner`. Asked "show me a blues phrase in A" or
"A minor pentatonic from the 5th fret, up and down", the model calls a tool
and the host (Claude, ChatGPT and other MCP Apps hosts) shows the line with
Play, a loop and a bpm field. The Tab page doesn't change, beyond the
sharing in "The app".

Settled with Jeremy on 2026-11-04, in 18 questions on a page he commented
on (https://claude.ai/artifact/FVkBJ3e9K95Vsc714yNe8V), after a brainstorm
of seven uses (in #340).

## Two tools, one app

The difference between the tools is who picks the notes (Q8). Both show the
same app.

- **`show_tab`**: the model picks every note and sends them as JSON. Use it
  for anything the model composes or recalls: a riff, a phrase, a line it
  described in words.
- **`show_phrase`**: the model names what it wants, and Frets' theory core
  picks the notes and their Spots. Its `kind` field says what to build. A
  new kind adds fields to this tool, never a new tool, so the connector
  keeps two definitions however many kinds arrive. The first kinds are
  `scale` and `arpeggio` (Q9), then `progression` (Q13, Q18).

A third, `tab_format`, returns the full input format as text. It arrives
only once `show_tab`'s schema outgrows about 1,500 tokens (see "What every
chat pays"). Until then it doesn't exist.

All are read-only and stateless; each call shows a new app.

## The input: JSON from the clip model

The model reads and writes only JSON. It never sees alphaTex (Q4, and
Jeremy's question on Q4: playback uses alphaTex inside the app, which
isn't a reason for the model to send it).

The JSON is the clip model (`src/features/tab/clip.ts`) under its own
field names, with one change: a Column's notes are a list of the notes that
sound, not six slots (Q4). Each note gives either a Spot or a pitch (Q17):

```json
{ "bpm": 90, "time": [4, 4],
  "bars": [ { "columns": [
    { "duration": { "value": 8 }, "chord": "Am", "notes": [ { "string": 5, "fret": 0 } ] },
    { "duration": { "value": 8 }, "notes": [ { "pitch": "A3" } ] },
    { "duration": { "value": 8 }, "notes": [ { "string": 3, "fret": 4, "legato": "h" } ] },
    { "duration": { "value": 8 }, "notes": [ { "string": 2, "fret": 5, "bend": { "quarters": 4 } } ] },
    { "duration": { "value": 2 }, "notes": [] } ] } ] }
```

- **`string`** is 1 (the high e) to 6 (the low E), as guitarists number
  them; the server puts the note in the clip's slot for it.
- **`pitch`** is a sounding note name with octave ("E4", "F#3", "Bb2").
  Frets picks its Spot the way staff entry does (`choosePlace` in
  `staffEntry.ts`): a free string, the fret nearest the notes around it. A
  line may mix pitches and Spots.
- **An empty `notes`** is a rest.
- **The fields** (Q3) are notes, rests, lengths with dots, triplets, ties,
  hammer-ons and pull-offs, slides, bends, vibrato and chord names, plus
  `bpm`, `time`, `capo` and `view`. Standard tuning only, as the tuner.
  Every field keeps its clip name and meaning, so growing toward everything
  a Column holds later only adds optional fields; nothing is renamed.
- **The model writes the bars** (Q5). Any number of bars (Q7).
- **`view`**: `both` (the default), `staff` or `tab` (Q10).

The mapping runs both ways: JSON to clip for input, clip to JSON for what
goes back to the model (Q4, Q15). What goes back always gives each note's
`string` and `fret`, so a pitch comes back as the Spot Frets chose.

## Checking

The server checks every call before the app draws it, with zod for each
field and then the rules that span fields:

- each bar's lengths add up to its time signature;
- strings 1 to 6, frets 0 to 24, one note per string in a Column;
- a pitch is playable in standard tuning (with the capo);
- a `legato`, `slide` (legato or shift) or `tie` has a previous note on
  its string.

A failed check answers with an error the model can fix and call again,
naming the bar and Column: "Bar 2 is an 8th over 4/4." "Bar 3, column 1:
no free string plays D2 in standard tuning (E2 to E6, frets 0 to 24)." A
field the schema refuses (fret 27) is answered by the MCP SDK before Frets
sees the call, in its own words with its path counted from 0: "Input
validation error: … bars.0.columns.2.notes.0.fret: Too big: expected
number to be <=24". The app's own check of the same input words it as the
model counts ("Bar 1, column 3, note 1, fret: …").

## show_phrase

Common fields: `kind`, `bpm`, `view`. Then by kind:

- **`scale`**: `root` ("A", "F#"), `scale` (a name the theory core knows,
  such as "minor pentatonic" or "dorian"), `position` (the first fret of a
  five-fret Position, 0 to `LAST_POSITION`), `direction` (`up`, `down` or
  `up and down`, the default), `rhythm` (`8ths`, the default, `triplets` or
  `16ths`).
- **`arpeggio`**: the same, with `chord` ("maj7", "m7b5") for `scale`.
- **`progression`** (after the first version; Q13, Q18): `chords`, each a
  chord name ("Am7") or a Roman numeral with the progression's `key`, and
  its length; `strum` (`whole`, `quarters`, the default, or `strum`, a
  simple down-up pattern). Frets picks a published shape for each chord,
  keeping the shapes close together on the neck, and draws them as chords
  in staff and tab with the names over them. The model can already write
  a progression note by note in `show_tab` before this kind exists.

The line is built as a clip and goes through the same checking, drawing and
JSON as `show_tab`. Its result gives the model the line as `show_tab` JSON,
so the model can change a note and call `show_tab`.

## What every chat pays

A tool's definition (name, description, input schema) is in the model's
context in every chat where the connector is on, whether or not it's
called. Measured on 2026-11-04 from `tools/list` (Q12; o200k and
Anthropic's older public tokenizer, ±20%):

| Tool | Tokens |
| --- | --- |
| `show_metronome` | about 465 |
| `show_tuner` | about 150 |
| `show_tab`, this spec's fields inline | about 860 |
| `show_tab`, `bars` untyped | about 350 |
| `tab_format` | about 60 |
| `show_phrase`, scale and arpeggio | about 290 |

So `show_tab` carries its whole schema inline for now (Q16): the model sees
every field's type and allowed values as it writes, with no extra call.
Once fields push it past about 1,500 tokens, `bars` becomes untyped in the
schema, its description says to call `tab_format` first, and `tab_format`
returns the format, generated from the same zod schema and descriptions so
it can't drift (Q6). The JSON the model sends is the same either way.

`tab_format` is a tool, not an MCP resource (Q6). On 2026-11-04 the model
could read a server's resources in Claude Code; in ChatGPT only through a
generic `read_mcp_resource` tool that was failing on some resources
(openai-apps-sdk-examples#229); in claude.ai it wasn't confirmed. A tool
works everywhere. Something more elegant can replace it later.

Claude Code loads definitions only when needed; claude.ai and ChatGPT
were not found to, so plan as if every chat pays.

## What the model gets back

- **The tool result** (Q11): one line ("Shown: 4 bars in 4/4 at 90 bpm,
  as staff over tab.") and the Frets link
  (`https://frets.eminor.net/tab#tabz=…`, from `writePart`), so a host with no apps, such as Claude Code, still gets
  something to open. `structuredContent` carries the checked line as JSON.
- **From the app**, like the metronome's `updateModelContext`: the bpm and
  loop when the user changes them, as one line ("The user is now playing
  the line at 100 bpm, looping."), a second after the last change. What
  the call asked for isn't told back.
- **After editing arrives** (Q15): the edited line as `show_tab` JSON, sent
  once the user pauses, not on every key, so the model can talk about it
  or call `show_tab` again with changes.

## The app

- **Built on the Tab page's own code** (Q2): `TabClip`, the playhead and
  `usePlayback`; editing (step 4) adds the editor's state, with the chat's
  own shorter tool and key lists in place of `tools.ts` and
  `shortcuts.ts`. One drawing, one set of editing rules.
- **Draws** the line with `layoutClip`, wrapping to the frame's width; the
  frame grows to fit (Q7).
- **Plays** with the Tab page's own sound (Q1): `playback.ts`, which writes
  the clip as alphaTex, reads it with alphaTab and plays it with alphaTab's
  synth. alphaTab and one guitar soundfont are built into the app, since a
  host's frame may load nothing from outside: Steel Guitar, the page's
  default sound (`guitar-iowa.sf3`, 1.5 MB). Audio starts only on Play.
  The page decodes soundfonts in a Web Worker, which a single-file build
  can't carry, so the app decodes on the main thread
  (`mcp/apps/noWorkerDecoder.ts`); measured in Chromium, Play sounds about
  1.2 s after the first press. The built `tab.html` is 4.0 MB, 2.0 MB
  gzipped.
- **Controls**: Play | Stop (Space too), Loop (the whole line; loop
  points the model sets and the user drags since
  `2026-11-05-show-tab-loop-points-design.md`), a bpm
  field (drag, arrows or type; a double-click puts the line's own tempo
  back), Tap next to it (two taps or more in time set the bpm, T too,
  as in the Tab page's tempo panel and the Metronome; kept within the
  field's range), a Staff / Tab / Both switch
  that starts at the call's `view` (Q10), and Open in Frets, which opens
  the line on the Tab page in a new tab.
- Follows the host's theme; teardown stops playback and closes the audio.
  Nothing is saved.
- **No editing in the first version** (Q14): the app passes `TabClip` no
  editing handlers. Editing comes as its own step, a simplified set of the
  page's editing with no saving, its features settled then.

## Code

- `src/features/tab/mcp/`: `tool.ts` (both tools' names, descriptions and
  zod input), `lineJson.ts` (JSON to clip and back, and the checks),
  `phrase.ts` (`show_phrase`'s kinds), `register.ts`, `TabApp.tsx` (the
  host bridge), `ChatTab.tsx` (the drawing and its controls) and, with
  editing, the chat's tool and key lists.
- `mcp/apps/tab/`: `main.tsx` (the soundfont, via `setBuiltInFonts` in
  `playback.ts`), `app.css`, `tab.html`. `mcp/vite.config.mts` treats
  `.sf3` as an asset and swaps in `noWorkerDecoder.ts`.
- `mcp/preview/` tries `show_tab` as well as `show_metronome`.
- `functions/mcp.ts` imports `tab`. The Agents page's Frets card and
  `public/llms.txt` list both tools.
- `src/mcp/README.md` and `src/features/tab/README.md` list the new files
  and this spec.

## Order

1. `show_tab` with the app, drawing and playing.
2. `show_phrase` with `scale` and `arpeggio`.
3. `progression`.
4. Editing in the chat, with its own spec.

## Later

- `tab_format` and an untyped `bars`, past about 1,500 tokens.
- A `position` on `show_tab` to steer where pitches are placed (Q17), if
  Frets' choices look wrong.
- An optional `alphatex` input for agents that already know it, only if
  someone asks.
- More `show_phrase` kinds: the reading quiz, the same notes in another
  Position, chord tones over changes (#340's uses 3 to 5).

## Tests

- Every built-in arrangement's first track that `show_tab` can carry (no
  64ths, grace notes, time changes or tuplets but triplets), cut to the
  fields above, goes clip to JSON to clip and comes back equal.
- `string` 1 is the clip's slot 0 (high e) and 6 is slot 5.
- An empty `notes` is a rest.
- `{ "pitch": "A3" }` after a note at string 5 fret 0 is placed as
  `choosePlace` places it; what goes back to the model gives that `string`
  and `fret`, not the pitch.
- A note with both `pitch` and `string`/`fret` is refused, and so is one
  with neither.
- A bar an 8th over 4/4 is refused with "Bar 2 is an 8th over 4/4." (the
  bar's own number), and one short with "… short of 4/4."
- Fret 25, string 0 and string 7 are refused by the schema; two notes on
  one string in a Column are refused by the checks.
- A pitch below the low E (E2, or the capo's fret) is refused.
- A hammer-on with no previous note on its string is refused.
- `view` left out draws both; `staff` and `tab` draw only that one; the
  switch changes it in the app.
- The tool result's text names bars, time signature and bpm, and holds a
  `#tabz=` link that opens the same clip on the Tab page.
- `show_phrase` `scale` A minor pentatonic, `position` 5, `up`, `8ths`
  gives A C D E G A C D E G A C, every note within frets 5 to 9.
- `show_phrase` `direction` left out goes up and down without repeating
  the top note.
- `show_phrase`'s result holds the line as JSON that `show_tab` accepts
  unchanged.
- `tools/list` shows exactly the tools the Agents page lists:
  `show_metronome`, `show_tuner`, `show_tab`, then `show_phrase` once
  step 2 lands (no `tab_format` yet).
- `show_tab`'s definition is under 1,500 tokens (counted as characters /
  3.5), so growing past it fails a test and prompts the switch to
  `tab_format`.
- The app builds with alphaTab and the soundfont inlined and loads
  nothing from outside the frame (checked by hand in `mcp/preview/`).
- The app tells the model a changed bpm and loop once the user stops, and
  nothing the call gave.
- Two taps 500 ms apart on Tap set 120 bpm, and the model is told; one
  tap changes nothing.
- T taps too, but not while the bpm field is being typed in.
- A tapped bpm past the field's range (1.5 times the line's) is kept at
  its top.
- Open in Frets asks the host to open the `#tabz=` link.
- Teardown takes the line away and lets the player go.
