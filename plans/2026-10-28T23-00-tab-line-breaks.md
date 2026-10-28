# Plan: the clip's own line breaks and bar widths

Spec: `docs/specs/2026-10-28-tab-line-breaks-design.md`.

1. Comment the plan on issue #153.
2. `Clip.systemsLayout`, `Clip.defaultSystemsLayout`, `Bar.scale` in `clip.ts`, validated, with
   `barsPerLine`; read in `alphatexRead.ts` (bad values kept as written, with a warning), written in
   `alphatex.ts`.
3. `layoutClip`: break lines by `barsPerLine`, still wrapping by width; a multi-bar rest counts as one.
   `shareByScale` replaces `justify` for such clips.
4. Tests in `lineBreaks.test.ts`; `public/tab-alphatex.txt` and the Tab README.
5. Sweet Child: `\systemsLayout` and `\scale` from the PDF into the transcription (`scom_gen.py`); the
   `outro-solo` example; side-by-side pictures of pages 2 and 9 in project files.
6. Check in a browser at desktop and phone widths.
