# Tab: a paste keeps its key, meter and tempo

Jeremy, 2026-11-15, after Insert mode (issue #482, phase 2,
`2026-11-14-tab-insert-mode-design.md`): he copied bar 1 of an Intro (6/8,
E major, Slowly ♩ = 72) and pasted it in Insert mode before bar 1. The new
bar 1 came out in C major at ♩ = 120, and the Intro's key, tempo and label
moved to bar 2. "The copy should have picked up the original key signature,
tempo, and time signature. And the paste should have moved things along,
and those things kept those attributes. … Because those attributes did not
change based on their slide, those attributes do not need to be rewritten."

Why it happened: a push of whole bars kept the old bars as they were, marks
and all, and laid the pasted ones in front with none, so they fell back to
the defaults.

Words, from `GLOSSARY.md`: Bar Mark, Insert paste, Insert mode, Pickup bar.
New here (the PR says so, the glossary lacks them): **state marks** for
the key, time signature (with its Beat groups) and tempo, the Bar Marks that
say how the music from there on reads and plays; **labels** for the other
Bar Marks (section, repeat start and end, ending, double bar), which name a
place in the music.

## The rule

**Every note keeps the key, meter and tempo it had: the pasted notes, and
the notes a paste slides on. A state mark goes in only where that changes.**

1. **A copy says what it is in.** Its first bar states the key and tempo in
   force where it starts, even when they were set on an earlier bar, and
   its meter and Beat groups as now. Changes inside it come with it. A clip
   that sets no key anywhere states none, and none sets no tempo; the
   paste then takes the one where it lands.
2. **A paste of whole bars at a bar line keeps them.** The cursor starts a
   bar, and every pasted bar is full in its own meter (in the meter where
   it lands, for alphaTex that states none). Then each pasted bar is in
   what it states, else in what is in force where it lands.
3. **The music after keeps its own.** After an Insert paste, the bars it
   slid on are in the key, meter and tempo they were in; after a paste
   over bars, the bar after the paste is in what it was in.
4. **A mark only where it changes.** The state marks from the paste on are
   written again: a mark on a bar only where its key, meter or tempo
   differs from the bar before. One that would say again what is in force
   is not written, so the slid bars carry no marks they didn't need.
5. **Labels are never pasted.** A copy's section, repeats, endings and
   double bars name a place it was copied from; a paste brings none, so
   there are never two Intros. Free time and a Pickup bar don't come
   either.
6. **Under Insert paste, labels slide on with their music** (Jeremy,
   2026-11-15): pasted in front of the Intro, the Intro starts where its
   music now starts. A paste over bars leaves the labels of the bars it
   writes over where they are.

Insert paste is Ctrl/⌘+Shift+V, the menu's Insert paste, a paste in Insert
mode, and Arrangements…'s Insert; Paste is Ctrl/⌘+V out of Insert mode.

### What isn't whole bars at a bar line

Bar Marks sit on bars, so a key, meter or tempo can only change at a bar
line. A paste that starts inside a bar, or isn't whole bars, takes the
key, meter and tempo where it lands, as before: Frets stores frets, so its
notes sound the same, the meter re-bars them and the local tempo plays
them. Its labels and state marks don't come, and the Bar Marks after it
stay on their bars (`2026-11-14-tab-insert-mode-design.md`, "Bar Marks
stay"). Anchors (issue #482, phase 3) are what keep a later section on its
bar line then.

A paste of whole bars over bars of another meter is written by the meter
where it lands, as before, and so keeps its key and tempo but not its
meter. Several Voices pasted at once (`pasteVoices`) go as before.

### The example

```
Before (6/8)                      Copy bar 1, I, paste on bar 1
\ks E \tempo (72 "Slowly")        \ks E \tempo (72 "Slowly")  [the copy]
\section "Intro"  bar 1 |         \section "Intro"            bar 1 |
bar 2 |                           bar 2 |
\ks C \section "Verse" bar 3 |    \ks C \section "Verse"      bar 3 |
```

A 6/8 bar in E at ♩ = 72 pasted into a 4/4 piece at ♩ = 100 in C goes in
with `\ts (6 8) \ks E \tempo (72 "Slowly")`, and the bar after it gets
`\ts (4 4) \ks C \tempo 100` back.

## What the others do

| | A pasted bar's key, meter, tempo | The music after |
|---|---|---|
| Frets | Kept, whole bars at a bar line | Keeps its own; a mark only where it changes |
| Dorico | Signatures and tempo are items at a rhythmic position; Insert mode pushes time signatures along with the music (since 1.1), up to its stop position. What it does with key signatures and tempo, and with a paste, isn't in the docs found | Pushed with the music |

Sources: [Dorico blog: Insert mode and time signatures](https://blog.dorico.com/2018/04/tip-use-insert-mode-when-adding-time-signatures-to-avoid-irregular-bars/),
[Steinberg forum: time signature shift in Insert mode](https://forums.steinberg.net/t/time-signature-shift-insert-mode/677091).

## Tests

- A copy of bar 2 of the sample says `\ks E \tempo (72 "Slowly")` (set on
  bar 1); a copy from a clip with no key or tempo says neither.
- The issue: bar 1 pasted before bar 1 gives `\ks E \tempo (72 "Slowly")`
  on the new bar 1, `\section "Intro"` on bar 2 with no key or tempo, and
  the Verse's `\ks C` where it was, one bar later; also on the page, with I
  and a paste.
- Pasted before the Verse: the pasted bar is in E with no mark, and the
  Verse keeps `\ks C` and its label.
- A 6/8 bar in E at 72 into 4/4 in C at 100: `\ts (6 8) \ks E \tempo (72
  "Slowly")` on it, `\ts (4 4) \ks C \tempo 100` on the bar after.
- alphaTex with no `\ts`, `\ks` or `\tempo` (a dotted half and a dotted
  half) pasted whole into the 6/8 E piece: no mark.
- Paste over the Verse: `\section "Verse"` stays on it, now in E, and the
  bar after gets `\ks C`.
- A paste of part of a bar at bar 1: no second section or key, the marks
  on their bars.

## How

- `editing.ts`: `sliceClip` states the key and tempo in force on its
  first bar (`tempoAt`); `statedIn` reads which of `\ts`, `\ks`, `\tempo`
  pasted alphaTex sets; `insertPaste` and `pasteOver` take that (`Stated`)
  and, for whole bars at a bar line (`pastesWholeBars`), put the bars in
  (`insertBars`) or write over them, then `withStates` writes the state
  marks from the paste on, each bar's from what it pasted or what it was.
- `TabPage.tsx`: `pasteTab` passes `statedIn(text)` through `putAtCursor`.
