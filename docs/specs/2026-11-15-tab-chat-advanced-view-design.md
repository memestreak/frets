# Tab: the Chat panel's advanced view, each request and response

Jeremy, 2026-11-15: "I'd like the ability to more closely see what
information is being passed back and forth in chat. I'd like to be able to
toggle on an advanced view that shows me my outgoing and incoming chat data
in a structured way. Each section should begin minimized but can be
expanded. The intention is to make it easy to debug prompts and responses."

Issue #495. The questions and his answers (Q1 to Q7, all as recommended)
are on https://claude.ai/artifact/1bTBUwEhC18eHuwnJ47GbZ. Builds on the
Chat panel (`2026-11-08-tab-chat-design.md`, issue #424).

## What it does

- **The toggle (Q1).** A preference, `advanced` in `frets.tab.chat`, off at
  first. Settings › Tab › Chat lists it as the check box "Advanced view: each
  request and response". A `{ }` toggle at the end of the Chat panel's Model
  row ("Advanced view", lit when on, like the Chords panel's Hear toggle)
  changes the same saved value at once.
- **Where (Q2).** With the view on, each reply, each error and the reply
  still running ends with one folded section, "Requests and responses
  (N calls)", under its cost line.
- **Each call (Q3).** Inside it, one folded section per model call, headed
  "Call 2 · anthropic/claude-opus-5.5 · 1,200 in, 40 out · 1.2 s" (the model
  that answered, the call's own tokens, how long it took), or ending
  "failed", or "waiting" while it runs. Each call holds:
  - **Request**: the model and the URL; Headers; the system prompt (with its
    length in characters); Messages (N), each headed by its role and first
    line (a tool call by its tools' names, an image as "[image, 412 KB]");
    Tools (3), each with its description and parameters; Raw JSON.
  - **Response** ("Response · failed" in red for a failed call): the HTTP
    status, the model that answered, the error when there was one, the text,
    each tool call with its id and its arguments pretty-printed; Usage
    (prompt, cached and completion tokens, cost in dollars to 6 places);
    Raw JSON.
  - **Tool results (N)**: each tool the model called, by name ("· failed"
    when it refused), with its call id, its arguments and what it answered
    the model.
- **Every section starts folded**, opens and folds from its heading (▸ ▾),
  and draws nothing inside it while folded. A section stays as the viewer
  left it while its reply is on screen; the running reply's sections fold
  again when it ends and becomes an entry.
- **Repeated messages (Q4).** Every request lists the whole conversation it
  sent. Messages new since the reply's previous call are marked "new"; in a
  reply's first call, the viewer's message is.
- **Raw JSON (Q5)** is pretty-printed, with every `data:` URL longer than
  120 characters shortened to its type and size, as
  `data:image/png;base64,… (412 KB)`. Its Copy link copies the body whole,
  images and all, and says "Copied" for a moment. The request's raw JSON is
  the body exactly as sent (the system prompt marked for caching, `usage`);
  the response's is the body as it came, as text when it isn't JSON.
- **The key (Q6)** is never shown: Headers lists the headers sent with the
  key as `Bearer ••••` and its last 4 characters.
- **Kept for the visit (Q7).** Calls are recorded whether or not the view is
  on, so turning it on shows earlier replies too. New chat or a reload drops
  them with the conversation.

## How

- `chat/openRouter.ts`: `completeWithOpenRouter` returns an `Exchange` with
  the completion (URL, masked headers, body, status, answer, time), and a
  `ChatError` carries one when the call got that far. `maskedKey`.
- `chat/reply.ts`: `CallRecord`, one per call (the request, `newFrom`, the
  exchange, the answer, its model and usage, each tool result, the error);
  `runReply` reports them through `onCalls` and returns them as `calls`.
- `chat/useChatSession.ts`: each reply and error entry keeps its `calls`;
  the running reply's are on `working`.
- `chat/advanced.ts`: the view's text (headings, shortened images, JSON).
- `chat/CallDetails.tsx`: the folded sections.
- `chat/chatPrefs.ts`, `tabSettings.tsx`: `advanced` and its check box.

## Tests

- `advanced` is false by default, kept when saved as `true`, false for
  anything not a boolean.
- A `data:` URL of 4,096 base64 characters shows as
  `data:image/png;base64,… (4 KB)` at any depth; `data:x,1` and plain text
  are kept.
- JSON shows with two-space indents; a body that isn't JSON shows as it
  came; arguments that aren't JSON show as sent.
- A message with one image is headed "user · [image, 4 KB]"; a model's tool
  call "assistant · calls read_arrangement"; an empty answer "assistant".
- A call is headed "Call 2 · m/full · 1,200 in, 40 out · 1.2 s"; a failed
  one "Call 1 · m · failed"; one waiting "Call 1 · m · waiting".
- `maskedKey('sk-or-v1-abcd1234')` is `••••1234`; nothing recorded holds
  the key.
- A reply of two calls records two: the first's `newFrom` is the viewer's
  message, the second's the model's tool call and the tool's answer; the
  tool result holds the arrangement; `onCalls` is told as each call is sent,
  answered and its tools run.
- A failed call is recorded with its error and its exchange; a stopped one
  with "Stopped.".
- The exchange keeps the body exactly as sent, `Bearer ••••` and the last 4
  characters, X-Title, the URL, status 200 and the parsed answer; a 502 with
  a text body keeps the status and text; a call that never reached
  OpenRouter has no status; a 200 with no choice keeps status 200.
- On the page: off at first; turned on after a reply, the toggle is pressed,
  `advanced` is saved, the reply's "Requests and responses (2 calls)" is
  folded and draws no call; unfolding shows Call 1 with its tokens; Call 2's
  Messages (3) marks 2 "new"; Headers show `Bearer ••••test` and the panel
  never shows the key; Call 1's tool result shows the arrangement's bars;
  Settings' check box is on, and turning it off there hides the view and
  unlights the toggle.
- A 401 shows its call failed, "Response · failed" with status 401, and the
  answer's message in its raw JSON.
- New chat clears the calls.
