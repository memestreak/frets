# Plan: Tab playback options

1. `SpeedField.tsx` → generic `NumberField.tsx` (min, max, step, decimals, unit, labels).
2. `PlaybackOptions.tsx`: the menu, two menuitemcheckboxes and the seconds field.
3. `playback.ts`: `setLoopPause`, rest at loop end via `finished`, end the rest on play/halt/stop/seek.
4. `PlaybackFooter.tsx`: settings fields and parser, `onContextMenu` on Play, `onStopAt` after Stop.
5. `TabPage.tsx`: Stop at playhead sets the playback line.
6. Tests: settings parsing, the menu's toggles and field, persistence.
7. Verify in Chromium: both options on and off, rest timing, light and dark.
8. Double-click on Speed resets to 100%; ClipTitle renames the clip from the page title.
