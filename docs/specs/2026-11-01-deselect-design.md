# Esc and a press away let any selection go

Jeremy, 2026-11-01: "Pressing escape or clicking out of the selection box should deselect it. This
applies to any selected element in the application."

## The rule

Anything selected on a page goes when Esc is pressed or when a press lands anywhere but on it and the
page's controls. Buttons, links, fields, lists, menus and dialogs keep the selection, so a tool still
works on what is selected. The press is caught as it starts, before what it lands on acts, so a press
on another selectable thing selects that one rather than nothing.

Esc is left alone when something else has used it: a field giving up its text, a menu or a panel
closing. Esc in a dialog or menu closes it and the page's selection stays; the selection goes with the
next Esc.

## Where it applies

- Scale lab: a selected chord (it did this already; now through the shared hook, on the press rather
  than the click).
- Triads: a picked grip now goes on a press off the board's cells and the controls, as well as Esc.
- Tab: a selected run went on a press off the bars (#279). The playback line (the red line placed by a
  press just over or under the tab) now goes the same way; Play and the other controls keep it. Esc on
  the Tab page stays the editor's own, a step at a time: note input, then the selection, then the line,
  then the tab.
- Arrangements… (Tab): Esc lets the picked files go and keeps the dialog open; with nothing picked, Esc
  closes it. A press on the dialog's empty space lets them go; the lines, buttons and the preview keep
  them.
- The score's head on the Tab page: its own PR (#282).

Not selections, so nothing changes: the Chords page's shape (it is what the board shows, not a pick
over it), the Circle of fifths' key or mode (always one), the Metronome's beats and the trainers'
answers (data), and radio-like choices such as segmented switches.

## How

`src/hooks/useDeselect.ts`: `useDeselect(active, clear, { keep, escape, inDialog })`. `KEEPS_SELECTION`
is the shared list of what a press may land on; a page adds its own selectable things to it (the Tab
drawing and palette).
