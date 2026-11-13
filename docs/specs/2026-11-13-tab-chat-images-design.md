# Tab: images pasted into the Chat panel, for the model to transcribe

Jeremy, 2026-11-13: "In the Frets tab page chat window, I'd like to be able
to give the model an image pasted from my clipboard. The use case is that I
have an image of a music staff or tab, or chord progression, and I'd like
the model to be able to transcribe it into AlphaTex, into the arrangement in
whatever way I've asked for."

Issue #465. The questions and his answers (Q1 to Q7) are on
https://claude.ai/artifact/1d6EMeAiT68g73JvwfpavB. Builds on the Chat panel
(`2026-11-08-tab-chat-design.md`, issue #424).

## What it does

- **Paste only (Q1).** Pasting an image into the message box (Ctrl+V or
  Cmd+V) adds it to the message, as a thumbnail above the box. Several may
  wait at once. A clipboard holding text as well as an
  image pastes both: the text into the box, the image above it. Dropping a
  file on the box adds nothing, and there is no button for it (his call,
  against the recommendation of paste, drop and a button).
- **A waiting image** shows 56 px tall, with a small round × on its corner
  ("Remove image N") that takes it out. Its hover shows its file name; a
  pasted image has none and is labelled "Image N".
- **Images with no words (Q6).** With an image waiting, Send works with an
  empty box; the ask is sent as "Transcribe the attached image into the
  arrangement." and shown as the images alone.
- **The request.** The ask's content becomes OpenRouter's OpenAI-style list
  of parts: the text (the ask, then the arrangement, as before), then each
  image as `{ type: "image_url", image_url: { url: "data:image/png;base64,…" } }`.
  An ask without images is still a plain string.
- **Images stay in the conversation (Q2).** As the words do: a later ask is
  sent with the earlier ask's images, so "now do the second line" works.
  New chat or a reload drops them. Each image costs input tokens on every
  later request; the cost line under each reply shows it.
- **Large images are made smaller (Q4).** An image longer than 2,048 px on
  either side is scaled in the browser so its longest side is 2,048 px,
  keeping its shape, and sent as PNG so staff lines stay sharp. A smaller
  image, or one the browser can't draw, is sent as it is.
- **A model that can't read images (Q3).** OpenRouter's model list gives
  each model's inputs (`architecture.input_modalities`). When the chosen
  model is listed without `image`, a small red ⚠ follows the waiting
  thumbnails; its hover (and its label for screen readers) reads
  "*model* can't read images, so it won't see these. Pick a model that
  can, such as anthropic/claude-opus-5.5." Send still works; OpenRouter's
  error shows if the model refuses. A preset, a model not in the list, a
  model whose inputs aren't listed, or no list at all get no ⚠, as they
  can't be known.
- **The default instructions (Q5)** gain one line: "An ask may come with
  images of music: a staff, a tab, a chord chart. Read them closely and
  transcribe what they show into the arrangement as asked, with its notes,
  rhythm, bars and chord names; say what you couldn't read rather than
  guess." Edited instructions keep the viewer's edit.
- **Seeing an image bigger (Q7).** Pressing a thumbnail, waiting or in a
  sent ask, opens it in a dialog titled with its label, as large as the
  window allows. Esc, the close button or a press on the backdrop closes it.
  Pressing a thumbnail puts focus in the message box first, so closing the
  dialog leaves focus there, not on a field that would open its list.
- Waiting images last as the half-written message does: folding the panel
  keeps them; New chat keeps them; sending clears them.

## How

- `chat/images.ts`: `ChatImage` (`url`, `name`), `imageFiles`,
  `fittedSize`, `imageFromFile` (scales with `createImageBitmap` and a
  canvas; falls back to `FileReader`), `MAX_IMAGE_EDGE` (2048).
- `chat/openRouter.ts`: `ContentPart`; a user message's content is a string
  or parts. `fetchToolModels` gives `ModelInfo` (`id`, `images`);
  `knownBlind(model, models)`.
- `chat/reply.ts`: `userContent(text, images)`, `IMAGES_ONLY_ASK`.
- `chat/useChatSession.ts`: `images`, `addImages`, `removeImage`; an `ask`
  entry carries its images.
- `chat/ChatPanel.tsx`: the paste handler, the thumbnails, the ⚠, and the
  full-size dialog (`Modal`).
- `chat/chatPrefs.ts`: the instructions' new line.

## Tests

- An ask without images is sent as a string; with images, as the text then
  each image part, in order. `IMAGES_ONLY_ASK` is "Transcribe the attached
  image into the arrangement."
- `fittedSize`: 3000×1000 is 2048×683, 1000×4096 is 500×2048, 2048×2048 and
  800×600 stay.
- `imageFiles` keeps only image files; a pasted "image.png" has no name,
  "page 3.png" keeps its.
- `fetchToolModels` reads `input_modalities`: listed without `image` is
  blind, with it or unlisted reads images; `knownBlind` is false for a
  preset, an unknown model and no list.
- A pasted image alone isn't pasted as text, shows as "Image 1", enables
  Send, and Enter sends it with "Transcribe the attached image…" and the
  arrangement; the box empties and the ask shows the image; the next ask
  sends the earlier ask's text and image again without the arrangement.
- Words and two images are sent as text, image, image, and the ask shows
  the words.
- A clipboard with text and an image pastes the text too; text alone is an
  ordinary paste.
- "Remove image 1" removes the first; with none left, Send is disabled.
- A thumbnail, waiting or sent, opens a dialog named by its label showing
  the image; Esc closes it.
- No: a dropped file adds nothing, and there is no Add image button.
- ⚠ shows for `text/only` (listed text-only) with the hover above; none for
  anthropic/claude-opus-5.5, for `@preset/default`, or with no images
  waiting.
