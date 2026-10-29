# Tab: the score's head in the drawing

Jeremy, 2026-10-28, after round 2 of drawing "Sweet Child O' Mine": the title, credits and tuning
were printed at the top of the page, over the palette. He wants them in the arrangement, "essentially
identical" to the head of the book's first page.

## What changes

- The head moves into the clip's card, under its top row of controls and over the drawing, laid out
  as the book does:
  - the title, large, centred;
  - the artist in bold, centred, under it;
  - "Words & Music by …" (or "Words by …" and "Music by …"), centred;
  - then the tuning on the left, a little in from the staff's start: "Tune down 1/2 step", then
    ① = E♭ … ⑥ = E♭ in two columns of three.
- It is part of the drawing. It uses the drawing's font and ink, and View options' Size zooms it with
  the drawing.
- The title is still the page's heading. A press on it opens the Title and credits panel
  (`docs/specs/2026-10-29-tab-credits-tuning-design.md`, issue #227).
- The text views (ASCII Tab, AlphaTex) show no head: their text already carries the title, credits
  and tuning (Jeremy). The page keeps a heading there for screen readers.
- The top of the page keeps only Examples…, Import… and Export options. An example's note ("Example:
  edits aren't saved") sits under the title.
- The exported image draws the same head, from the same sizes (`HEAD` in `credits.ts`), zoomed with
  the tab. With the Export dialog's Clip name on Hide, the image shows the tuning alone, as before.

## As typed

The book prints its title in capitals ("SWEET CHILD O'MINE"). That is the title as Guitar Pro's file
has it. Frets draws a title as it was typed.
