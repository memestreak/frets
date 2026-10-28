# Plan: held and released bends (Guitar Solo 3, PR 1 of 5)

1. `clip.ts`: `bendCarries` (tied notes holding or letting down the bend before) and `bentSemitones`.
2. `alphatex.ts`: a tied release writes `b (q 0)`.
3. `TabClip.tsx`: `BendCarry` draws the dashed hold and the release arrow; a release's number and its gap in the string line go.
4. `layout.ts`: carried bends take no room of their own. `marks.ts`: their hit boxes.
5. `notation.ts`: bent heads at the reached pitch, `bent` flag; `StaffDrawing.tsx` brackets them; `staffMarks.ts` draws a line for a tie between two pitches and no bend arrow on a carry with the staff alone.
6. Example "Held bends"; `heldBends.test.tsx`; `public/tab-alphatex.txt`.
7. Verify in a browser: Tab, Staff and Both; press the hold and the release; play.
