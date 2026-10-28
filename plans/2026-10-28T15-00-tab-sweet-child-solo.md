# Plan: Sweet Child O' Mine, round 3 (Guitar Solo 1, Verse 2, Chorus 2)

Spec: `docs/specs/2026-10-28-tab-sweet-child-solo-design.md`.

1. Transcribe bars 49–76 in the project files (not the repository); render beside the book's page 3
   and list the differences.
2. `clip.ts`: `legatoStarts`, the notes a hammer-on, pull-off or legato slide leaves from.
3. `TabClip.tsx`: `hiddenNumber` decides every left-out number (a let-down note unless a legato
   leaves it; under a staff, a tied or held note within a bar); the release arrow ends over a drawn
   number.
4. `heldBends.test.tsx` follows the book; `soloLook.test.tsx`; example `solo-bends` (bars 49–56).
5. CLAUDE.md. Check in a browser: the example in Both and Tab.
