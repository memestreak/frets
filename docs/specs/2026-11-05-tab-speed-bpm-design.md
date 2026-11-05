# Tab: Speed as one bpm field, with Tap on its "bpm"

Issue [frets#373](https://github.com/memestreak/frets/issues/373). Jeremy,
2026-11-05: "We should only have a BPM change not a percentage. The
percentage can be below the BPM widget as a label. The label "bpm" should
turn into a tap button that says Tap on mouse over." Then: "We will want
the same change made to the MCP apps version of this playback toolbar."

## What

- **Tab page.** The footer's Speed is one bpm field (`BpmField.tsx`), no
  longer a percentage field. It shows the bpm playback runs at where the
  playhead is (or where Play starts): the clip's own tempo there, times the
  speed. Typing, stepping or dragging it sets the speed relative to that
  tempo; it never changes the clip's own tempo (the tempo panel still
  does). The caption under it reads "Speed · 83%".
- **Its "bpm" is a Tap button.** At rest it reads "bpm" in muted text, as
  a unit does; on hover (and when focused from the keyboard, or pressed)
  it is outlined as a button and reads "Tap". Both words take the same
  place, so nothing moves. Two taps or more in time set the bpm
  (`src/lib/tapTempo.ts`, as the Metronome and the tempo panel); a press
  flashes, as the Metronome's Tap does; Enter on it taps. A press takes no
  focus, so the cursor stays on the tab. Its accessible name is "Tap
  tempo", apart from the rail's Tap (the technique). The Tab page has no
  key for it: T is tie and Alt+T the tapping technique.
- **Range.** The field and Tap reach what #363 allowed, in bpm: every
  tempo in the clip stays within 20–400 bpm and alphaTab's 12.5–800%, so a
  120 bpm clip goes from 20 to 400. `speedRange` now gives fractions, not
  whole percent, so the field's ends are whole bpm (20, not 21).
- **Numeric-field rules.** Drag up or down on the number, the step
  buttons and ↑ ↓ (5 bpm; a drag 1 bpm a step, Shift 5, as show_tab's bpm);
  a double-click on the number or the caption puts the speed back to 100%
  (the clip's tempo), not on Tap or the step buttons.
- **show_tab.** Its row had a bpm field, a muted "bpm" and a separate Tap
  button. Now it is the same `BpmField`: "bpm" is the Tap button (T still
  taps), the separate Tap goes, and "Speed · 100%" sits under the field,
  the line's own tempo being 100%. The other controls sit level with the
  field. Its range stays 20–400 bpm whatever the line's tempo.

## A clip with several tempos

The field follows the tempo where the playhead is, so while playing
through a tempo change the bpm shown changes with it and the percentage
stays. A bpm typed sets the speed for the whole clip from the tempo
there. (My reading; Jeremy to confirm.)

## Tests

- The Tab page has no percentage field; the bpm field starts at the
  clip's 120 with "Speed · 100%" under it.
- Faster gives 125, ↓ 115; a typed 60 gives "Speed · 50%"; a typed 10
  stops at 20 ("17%"), 999 at 400 ("333%"); Esc drops a typed number.
- A bpm set leaves the clip's own tempo at 120.
- A speed of 360 bpm (300%) kept while the tempo is raised to 200 plays
  at 400 (200%).
- Tap reads "bpm", with "Tap" in the same button for hover, and its tip;
  it is named "Tap tempo", not the rail's "Tap".
- One tap changes nothing; taps 600 ms apart set 100 bpm ("83%") and the
  clip stays at 120.
- Taps 100 ms apart stop at 400; each press flashes afresh; Enter taps.
- A press on Tap takes no focus; a double-click on it doesn't reset.
- A double-click on the caption, its percentage or the number resets to
  120; on the step buttons it doesn't.
- show_tab: one Tap, the field's "bpm"; "Speed · 100%" under the field,
  "133%" after taps at 120 bpm on a line at 90; a double-click on the
  caption puts 90 back.
- Checked in a browser, light and dark: hover turns "bpm" into "Tap"
  with nothing moving.
