# Tab: the technique popover

Issue #501 ("FR: Technique popover in the Tab editor (Shift+P)"), step 3
of issue #342 ("FR: Dorico-style popovers in the Tab editor"), after the
chord popover (`2026-11-10-tab-chord-popover-design.md`) and the text
annotation popover (`2026-11-14-tab-text-popover-design.md`). Asked
2026-11-15 (Jeremy): "If I wanted to support things like adding a let
ring articulation via popovers, is there a consistent way to add that
feature?" The design questions and his picks (every recommendation) are
in the questions page linked from the PR.

Editing follows Dorico first (`docs/tab-editing-principles.md`). Dorico
has two popovers for these: Shift+P playing techniques (`lv`, vibrato,
tapping, strums, wah, harmonic `o`), which lists its matches as you type,
and Shift+O ornaments (`bend`, `ho`, `po`, `gliss`, `arp`, `mor`). A
technique with a line takes its length from the selection, or `->`
extends it with the caret in note input. MuseScore has no popover: its
palette search (Ctrl/⌘+F9) finds the Guitar palette's let ring and palm
mute lines. Guitar Pro 8's Command palette (Ctrl+E) takes "let-ring",
"palm-mute", "bend 2" and applies it to the selection.

## What

- **One popover for every mark on notes** (Q1): the palette's Rhythm
  marks (tremolo picking, grace note), Joins, Bends, Techniques and
  Accents, not Dorico's split between Shift+P and Shift+O. Bar items
  (repeats, endings, double bars) are left for a bars popover. Song
  Directions have their own, Shift+R
  (`2026-11-15-tab-song-directions-design.md`), sharing this one's list.
- **Opening** (Q2). Shift+P, Dorico's playing techniques key, in normal
  and note input mode, on the cursor's column. It doesn't open on an
  empty bar: a technique goes on notes. It sits where a dynamic's field
  does, under the line beside its column, so the notes it marks stay in
  sight.
- **What can be typed** (Q3): a technique's name or a short form, in any
  case, with dots and hyphens or without ("let ring", "lr", "lv", "l.v.";
  "palm mute", "pm", "P.M."; "vib", "wide vib"; "ho", "po"; "bend",
  "prebend", "pb"; "slide", "gliss"; "tap"; "trem 16"; "mordent";
  "wah"; "harmonic", "o", "ph"…). Every word is one of the palette's
  tools (`tools.ts`), or one kind of a mark the palette steps through
  (vibrato or wide vibrato; a full bend), so the popover writes only
  what the palette can, and no alphaTex the palette doesn't write.
- **The list** (Q4). As soon as anything is typed, a list under the field
  (over it with no room under) shows the techniques with a name or word
  one of whose words starts with what is typed, each with its palette
  group, in the palette's order; one named exactly comes first. Down with
  nothing typed shows every technique. Up and Down light one; Enter or a
  press adds it. Enter with the list closed (Esc closes it) adds the
  first match. What names nothing gets the small red ⚠ ("Not a
  technique…") and the popover stays open.
- **Which notes** (Q5): exactly those its palette button marks: the
  selection (every Voice's notes in its time), else the cursor's note,
  or with no string picked every note of its column; let ring and palm
  mute go over a Tie chain's whole time. A let ring or P.M. line added
  is picked, as after Alt+I or M.
- **It only adds** (Q6). When every note it would go on has the
  technique already, nothing changes; a kind replaces the other kind
  ("wide vib" over vibrato). Taking a mark off stays with its key or
  button, or Delete on the picked mark.
- **Closing** (Q7). Enter adds and closes; Esc closes the list, then the
  popover, adding nothing; so does leaving it with a press elsewhere, or
  Enter with nothing typed. The keys go back to the tab. Each technique
  added is one undo step.
- **Keys** (Q8). Every existing key stays (Alt+I let ring, M palm mute,
  V vibrato…); the popover is the way by name, as the palette is the way
  by sight. The `?` overlay lists Shift+P under "Selected notes and
  rests", and the popover's keys under "In the Technique popover".

## Tests

- "lr" adds let ring to the cursor's note, as one undo step, and closes.
- "P.M." adds palm mute (any case, dots ignored).
- Typing "ring" lists only Let ring, with "Techniques"; "slide" lists
  Slide first, then more.
- Down with nothing typed lists every technique; "harm" lists Natural
  and Pinch harmonic; Down, Down, Up, Down, Enter adds a pinch harmonic.
- On a note with let ring, "let ring" changes nothing; on vibrato, "vib"
  changes nothing and "wide vib" makes it wide.
- "bend" adds a full bend (`b (0 4)`).
- With two columns selected, "lr" marks both and not the third.
- "fog machine": Esc closes the list, not the popover; Enter shows the ⚠
  and stays open; Esc closes it and nothing changed.
- Leaving it with a press elsewhere, or Enter with nothing typed, adds
  nothing.
- No popover on an empty bar.
- The `?` overlay lists Shift+P and the popover's Enter.
- `techniquesFor`: each short form above finds its technique first;
  nothing typed gives every technique; "fog machine" gives none; every
  technique has its own name and either a tool or an edit.

## How

1. `techniques.ts`: `TECHNIQUES` (name, palette group, words, tool or
   edit), `techniquesFor` (the list for what is typed) and
   `techniqueOn` (whether every target note has it, so it only adds).
2. `WordField.tsx`: the `technique` kind, sharing the dynamic field's
   list; it opens as you type, shows each technique's group, and adds
   nothing on blur.
3. `fieldSpots.ts`: the technique popover's spot, a dynamic's.
4. `useHeadPanels.tsx`: `openWord('technique')` opens it on a column
   only; `finishWord` hands the named technique to the page
   (`onTechnique`).
5. `TabPage.tsx`: `runTool` (what `onTool` does once the tab has the
   keys) and `addTechnique`; `editorKeys.ts`: Shift+P;
   `shortcuts.ts`: the popover's keys.
6. A test arrangement, `editing_tests/technique-popover.atex`.

## Not yet

- Bends by amount ("bend 2", "½ bend"), wah open, whammy bar shapes,
  octave lines and tuplets, which have panels of their own.
- Dorico's `->`, a line that grows with the caret in note input mode.
- A bars popover (repeats, endings, bar lines; Dorico's Shift+B, which is
  release / pre-bend in Frets).
