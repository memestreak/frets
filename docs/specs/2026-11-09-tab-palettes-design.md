# Tab: several palettes open at once, in one column

Jeremy, 2026-11-09 (issue #454, "FR: Allow multiple palettes to be open"):

- "The palettes as a whole should be able to be minimized into the left sidebar."
- "Once opened, each individual palette can be collapsed or expanded downwards from its header. This
  will allow us to have, say, both the notes and the chords palettes visible at the same time."
- "Each palette should be resizable from the bottom such that it takes up less room if the user wants."

He compared three mocks (draft PR #455; questions page
https://claude.ai/artifact/Hee1QzoSfb89JVYifwZ6XR): a, the rail picks which palettes are listed; b, every
palette listed, the column scrolls (MuseScore 4's Palettes); c, every palette listed, the open ones share
the window's height (VS Code's sidebar). He picked **b**, then: "I don't think we need the far left rail. I
think we might want one button that expands and collapses the palette width. The icons that were used in
the far left thin rail can be used to prefix the palettes to the left of each of their names." Then: "Can we
support reordering the palettes by dragging them?" He took every other recommendation.

This replaces the rail of one-at-a-time panels (`2026-11-02-tab-rail-design.md`, issue #301). The column's
width (`2026-11-08-tab-rail-width-design.md`, issue #431) works as before.

For comparison: Dorico's Write mode Notes panel is one column of foldable sections, several open,
scrolling; MuseScore 4 lists every palette, each folds, several open, the panel scrolls, and palettes can
be dragged into another order; Guitar Pro 8's Edition palette is a fixed column that doesn't fold.

## What it does

- **One column** on the clip's left, where the rail and its panel were, flush with the page and divided
  from it by lines. It lists **every palette by its header**, top to bottom: Notes, Articulations, Bars,
  Chords, Chat until moved. Their tools are as before.
- **A header** is a chevron (right when folded, down when open), the palette's icon (the rail's: a quarter
  note, a vibrato's wavy line, a repeat sign, a chord diagram, a speech bubble), then its name. A
  folded palette's name is drawn as an open one's, not faded. Chords' header also has its Hear toggle at the
  right while open.
- **A press on a header opens or folds** that palette, downwards from the header. Any number may be open.
  A press doesn't take the focus from the tab.
- **The column scrolls** when the open palettes outgrow it; it is no taller than the window and runs down
  the clip's row, as the panel did. The page never scrolls by itself.
- **The line under an open palette is a handle**: drag it up to make the palette shorter, and its tools
  scroll inside; drag it down to give the room back. It is never taller than its tools, so no empty room
  shows, nor shorter than 48px, about one row of tools. A double-click gives the full height back. Tab to it
  and press ↑ ↓ (Shift for 64px instead of 16px). Hovered, focused or dragged, the line thickens.
- **Dragging a header moves its palette.** A press that moves 5px or more becomes a drag; the palette fades,
  a blue line shows where it would land (before the palette under the pointer's half, or after the last),
  and letting go moves it there. The click that ends a drag doesn't fold or open it. Near the column's top or
  bottom edge the column scrolls while the pointer rests there. A right-button press does nothing.
  On a focused header, **Alt+↑ ↓** moves it up or down one, and not past either end.
- **One button at the column's top right collapses** the whole column to a 40px strip holding only that
  button, now Expand; pressing it brings the column back with the same palettes open. The clip widens into
  the room. No palette icons in the strip (one way to open a palette).
- **Chat's status**: while a reply runs, Chat's icon shows its three pulsing dots, and a reply that ended
  unseen puts a dot on it, until Chat is open and the column expanded (issue #442). Collapsed, the strip's
  button shows the same dot (pulsing while a reply runs). A screen reader hears "Chat: Replying…" or
  "Chat: New reply" while Chat can't be seen.
- **A chord's Edit** (a chord name's, or the Chord chart's) expands the column if collapsed, opens Chords
  without folding anything else, and scrolls the column, not the page, to Chords. Folding Chords, or
  collapsing the column, forgets which chord was asked for, so opening it again shows the Chord set.
- **A tool's panel** (Bend, Tuplet, Octave line, Whammy bar, the Grid) is fixed to the window under its
  button, so a palette that scrolls can't cut it off; it closes if the page or the palette scrolls.
- **Kept across visits** in `frets.tab.layout`: `{ open, order, heights, collapsed, width }`. It is how the
  window is laid out, not a preference, so Settings doesn't list it. A first visit, or anything unreadable,
  opens Notes only, in the first order, expanded, 272px wide.
- **Under 900px** the column sits over the clip, as tall as its open palettes, with no width handle.
- **No page keys.** Alt+↑ ↓ and the handles' arrows work only on the focused header or handle, so the `?`
  overlay doesn't list them (as the width handle's aren't).

## Tests

- A first visit lists Notes (open, with the pencil, Duration and Rhythm), Articulations, Bars, Chords and
  Chat (folded), each header with its icon (Articulations' is a vibrato's wavy line); no rail.
- Pressing Articulations and Bars opens both beside Notes, their tools shown; pressing Notes folds it.
- Collapse leaves only Expand (no column, no tools); Expand brings back Notes and Chords open as they were.
- Bars opened keeps `{ open: ['notes', 'bars'], order: [first order], heights: {}, collapsed: false, width: 272 }`;
  after Alt+↑ on Bars, ↑ on Notes' handle and Collapse, the next visit is collapsed, then shows Notes, Bars,
  Articulations, Chords, Chat, Notes 48px.
- A header and a tool pressed keep the tab's cursor (Palm mute lands on the note).
- `.tab-tool-panel` is `position: fixed`; `.tab-stack` scrolls.
- Dragging Notes' header 20px down (jsdom: every palette's middle is at 0) lands it last, the line drawn
  after Chat, and the click ending the drag doesn't fold it; kept order follows. A 4px move then a click is a
  press: it opens Bars. A right-button drag moves nothing.
- Alt+↓ on Notes puts it second; Alt+↑ twice puts it first and no further; Alt+↓ on the last does nothing;
  ↓ without Alt moves nothing.
- `moveTo`: Chat to 0 goes first; Notes to 5 goes last; Notes to 2 goes second; Bars to 2 or 3 stays.
- Notes' handle dragged 100px down from 48px makes it 148px, kept only on letting go, as `heights: { notes:
  148 }`; dragged far up it stops at 48. Shift+↓ makes 112, ↑ 96; a double-click clears it (no height, none
  kept). Folded, Notes has no handle.
- `parseLayout`: nothing, bad JSON, an array, or every field the wrong type read as a first visit; open
  `['chat', 'bars', 'tuplets']` reads `['bars', 'chat']`, `[]` stays empty; order `['chat', 'notes',
  'chat', 'tuplets']` reads Chat, Notes, then the rest in first order; heights `{ notes: 120.4, bars: 10,
  chat: '90', tuplets: 100 }` read `{ notes: 120, bars: 48 }`; collapsed true; width 320, null → 272,
  100 → 224, 9000 → 560, 300.6 → 301.
- The width handle: as `2026-11-08-tab-rail-width-design.md`'s tests, named "Palette width"; gone when
  collapsed; hidden under 900px.
- A Chord chart chord's double-click on a collapsed column expands it with Chords and Notes open and Edit G
  shown; folding and opening Chords then shows no Edit G.
- Chat's icon: `working` and "Chat: Replying…" while a reply runs, still while Chat is folded; `unread` and
  "Chat: New reply" after; opening Chat clears it, and folding it again doesn't bring it back.

## How

1. `TabRail.tsx`: `usePalettes` (held by `TabPage`) keeps the layout and `show(id)`; `parseLayout` reads it;
   `TabRail` draws the column or the strip; `Palette` a header and body; `HeightHandle`, `WidthHandle`;
   `useReorder` the header drag and its edge scrolling; `moveTo` the order change.
2. `TabPage.tsx`: Chat's `open` is `palettes.shown('chat')`; a chord's Edit calls `palettes.show('chords')`;
   Chords not shown clears `chordsAt`; the strip keeps the tab's cursor and note input mode like the column.
3. `TabPalette.tsx`: a tool's panel is fixed at its button and closes on a scroll.
4. `tab.css`: the column, headers, handles, the drop line, the strip; the rail's rules go.
5. Tests: `src/__tests__/tab/page/palettes.test.tsx` (was `rail.test.tsx`); the helpers in
   `src/__tests__/tab/tool.ts`; the Chat, Chords and double-click tests press headers.
6. The Tab README, `src/lib/README.md` (the key), the Chords panel test arrangements' steps.
