# Circle of fifths: notes ring and parallel chord table

Jeremy, 2026-10-08: option 2 (Notes ring) and insight A (chords of every
parallel mode) from https://claude.ai/artifact/77Fh6v7USv19keJL7Xemsq.
Evaluation: /mnt/project-files/circle-of-fifths/review/evaluation.md.
Spec: docs/specs/2026-10-07-circle-of-fifths-design.md (updated).

1. `circle.ts`: spell a mode from its parent key (`parentKey`), keeping
   the root's name when the parent's other spelling allows it (D♭ Locrian
   → C♯ Locrian, F Locrian from G♭ major). Lit cells carry their spelled
   name. A ring of twelve notes in every model (lit run, root pin; Mode
   view labels and picks). Parallel rows carry each mode's seven chords,
   whether each matches the current mode, and the note swapped in.
   Rim labels, relative cells and Mode view chips go.
2. `CircleWheel.tsx`: the notes ring with curved mode names, the root
   pin, the run outline and a dashed preview; same size in both views.
3. `ModePanel.tsx`: the chord table; rows preview their run on hover or
   focus. `CircleOfFifths.tsx`: wheel and panel side by side from 1000px.
4. Tests, lint, typecheck, build; screenshots at desktop and phone.
