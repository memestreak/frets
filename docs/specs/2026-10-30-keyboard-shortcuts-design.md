# Keyboard shortcuts on `?`

Issue #180. Jeremy, 2026-10-30: "the ? shows an overlay with keyboard
shortcuts."

## What it does

- `?` anywhere on any page opens a list of that page's keyboard shortcuts.
  `?`, Esc, the × and a press outside it close it, and whatever had the keys
  before (say, the tab, whose cursor shows only while it has them) gets them
  back.
- `?` typed in a field (an input, a list, a text area, an editable element)
  types; with ⌘, Ctrl or Alt held it is left to the browser. A key the page
  already used (`defaultPrevented`) is left alone. While another dialog is
  open, `?` does nothing: the dialog's keys are its own.
- The list is grouped by where the keys act. Every page ends with
  **Everywhere** (`?` and Esc). A page with no keys of its own (the Tuner,
  the Circle of fifths) shows only that group.
- Keys are drawn as key caps. `Mod` is ⌘ on a Mac and Ctrl elsewhere, and on
  a Mac Shift, Alt and Ctrl are ⇧ ⌥ ⌃.
- No visible button opens it yet; `?` is the only way in.

## One list per page, kept with the keys

`src/lib/shortcuts.ts` holds the types: a group is a title and its
shortcuts, a shortcut its keys (alternatives) and what it does. A page hands
its groups to `useShortcuts` (`src/components/shortcuts/useShortcuts.ts`), a
module constant written next to the code that binds the keys:

| Page | Groups | Bound in |
|---|---|---|
| Tab | Page, Moving on the tab, Note input, Selected notes, On the staff, Palette, Off the tab | `editorKeys.ts`, `TabPage.tsx`, `tools.ts` |
| Chords | Chords | `ChordsPage.tsx`, `VoicingGroups.tsx`, `ChordPickers.tsx` |
| Triads | Triads | `Triads.tsx` |
| Scale lab | Scale lab | `ScaleLab.tsx`, `DiatonicChords.tsx`, `PositionShapes.tsx` |
| Interval and Note trainers | Trainer (T only with a tuner) | `useQuizKeyboard.ts` |

The Tab page's **Palette** group is built from the palette's own table
(`TOOL_GROUPS` in `tools.ts`), the same table the buttons' tips read, so a
tool's key in the list is always the key its tip names. Tools that share a
key are one row, read as the steps the key goes through ("Accent, then heavy
accent"). The other Tab groups are written by hand from `editorKeys.ts`. A
registry that also *binds* the keys (one table both drawn and dispatched
from) would end the drift for good, but means rewriting every page's key
handlers; it is left for later.

Not listed yet: ⌘S, ⇧⌘S and ⌘O, which the Arrangements redesign (#259) adds;
that PR adds them to the Tab page's Page group.

## Look

A dialog over a dimmed page (Jeremy picked it from three mocks, 2026-10-31),
the groups in two columns where there is room, one on a phone; the whole list
scrolls. Each group's title sits on a band so the groups stand apart. While
the band is open, `?mock=` picks one:

- **a** (default): a sunken band (`--surface-sunken`), ink text.
- **b**: a rosewood band (`--fretboard`), string-coloured text (`--string`).

Once Jeremy picks one, the other and the `?mock=` switch go.
