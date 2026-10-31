# No widget stays active after use

Jeremy, 2026-10-30: "prevent the track selector from remaining active (with a
blue outline) after it's used to change a track. Generally speaking, I do not
want widgets to remain active after they're used."

## The rule

On every page, a widget used with the mouse or a finger lets go of the focus
once it has done its work. It shows no focus outline afterwards, and the
page's own keys (Space to play on the Tab page, the arrows on the Scale lab
and the Chords page) work again instead of going to it.

- **Buttons and links** let go after a press (a click whose `detail` is 1 or
  more).
- **Lists** (`<select>`) let go once a choice is made, when they were opened
  by a press. A list keeps no blue ring after its choice, which Chrome draws
  on a list even when it was clicked.
- A click handler that moves the focus on (a button opening a popover or a
  menu that focuses its first item) keeps it where it moved it.

## Keyboard use keeps the focus

A keyboard user needs to know where they are, so the keyboard keeps the focus
and its ring: Enter or Space on a button (a click with `detail` 0), and a list
tabbed to and stepped with the arrows (each step is a change; letting go on
each would throw the user out of the list).

## Left alone

- Anything in a dialog or a menu: they keep the focus inside them.
- Radio groups (the Key picker): their arrow keys move on from the tile pressed.
- Anything under `[data-keep-focus]`, for a widget that must keep the focus.
- Fields: typing needs the focus; the Tab page's fields already let go on Enter.
- SVG widgets (the fretboard's cells, the Circle of fifths' wheel): they show
  no ring after a press and their hover state follows the focus.

## Where

`src/hooks/useLetGoAfterUse.ts`, mounted once for every page by
`src/components/LetGoAfterUse.tsx` in `AppShell`. It replaces the Tab Sound
list's own blur. Many Tab controls (the palette, the footer's buttons, the
volume knob) already keep a press from taking the focus at all
(`onMouseDown={e => e.preventDefault()}`), so the tab's cursor stays; they
are unchanged.

## A button that opened a dialog (2026-10-31)

Jeremy: "The export button should not stay active and highlighted if I
click on it and then escape out." A modal dialog gives the focus back to
the button that opened it when it closes, after the click's let-go has
already passed. So the hook remembers the last widget pressed, and when any
dialog closes (`close` heard in the capture phase, as it doesn't bubble) it
lets go of that widget if the focus came back to it. A button clicked from
the keyboard clears the memory, so a keyboard user keeps their place.

## A list closed with no choice, and a field under a knob (2026-10-31, #270)

Jeremy, on the Metronome: "None of the widgets should retain focus after you
make a selection or click off of them." Two cases kept it:

- **A list opened with a press and closed with no choice** (Esc, or a click
  off it). The open list swallows that click, so the page never hears it and
  the list kept the focus and its ring. An open list takes the mouse to
  itself, so the hook lets go of it at the mouse's next move over the page
  (300 ms or more after the press, so a move as it opens doesn't count).
- **A field being typed in, then a knob pressed.** The controls that keep a
  press from taking the focus (the knob, a number's step buttons, the
  Metronome's drags) left the field focused under them. They now call
  `letGoOfFields()` when pressed: a text field or list with the focus lets
  go, as a press anywhere else would make it. Nothing else is touched, so
  the Tab editor still keeps its keys. A number field's own steps leave its
  own number being typed alone.
