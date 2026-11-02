# Tab: the tools in a rail of panels on the left (issue #301)

Jeremy, 2026-11-01: "cleans up our tool sets and arranges them in terms of palettes that will exist on
the left side of the page … Several notation applications do something similar, including Dorico,
MuseScore, and Guitar Pro." 2026-11-02: "Make use of the left side of the screen such that we have
approximately one row of tools at the top and other tools are available on the left side."

He compared four layouts (a column, MuseScore-style folding sections, a Dorico-style rail, a Guitar
Pro-style strip) and picked the **rail**, "what I see Dorico doing". The answers below are his, one
question at a time; a higher-fidelity mock then offered two looks and he picked **Sidebar**.

## The rail

- A thin column of panel buttons to the clip's left. Each opens its **panel** beside it, and the
  same button, or the chevron in the panel's corner, closes it. One panel is open at a time.
- **Every tool group is in the rail**; nothing stays over the clip (Q1). A few tools may be copied
  back outside the rail later, but none for now (Q7).
- **Three panels** (Q2), each with its groups captioned inside, Dorico's few large panels rather than
  one per group:
  - **Notes**: note input (the pencil), Duration, Rhythm.
  - **Articulations**: Joins, Bends, Techniques, Accents.
  - **Bars**: Bars, Text.
  - The chord library (#300) adds a fourth, **Chords**, after them.
- Each rail button's icon is one of its panel's tools: a quarter note, an accent, a repeat sign. Its
  tip names the panel. The open one is lit, with a bar on its outer edge.
- The look is **Sidebar**: the rail and panel sit flush with the page, divided from it by thin lines,
  and the panel runs the window's height. A panel's tools work as the palette's always have: pressing
  one keeps the tab's cursor and selection, and Bend, Tuplet, Octave line and Whammy bar open their
  choices beside the button.

## Where it goes

- An open panel sits **beside** the clip, not over it (Q3).
- The rail and panel **grow into the page's left margin**, so the clip keeps its right edge (Jeremy,
  2026-11-02: "have the tooling extend to the left rather than pushing the arrangement to the right").
  The rail **starts at the clip's left edge**, not the window's (Jeremy, 2026-11-02: "begins on the left
  side of the arrangement rather than the far left of the window"): rail, panel and clip sit together,
  with any spare margin to the rail's left. On a wide screen (about 1,900px) opening a panel moves nothing. On a narrower one the margin is too
  small for the panel, so the clip gives up width on its left.
- Every panel is one width (17rem), so switching panels never moves the clip; only opening or closing
  one does.
- Under 900px the rail is a **row** of buttons over the clip, and the open panel sits under it,
  pushing the clip down (Q6).

## Kept

- Which panel is open, or none, is **kept across visits** (`frets.tab.layout`, `{ panel }`), but it
  is not a preference, so Settings doesn't list it (Q4). A first visit opens Notes.
- **No keys** open or close the panels (Q5): the tools' own keys work as before, whatever is open.
