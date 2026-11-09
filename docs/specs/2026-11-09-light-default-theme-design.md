# Light by default

Date: 2026-11-09. Asked by Jeremy: "make the default theme in frets the light
mode theme".

## What

With nothing saved and no `?theme=` in the link, Frets is Light, even when the
system prefers dark. Until now it was Auto, which follows the system.

A saved choice (Auto, Light or Dark, from the theme button or Settings ›
General › Appearance) and a link's `?theme=` still win, as before. Auto stays
an option and still follows the system.

## Decisions

| Question | Decision |
| --- | --- |
| Where the default lives | `DEFAULT_THEME` in `src/lib/theme.ts`. `parseAppearance` reads a missing or bad saved value as Light; Settings' default (a double-click on the label) is Light. |
| No dark flash | `<html>` is rendered with `data-theme="light"`, so the page is light before any script runs; the `<head>` boot script then sets the saved or linked choice, as before (Auto removes the attribute). |
| Pages whose hydration fails | Some pages (`/chords`, `/tab`, `/explore/scales`, `/metronome`) hit React error #418, and React then draws the whole document afresh, which drops the boot script's `data-theme`. Before this change a saved Dark there fell back to the system; now `ThemeSwitch` applies the saved choice again before paint. Fixing #418 itself is separate. |
| The phone's status bar | Its `theme-color` meta now follows the theme in use: one meta for Light or Dark, one per system theme for Auto. The boot script and `applyTheme` make it, not Next's `viewport.themeColor`, because React puts its own metas back on hydration. |
| The switch's order | Unchanged (Auto, Light, Dark), so from the default a click gives Dark, then Auto, then Light. |
| MCP Apps | Unchanged: they take the host's light or dark theme. They don't read the site's saved choice (a host's iframe is its own origin). |

## Tests

- Nothing saved, system dark: the page is Light, the switch says Light, and
  nothing is saved.
- A missing or bad saved value reads as Light; a saved Auto stays Auto.
- A saved Auto removes `data-theme` (follows the system); a saved Dark or a
  `?theme=` still wins.
- Clicking the switch from the default goes Dark, Auto, Light, saving each.
- A saved Dark is put back after React resets `<html>`.
- The status bar meta: Light or Dark gives one meta of that colour, Auto one
  per system theme, from both `applyTheme` and the boot script.
