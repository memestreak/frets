# Plan: the score's head in the drawing

Spec: `docs/specs/2026-10-28-tab-score-head-design.md`.

1. `HEAD` sizes in `credits.ts`; `ScoreHead.tsx` (title via `ClipTitle`, artist, credits, tuning)
   replaces `ScoreCredits.tsx`; styles in `globals.css`.
2. `TabPage.tsx`: the page header keeps the buttons; `ScoreHead` goes in the card, inside the zoom,
   over the drawing (and over the text views).
3. `exportTab.tsx`: `HeadDrawing` draws the same head in SVG, centred, zoomed with the tab.
4. Tests: `scoreHead.test.tsx`, the page test; browser check of the page at 70%, renaming, the text
   views and the Export dialog's image.
