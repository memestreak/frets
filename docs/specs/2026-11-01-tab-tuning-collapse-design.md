# Tab: pick the tuning, and collapse it to its name (issue #296)

Jeremy, 2026-11-01: "allows us to minimize the tuning details similar to the way we can minimize the
track name and attribution details. Clicking the tuning details should select it. The selection
should enable an edit and a collapse widget (if the tuning is a named tuning). The collapse widget
hides everything except for the name of the tuning. Similarly, clicking on the collapsed name of the
tuning should select it, and show the edit and expand widget. Double clicking on either the expanded
or collapsed tuning should open the edit dialog."

"Track name and attribution details" is read as the arrangement header (title and credits,
`2026-11-01-tab-arrangement-header-design.md`). This changes the press on the tuning in
`2026-10-29-tab-credits-tuning-design.md`: it now picks instead of opening the panel.

## Picking

- A press on the tuning (its name and its strings) **picks it**: the same outline as the picked
  header (`--select` on `--select-soft`), drawn round it without moving it, with **Edit tuning**
  (pencil) and, for a named tuning with strings listed, **Collapse tuning** to its right.
- **Edit**, **Enter** or a **double-click** opens the Tuning panel. Nothing stays picked once it opens.
- **Esc** or a press anywhere else lets it go. The `?` overlay's "Picked title, credits or tuning"
  group lists Enter and Esc.

## Which tunings collapse

A tuning collapses when it has a name and lists strings under it: "Tune down 1/2 step" (all six
strings tuned alike) and the common tunings ("Drop D tuning", "DADGAD tuning"). Standard tuning
shows only "Standard tuning", and a tuning of its own has no name to fold down to, so both have Edit
only (`foldsTuning` in `credits.ts`).

## Collapsed

- **Collapse tuning** hides the strings; the name stays where it was, over the tempo.
- A press on the name picks it, with **Edit tuning** and **Expand tuning**; Expand brings the strings
  back. Either way it comes back unpicked.
- A double-click on the name opens the Tuning panel.
- A tuning changed while collapsed shows its new name, collapsed; if it no longer has one (a tuning
  of its own), its strings show, as there is nothing else to show.

## Saved

A view option, as the header's is: **Tuning details** in View options' Notation group and in
Settings › Tab › Notation, saved in `frets.tab.notation` as `tuningDetails` (default `true`). It
applies to every arrangement and is separate from Arrangement header.

PNG and SVG exports draw the tuning as the page shows it: its name alone when collapsed (`shownTuning`).
