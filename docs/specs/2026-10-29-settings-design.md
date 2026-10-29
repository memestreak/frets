# Settings (issue #195)

Jeremy, 2026-10-29. One Settings dialog lists every per-viewer preference. The
general rules, written for any of his apps, are in the project files
(`settings/settings-philosophy.md`). This spec covers the first version: the
dialog for the whole app, holding a General group and a Tab group.

## What goes in it

- **Preferences only.** Anything that rides in the clip (tempo, key, tuning,
  credits, and since #213 the Sound and FX) stays out.
- **Everything is mirrored.** View options (the eye), the playback footer, Play's
  right-click options, the Export dialog and Staff | Tab | Both all stay where
  they are. They change the same saved values as Settings, so each place
  always shows what the other set.

## Shape (mock A, his pick)

The dialog is shaped like REAPER's Preferences.

- **Left: a tree.** Each group has a ▸/▾ head and its sections under it. The
  open page's group is expanded and General is collapsed. The selected section
  is filled. There is no Find box for now (Jeremy, 2026-10-29).
- **Right: one section at a time**, in a framed pane headed `Group › Section`.
  Each field is a row with its label on the left and, on the right, the same
  control its shortcut on the page uses (G7): Export's Transparent stays On |
  Off and Clip name Show | Hide, the sizes and counts are number fields, the
  volumes are knobs, and the on/off fields that View options, Play's menu and
  the Metronome menu tick are check boxes. Footer toggles (Hear notes,
  Metronome, Show playback controls) are check boxes too. A check box carries
  no label of its own, so double-clicking the label never toggles it.
- **Fields that need another field on** (Count-in bars needs Count in, Pause
  length needs Pause between loops, Custom's Text and Background colours need
  Colours = Custom) are always shown, disabled while their parent is off, so the
  pane never moves (G1). View options keeps hiding Custom's swatches as it does
  today.
- **Keyboard in the tree** (G6): the standard tree pattern. ↑ ↓ move between
  the visible group heads and sections, and the pane follows the selected
  section. → opens a group, and ← closes it or moves from a section to its
  group. Tab leaves the tree for the pane.
- **Foot:** OK, Cancel, Apply.
- **Phone width:** the tree becomes two rows above the pane: a group picker
  (the app's `select.input`), then a strip of that group's sections that
  scrolls sideways. The pane keeps its `Group › Section` heading.
- It opens from a **gear button at the page top, right of Export options**. On
  this first version only the Tab page has one, and it opens Settings at Tab's
  first section, Playback. Tab's sections run most-used first (G3): Playback,
  Metronome (split from Playback, G4), Notation, Colours, ASCII Tab, AlphaTex,
  Export.

## Groups and sections (v1)

| Group › Section | Fields | Saved under |
|---|---|---|
| General › Appearance | Theme: Auto / Light / Dark | `frets.general.appearance` |
| Tab › Playback | Show playback controls, Volume, Transpose, Hear notes as you enter them, Stop leaves the cursor where it stopped, Stop playback at region end, Pause between loops, Pause length (Play's right-click menu) | `frets.tab.playback` |
| Tab › Metronome | Metronome, Count in, Count-in bars, Click volume (the Metronome toggle's right-click menu) | `frets.tab.metronome` |
| Tab › Notation | Show (Staff / Tab / Both), Bar numbers, Size, Clip's line breaks | `frets.tab.notation` |
| Tab › Colours | Theme / Paper / Sepia / Night / Custom, and Custom's two colours | `frets.tab.colours` |
| Tab › ASCII Tab | Rhythm | `frets.tab.ascii` |
| Tab › AlphaTex | Line numbers | `frets.tab.alphatex` |
| Tab › Export | Size (px wide), Transparent, Clip name | `frets.tab.export` |

## Storage

Preference keys follow the settings philosophy: one key per section, named
`<app>.<page>.<section>`, holding a JSON object of that section's settings. A
setting is named `<app>.<page>.<section>.<setting>` in docs and code (for
example `frets.general.appearance.theme`), and app-wide settings use `general`
as the page. This replaces CLAUDE.md's `frets.<section>.<page>` rule.

Keys that hold the work live under `<app>.<page>.works`: each work at
`<app>.<page>.works.<id>`, and the page's index of them (names, folders, which
one is open) at `<app>.<page>.works`. No preference section is named `works`.

- `frets.tab.arrangement.<id>` becomes `frets.tab.works.<id>`, and
  `frets.tab.arrangements` (the index) becomes `frets.tab.works`.

- `frets.tab.view` splits into `frets.tab.colours`, `frets.tab.notation`,
  `frets.tab.ascii` and `frets.tab.alphatex`, and `frets.tab.parts` moves into
  `frets.tab.notation` as `show`.
- `frets.theme`, a bare string, becomes `frets.general.appearance`, an object
  `{ theme }`. The `<head>` boot script reads the new key.
- The keys of the other pages (`frets.explore.scales`, `frets.chords.export`,
  `frets.tuner.settings`, the trainers' keys) are renamed when each page joins
  Settings, in its own PR.
- No migration (Jeremy, 2026-10-29: none in Frets until he says so). Saved
  arrangements and preferences under the old keys are left behind.

Sharing (Copy link's link type, #212) joins once a second choice exists. A
section with nothing to choose isn't shown.

## When changes take effect

- Changes inside Settings are staged. **OK** saves them and closes the dialog,
  **Apply** saves them and keeps it open, and **Cancel**, × and Esc throw them
  away. Saving updates the page at once: the footer's knob moves, and the clip
  redraws.
- **Apply** is disabled until a staged value differs from what is saved, and
  is disabled again after it is pressed.
- **A double-click on a field's label resets that value to its default**, and
  so does a long-press on touch screens. The label's tooltip says "Double-click
  to reset". The control itself never resets on a double-click, so text in a
  number field can still be selected. The reset is staged like any other
  change. There is no reset button for a section or for everything.
- **Storage that fails** (private browsing, blocked, full) never breaks the
  page: reads fall back to defaults. A failed save, from Settings or from any
  control on the page, shows a small red ⚠ right after the gear, with the
  reason on hover ("Settings couldn't be saved: storage is full"). It stays
  until a save works, and the dialog still closes (G5).
- The dialog is modal, so nothing behind it changes while it is open.
- **Enter = OK, as in REAPER** (G2): it saves and closes from anywhere in the
  dialog. In a number field being typed in, the first Enter commits the number
  and the next one is OK. Enter on a focused button presses that button.

## Code

- `src/components/settings/`: the dialog (tree, pane, staged values, OK /
  Cancel / Apply, label reset) and the General group. Each page hands it
  its own group as a list of sections and fields. A field has a label, a
  default, a read, a write and a control.
- `src/features/tab/tabSettings.tsx`: Tab's group, built on the page's existing
  state setters and parsers, so Settings and the in-page controls share one
  source of truth.
- The mock (`SettingsMock.tsx` and its CSS) is deleted.
- CLAUDE.md's Storage paragraph and `src/lib/README.md`'s key list are updated
  to the new naming.
- `saveJson` reports whether the save worked, so the dialog can show the ⚠.

## Later

Every preference in the app belongs in Settings. Scale lab, Triads, the Circle
of fifths, Chords, the Tuner and the trainers each get their group, gear and key
names in their own PR.

## Tests

- Staging: a change doesn't reach the page until OK or Apply, and Cancel drops
  it.
- Apply is disabled with no change, enabled after one, and disabled again after
  Apply.
- A double-click or long-press on a label stages the default, and a
  double-click on the control doesn't.
- A save that throws shows the ⚠ after the gear, OK still closes the dialog,
  and the next save that works clears it.
- Each section's parser: missing or invalid fields take their defaults.
- Mirroring: a volume set in the footer shows in Settings, and one set in
  Settings moves the footer.
