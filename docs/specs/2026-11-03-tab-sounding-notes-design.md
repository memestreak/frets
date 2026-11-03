# Tab: Sounding notes, read from Columns and written back by the meter

Step 1 of the build order in the Tab editing principles
(https://claude.ai/artifact/T5JHs64SqQcS6iqLhYfqs7, choices A1, A2, A4,
A5). The plan's evaluation is in
https://claude.ai/artifact/5F2ZZv4B71wtNwXY3Y5hEA. Jeremy settled the
questions below on 2026-11-03 (Q1–Q16 in the thread "Build the
sounding-note layer"). Why the Clip stores Columns at all:
`docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`.

Edits are to work on Sounding notes (A1): each note's string, fret, start
and length, with a Tie chain counted as one note. The Clip keeps storing
Columns, so alphaTex, links, saves and every export stay as they are. This
step adds only the two pure functions that go between them, and proves
them on the built-in arrangements. **Nothing anyone sees changes**: no edit
uses them yet (step 3 makes every edit go read, change, write).

## Reading Columns as Sounding notes

- A whole Voice of a Part is read at once, so a Tie chain over a bar line
  is one Sounding note (Q4). Every function takes the Voice it works on;
  today a Track has one, Voice 0 (A2).
- A Sounding note is one string's note. A chord is several Sounding notes
  in the same Voice that start together.
- Rests are not read as things: what is left between notes is a Gap.
- Each written note of a Tie chain is a **piece**. A piece keeps its own
  marks at its own place in the note (Q1): the Sweet Child built-ins have
  tied notes with their own bends (`-.1{b (4 6)}`), chord names and wah.
- What a Column carries that isn't a note's (a chord name, text, a stroke,
  wah, a fermata, the whammy bar, kept alphaTex) is kept at its time in
  the Voice, a rest's included.
- A tuplet is kept as written: a block of time the writer never splits
  into. A grace note goes with the note after it (Q6). Span-based tuplets
  and Grace before are step 6.

## Writing Sounding notes back as Columns

Only a bar exactly as long as its time signature is written by the
meter. A short or overfull bar (from an import) and a free-time bar
(`\ft`) are written back exactly as they were read (Q5).

### Where Columns are cut

A Column has one length, so a bar is cut at every note's start and end,
at every piece that carries marks of its own, at every time a Column
thing sits, and at a tuplet's edges. A note that sounds on over a cut is
tied on (Q7): a bass note held under a moving line is written with ties,
as today. A second Voice stays a choice, never forced.

### Marks when a note is split

- **Whole-note marks** go on every piece, so a line over them doesn't
  break: palm mute, let ring, vibrato, and the Column's tremolo picking,
  octave line and hairpin.
- **Attack marks** stay on the first piece only: hammer-on or pull-off,
  slide in, accent, ghost, tap, harmonic, mordent, staccato.
- **A piece's own marks** stay where they are, and that piece stays its
  own written note: a bend, a slide out, kept alphaTex, and the Column
  things above.
- A chain with nothing of its own on its later pieces is written fresh
  (Q15): `q~e` on beat 1 of 4/4 becomes `q.`, and `e~e` inside a beat
  becomes `q`.
- **Shaped marks** play or draw over the note's own length: a bend, a
  slide out, and the Column's whammy bar. A note or Column carrying one
  keeps its written pieces, neither split nor merged, or the shape would
  move in time (found while building: `sweet_child/song-ending` bends
  over a dotted quarter on the off-beat).

### Beat groups

Each time signature has one default grouping (Q8, A5). It is a parameter
of the writer, so a bar's own grouping (`\beaming`, the Beat groups field)
can be passed in step 7 without changing it (Q9).

| Time | Beat groups |
| --- | --- |
| 2/4 | 1+1 |
| 3/4 | 1+1+1 |
| 4/4 | 2+2 (two halves, a beat each inside) |
| 2/2 | 1+1 |
| 3/2 | 1+1+1 |
| 5/4 | 3+2 |
| 6/4 | 3+3 |
| 7/4 | 4+3 |
| 3/8 | 3 |
| 6/8, 9/8, 12/8 | 3 eighths each |
| 5/8 | 3+2 |
| 7/8 | 2+2+3 |
| Any other count over 8 or 16 | twos, ending in a three when the count is odd |
| Any other over 1, 2 or 4 | one beat each |

### How notes are written

Shorthand: w h q e s = whole, half, quarter, eighth, sixteenth; `.`
dotted; `~` tied; `r` before a value is a rest. Each example starts on
beat 1.

- A note is always split at a bar line.
- **Simple time (Q11):** a note stays whole when it starts and ends on
  beats and doesn't hide the middle of 4/4. Otherwise it is split at the
  beat. These stay whole:
  - `q h q` in 4/4 (the half over the middle, on beat 2);
  - `e q e`, and `s e s` inside a beat;
  - `q. e` and `e. s`.
  - A dotted half on beat 2 of 4/4 is `q~h`; a dotted quarter on beat 2
    of 4/4 is `q~e`.
  - A whole note only on beat 1 of 4/4; a dotted half only on beat 1.
- **6/8, 9/8, 12/8 (Q13):** the group is a dotted quarter. Inside it
  `q e`, `e q` and `e e e` stay. A note over a group's edge is split,
  except a dotted half from the start of a 6/8 bar or of either half of
  12/8.
- **5/8, 7/8 and other uneven groups (Q14):** each Beat group is a beat
  of its own length. A note may fill one (`q.` a three, `q` a two), and
  `e q`, `q e` stay inside a three. A note over a group's edge is split.

### How Gaps are written

Rests are stricter than notes (Q2): they split at the same Beat groups,
but take none of the syncopations above.

- **Simple time (Q12):** rests show every beat, and the half-beat inside
  a beat.
  - 4/4: `e re rq rh`; a half rest only on beat 1 or 3.
  - Inside a beat: `s rs re`, never `s re.`.
  - 3/4: quarter rests, `q rq rq`; never a half rest.
  - No dotted rests in simple time.
- **6/8, 9/8, 12/8 (Q13):** `rq.` for a whole group; inside a group
  `e rq` and `q re`, but `re e re` around a middle note.
- **5/8, 7/8 (Q14):** rests show every group: 5/8 `e rq rq`.
- **An empty bar (Q3, Q16)** stores one rest of the bar's length where
  one exists (`rw` in 4/4, `rh.` in 3/4 and 6/8, `rh` in 2/4), else one
  rest per Beat group (5/8 `rq. rq`). This is the only rest that crosses
  a beat. Drawing any empty bar as one whole-bar rest is step 3.

## How

- `src/features/tab/sounding.ts` (pure, new):
  - `SoundingNote`: Voice, string, fret, start and length in ticks from
    the Part's start, and its pieces, each with its offset, length and
    own `Note` marks.
  - `readVoice(part, voice = 0)` (now `readVoice(part)`, reading the
    Part's own Voice: `2026-11-03-tab-voices-design.md`): the Voice's Sounding notes, its Column
    things at their times, its grace notes and tuplet blocks, and each
    bar's start, length and whether it is written by the meter.
  - `beatGroups(time)`: the table above, in ticks.
  - `spell(start, length, kind, groups)`: the durations a note or a Gap
    is written as from `start` in a bar. It keeps the span whole when the
    rules allow it, else splits it at the highest boundary inside it (the
    bar's middle, a group, a beat, a half-beat) and spells each side.
  - `writeVoice(part, read, bars)`: the Columns for the bars asked for,
    cut and tied as above; every other bar's Columns as they were.
- No other file changes behaviour. `beams.ts` and `beatTicks` keep their
  own idea of a beat until step 7 moves them onto `beatGroups`.

## Tests

`src/__tests__/tab/sounding.test.ts`:

- Reading: a quarter tied to an eighth is one Sounding note a dotted
  quarter long; a chain over a bar line is one note starting in the first
  bar; a chord is one Sounding note per string, starting together; rests
  give no notes.
- A tied piece's own bend and chord name are read at its place and
  written back on the same piece, as its own written note (the held
  bends at the start of bar 2 of `sweet_child/solo-bend-rise.atex`).
- A bent note, and a Column with the whammy bar, keep their written
  pieces: a bent dotted quarter on the off-beat stays `q.`, and a bent
  `q~e` stays two notes.
- Splitting a note copies palm mute, let ring, vibrato, tremolo picking,
  the octave line and the hairpin to every piece; hammer-on, slide in,
  accent, ghost, tap, harmonic, mordent and staccato stay on the first.
- `q~e` on beat 1 of 4/4 is written `q.`; `e~e` inside a beat is `q`.
- A held bass note under two eighths is written as two Columns, the bass
  tied into the second.
- A short bar, an overfull bar and a free-time bar come back exactly; so
  does a tuplet block, and a grace note stays before its note.
- Only the bars asked for are written.
- `beatGroups` for every row of the table: 4/4 2+2, 3/4 1+1+1, 6/8 3+3,
  5/8 3+2, 7/8 2+2+3, 5/4 3+2, 7/4 4+3, 11/8 2+2+2+2+3.
- Notes, simple time: `q h q`, `e q e`, `s e s`, `q. e`, `e. s` stay;
  a dotted half on beat 2 of 4/4 is `q~h`; a dotted quarter on beat 2 of
  4/4 is `q~e`; a whole note from beat 2 is split; a note over a bar line
  is split and tied.
- Notes, compound: `q e`, `e q`, `e e e` in a group stay; a dotted half
  from the start of 6/8 stays; a quarter on the third eighth of 6/8 is
  `e~e`.
- Notes, 5/8 and 7/8: `q.` fills a three, `q` a two; a note over a group's
  edge is split.
- Rests: `e re rq rh` in 4/4; `s rs re` in a beat; `q rq rq` in 3/4; no
  dotted rest in simple time; `re e re` and `e rq` in a 6/8 group; `e rq
  rq` in 5/8.
- Empty bars: `rw` in 4/4, `rh.` in 3/4 and 6/8, `rh` in 2/4, `rq. rq` in
  5/8.
- Every built-in arrangement read and written back: each bar already
  written by the meter comes back exactly, and every bar that changes is
  listed in a committed snapshot, reviewed in the PR (Q10). Three bars
  change: `strumming` bar 2 `h ~h` → `w`, `outro-solo` bar 2 `q rh.` →
  `q rq rh`, and `solo-bend-rise` bar 2's off-beat `e.` → `s ~e`.
