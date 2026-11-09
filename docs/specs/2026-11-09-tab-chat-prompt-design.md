# Tab: the Chat panel's prompt in Settings

Jeremy, 2026-11-08: "Allow the user to update the system prompt and add a
custom prompt as a settings config." Issue #426; the Chat panel is
`docs/specs/2026-11-08-tab-chat-design.md` (issue #424). His answers to the
design questions, 2026-11-09, all as recommended
(https://claude.ai/artifact/Vso2azUPuk1jCix9j6Jgi5):

- Q1: the alphaTex guide is always sent, fixed, and shown read-only under
  the instructions, folded.
- Q2: one custom prompt, not presets.
- Q3: the order is instructions, the guide, then the custom prompt.
- Q4: edited instructions are saved only while they differ from the
  default; "Reset to default" shows only then.
- Q5: an edit takes effect on the next message, mid-conversation too.

## What it does

- Settings › Tab › Chat adds two fields under the key and the model:
  - **Instructions**: a box holding the built-in lines, editable.
    Under it: "Then the alphaTex guide, always sent." with a **Show guide** button
    that unfolds the guide read-only in its own scrolling box (**Hide guide**
    folds it), and, only while the instructions differ from the default,
    **Reset to default** at the line's right end, so nothing moves when it
    appears. Double-clicking the label resets too, as every Settings field.
  - **Custom prompt**: an empty box, sent with every request when it holds
    anything but spaces.
- The system prompt is the instructions, a blank line, the guide, then, if
  there is one, a blank line, "The guitarist's own instructions:" and the
  custom prompt. Last is where a model gives a prompt most weight.
- Instructions cleared to nothing send nothing; the guide is still sent.
- Both are staged like every setting: OK or Apply saves them. The next
  message sent uses them, even in a conversation already going; earlier
  replies stay as they were.
- Enter in either box is a new line, not OK.
- Text is kept as typed: never trimmed or rewritten.
- Typing the default back word for word counts as not edited: Reset hides
  and nothing is saved for it.

## How

- `chat/chatPrefs.ts`: `DEFAULT_INSTRUCTIONS` (moved from `reply.ts`);
  `ChatPrefs` gains `instructions: string | null` (`null` is the default)
  and `custom: string`; `instructionsOf`, `keptInstructions`;
  `parseChatPrefs` reads both, an `instructions` equal to the default as
  `null`. Saved in `frets.tab.chat` with the key and model.
- `chat/reply.ts`: `systemPrompt(guide, prompts)` puts the parts together.
- `chat/guide.ts`: `loadGuide`, the guide fetched once a visit, shared by
  the panel and Settings (moved from `ChatPanel.tsx`).
- `chat/promptFields.tsx`: the two fields and the guide's fold (a read-only box, so the keyboard can reach and scroll it).
- `ChatPanel.tsx` builds the prompt from the saved prefs when it sends.
- `src/styles/components.css`: `.settings-textarea`, `.settings-prompt*`,
  `.settings-guide`.

## Not yet

- Several saved prompts to switch between (Q2: later, if swapping text gets
  tedious while comparing models, #424).
- Sending without the guide.

## Tests

- With nothing edited the prompt is the default instructions, a blank line
  and the guide, as before.
- Edited instructions replace the default; the guide still follows them.
- Instructions cleared to nothing: the prompt is the guide alone.
- A custom prompt comes last, after the guide, under "The guitarist's own
  instructions:"; one of only spaces and newlines sends nothing.
- `parseChatPrefs`: instructions equal to the default read as `null`;
  edited ones are kept as typed, spaces included; a non-string reads as
  `null`; the custom prompt is kept as typed; a non-string reads as `''`.
- Settings: the Instructions box shows the default and no Reset; an edit
  shows Reset; Reset puts the default back, hides itself, and OK saves
  `instructions: null`; typing the default back hides Reset.
- Double-clicking the Instructions label resets it.
- Show guide unfolds the guide's text read-only; Hide guide folds it.
- Enter in the Custom prompt box doesn't close Settings.
- A custom prompt saved mid-conversation is in the next request's system
  prompt.
