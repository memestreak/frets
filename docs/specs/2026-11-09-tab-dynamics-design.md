# Tab: dynamics

Asked 2026-11-09 (Jeremy, issue #437): "Does our application (tab) support
velocity in the storage format or playback? Does alpha tex?" Then, after
the answer: draw and edit dynamics.

alphaTex writes a dynamic as the beat property `dy` (`5.3.4{dy p}`). It
holds until the next one, and alphaTab's playback plays it: velocity 95
at the default `f`, 15 at `ppp`, 127 at `fff`. Frets used to keep `dy` as
written ("Kept but not drawn yet"), so it was already heard but couldn't
be seen or edited. alphaTex has no raw velocity numbers; hairpins (`cre`,
`dec`) were already drawn and stay as they are.

Editing follows Dorico first (`docs/tab-editing-principles.md`).

## What

- **What it is.** A Column's dynamic, from it on: any of alphaTab 1.8.4's
  dynamics Bravura draws: `ppp` to `fff`, `pppp` to `pppppp`, `ffff` to
  `ffffff`, and `sf`, `sfp`, `sfpp`, `fp`, `rf`, `rfz`, `sfz`, `sffz`,
  `fz`, `pf`, `sfzp`. Niente (`n`) has no glyph in our set, so it stays
  kept as written. A dynamic is stored only where it is written, as
  alphaTex does; nothing fills in the levels in between.
- **Drawn.** In Bravura's italic dynamic letters, centred on the column,
  on the hairpins' row: under the staff in Staff and Both views (between
  the staff and the tab in Both), over the tab's marks in Tab view, as
  Dorico and printed books put dynamics and hairpins on one line. A
  hairpin starting at a dynamic starts after it; one ending just before a
  dynamic stops short of it.
- **Voices.** A dynamic belongs to the staff, as Dorico and the books
  treat it: the same dynamic in two Voices at one time is drawn once (the
  part's own, which a press picks); two different ones stand side by
  side, the part's own first. Another Voice's dynamic is picked by making
  that Voice active.
- **Entered.** Shift+D (Dorico's dynamics popover key) or the Dynamic
  button (Accents group, drawn "mf") opens a small field under the
  cursor's column on that row, holding the column's dynamic. On an empty
  bar it goes on the first of the rests that fill it. Type `p`,
  `mf`, `sfz`… (any case, kept lowercase) and press Enter. What isn't a
  dynamic keeps the field open with a small red ⚠, its tip listing them;
  Esc, or leaving the field, leaves things as they were. An empty field
  takes the dynamic away. The button lights while the cursor's column
  has one.
- **The list** (Jeremy, 2026-11-09): in the field, the Down arrow key
  opens a list of the dynamics starting with what is typed (every one
  when nothing is), each in its drawn letters and as typed. It is in
  alphabetical order (Jeremy, 2026-11-09), so a word comes before the
  longer ones it starts: p, pf, pp, ppp…, and the dynamic typed exactly
  is first. It follows the typing, starting on its first entry; ↓ and ↑
  move through it (not past either end), Enter or a press sets the one
  picked, and Esc closes the list first, then the field. The placeholder
  says "mf, or ↓ for the list", and the ⚠'s tip points to it.
- **Picked.** A press on a dynamic picks it, blue, like any Mark. Delete
  takes it away; right-click has Edit and Delete; a double-click or Edit
  opens its field.
- **Time, not notes.** A dynamic belongs to its time, as a chord name
  does: deleting the notes leaves it on the rest; notes written over it
  take it; a split keeps it on the first piece.
- **Played.** By alphaTab, unchanged: the clip is written back as alphaTex
  for playback.
- **Exported.** MusicXML writes `<dynamics>` under the staff, before a
  hairpin starting with it.

## Tests

- `{dy mf}` reads as `dynamic: 'mf'`, with no "Kept" warning; `{dy FF}`
  reads as `ff`; `{dy n}` and two `dy` on one beat stay in `extra`.
- A clip with a dynamic writes `dy mf` back after the hairpin, and reads
  back the same.
- `dynamicOf`: ` MF ` is `mf`, `sfz` is `sfz`, `mm` and `n` are null.
- The row: a dynamic alone gives the hairpins' row; in Tab view it is
  over the tab, in Staff and Both under the staff.
- A hairpin starting on a dynamic's column starts right of its letters.
- Two Voices: the same dynamic at one time is drawn once; `f` and `pp`
  stand side by side, clear of each other, and only the part's own is
  picked.
- A press on a drawn dynamic picks `{ mark: 'dynamic' }`; Delete takes it
  away; the Dynamic tool is lit while it is picked.
- Shift+D opens the Dynamic field at the cursor; typing `pp` and Enter
  sets it; `xx` and Enter keeps the field open with a ⚠ and changes
  nothing; Esc changes nothing; an empty field clears it. Double-click
  and Enter on a picked dynamic open its field; its menu has Edit and
  Delete.
- The list: ↓ with nothing typed lists all 25 alphabetically, starting
  f, ff, fff; `p` lists p, pf, pp, ppp, pppp, ppppp, pppppp; `sf`
  lists sf, sffz, sfp, sfpp, sfz, sfzp, and typing SFZ narrows it to sfz,
  sfzp; `x` lists none and says so; with `m`, ↓ ↓ ↓ ↑ ↑ stays inside mf,
  mp, and ↓ Enter sets mp; a press on fff sets it; Esc closes the list,
  a second Esc the field, nothing changed; ↓ then `pp` starts on pp,
  and Enter sets it.
- Deleting the notes of a column with a dynamic leaves it on the rest.
- MusicXML: `<dynamics><mf/></dynamics>` in a `below` direction.
- A built-in arrangement draws dynamics and writes back exactly.

## How

- `clip.ts`: `DYNAMICS`, `Dynamic`, `dynamicOf`, `Column.dynamic`.
- `alphatexRead.ts` (`beatReads`) and `alphatex.ts` (`beatTex`).
- `smufl.ts` / `scripts/smufl-glyphs.mjs`: the six dynamic letters.
- `dynamics.ts`: `dynamicWord`, `drawnDynamics`, `hairpinSpan`.
- `rows.ts`: `Rows.dynamics`, the hairpins' row.
- `ClipMarks.tsx` draws; `marks.ts` picks (`DrawnMark` `dynamic`);
  `noteEdits.ts` `removeMark`.
- `tools.ts`: the `dynamic` word tool, Shift+D; `TabPalette.tsx` its icon.
- `WordField.tsx` (the ⚠), `fieldSpots.ts`, `useHeadPanels.tsx`
  (`setDynamic` in `barEdits.ts`), `TabPage.tsx` (`hasEdit`, Edit).
- `sounding.ts`, `timeline.ts`, `editing.ts`, `layout.ts`: a time mark.
- `musicxml.ts`; `public/tab-alphatex.txt`.
