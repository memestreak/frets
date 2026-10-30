# Tab: filling short bars with rests becomes a setting

Jeremy, 2026-10-29: "On our tab page, we added behavior that automatically
added the appropriate number of rests to a bar if it didn't have the right
number of rests. I would like to move that behavior to a setting, and have it
disabled by default."

## The setting

Settings › Tab › **Editing** › **Fill short bars with rests**, a check box,
off by default. Saved as `frets.tab.editing` `{ fillBars }`
(`src/features/tab/editingPrefs.ts`), a preference (per viewer, never written
into the clip). It has no shortcut elsewhere on the page.

## On

As before (`2026-10-25-tab-editing-design.md`, ← →): → from the last column of
a bar that doesn't add up fills it at once with the fewest rests that complete
it, and leaving a short bar any other way (← off its first column, a press in
another bar, a press off the tab, Esc, placing the playback line) fills it
after its last column (`fillBar`).

## Off (default)

Short bars stay short, and the line under the clip says how far each is short
(#221).

- → from the last column of a short bar adds **one** rest, so typing runs on:
  as long as the column before it, or, when that would make the bar too long,
  the longest rest that fits. An emptied bar gets one rest the same way. The
  bar grows a column at a time until it adds up, then → moves on.
- ←, a press elsewhere, leaving the tab and placing the playback line add
  nothing.

Unchanged either way: → from the clip's last full bar starts a new bar of
rests that adds up, Insert bar fills its new bar, and a fret typed on a rest
longer than the note before splits the rest, keeping the bar's length.
