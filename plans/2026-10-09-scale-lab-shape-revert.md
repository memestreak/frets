# Scale lab: keep the picked shape on a deselected tile

Bug: in the "In one position" card, stepping a chord to another shape and
then clearing the chord (click away, Esc, or tapping the tile) redrew the
tile with shape 1. The pick itself was kept (`shapePicks` in
`ScaleLab.tsx`); `PositionShapes` drew `shapes[0]` for every tile but the
selected one.

Fix: `PositionShapes` takes `shapeIndexOf(chordIndex)` instead of the
selected chord's `shapeIndex`, and every tile draws its own pick.

Test: `ScaleLab.test.tsx`, "keeps the picked shape on the tile once the
chord is cleared" (fails before the fix).
