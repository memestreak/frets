# Tab: a Chat panel that reads and changes the arrangement

Jeremy, 2026-11-08: "Some type of embedded Chat Canvas on that page that
allows me to prompt a model to analyze or update the arrangement … I'm
wondering if it will be possible to do without having to have more
server-side infrastructure." Then, on Cloudflare's AI Gateway: "I'm only
interested in using [it] to make it easier for me to evaluate different
models. It would be the same use case as Model Router."

Issue #424. The options and his answers (Q1 to Q9) are on the proposal page,
https://claude.ai/artifact/KdPp237qyFzq9tJ1RopGVt.

## What it does

- **On the rail for everyone.** The rail has a Chat button, after Chords,
  and Settings lists Tab › Chat. It first shipped hidden behind `?chat`
  (Q8); Jeremy unhid it on 2026-11-09 ("I want to unhide it").
- **No Frets server (Q1).** The page calls OpenRouter's chat completions
  (`https://openrouter.ai/api/v1/chat/completions`) straight from the
  browser with the viewer's own OpenRouter key. OpenRouter allows this from
  any site (tested 2026-11-08: preflight `204`,
  `access-control-allow-origin: *`). The static-export ADR stands.
  Cloudflare's AI Gateway was ruled out: it sends no CORS headers (its
  preflight answers `401`, the REST API's `405`), so it would need a proxy of
  our own.
- **One request format for every model (Q9).** OpenAI-style chat
  completions with tools, so any OpenRouter model works by name while models
  are compared. Claude-only features (thinking) wait until a model is chosen.
- **Cheaper requests (issue #424, 2026-11-08: about 8¢ a Haiku ask).** The
  system prompt, mostly the guide (about 10k tokens), is marked
  `cache_control: ephemeral`, so Claude and Gemini read it from their cache
  after the first call, within a reply and for a few minutes after; OpenRouter
  drops the mark for other providers. Each ask is sent with the arrangement as
  it is then (what `read_arrangement` answers, in `<arrangement>` tags after
  the ask), so the model needn't spend a call reading it first; the
  conversation keeps the ask alone, so earlier asks don't resend it.
- **Settings › Tab › Chat (Q2, Q5).** Two fields, saved under
  `frets.tab.chat`: **OpenRouter key** (a plain text field, shown as typed; autocomplete and spellcheck off and password managers told to ignore it, but autocorrect and autocapitalize left alone, because on macOS dots, a password field or either of those set "off" stop Chrome's text replacement) and **Model**
  (`anthropic/claude-opus-5.5` by default). The key stays on this device:
  never in a link, never sent anywhere but OpenRouter. Trimmed when saved.
- **The panel (Q7).** From the top: the **Model** field (the same setting as
  in Settings: type any model, or pick from a list under it, opened by
  pressing the field, its ▾ or the Down arrow key, of the viewer's presets
  saved on OpenRouter, as `@preset/<slug>` with their descriptions, then
  OpenRouter's models that take tools. The list shows everything until the
  viewer types, then what contains the typed text; a browser's datalist would
  hide every entry not containing the saved model); the
  conversation; a message box; **Send** (or Enter; Shift+Enter is a new line),
  **Stop** while a reply runs, and **New chat** once there is something to
  forget. With no key, the box is disabled and a line offers **Open
  Settings**, which opens Settings at Tab › Chat.
- **The conversation lasts this visit (Q6).** A reload, or New chat, starts
  again. Asks are sent with everything said before them. The page holds it,
  not the panel (issue #442): closing the panel or opening another keeps the
  conversation, the half-written message and a reply still running, whose
  changes go on landing in the clip (one Undo away, as ever). Leaving the
  page stops a running reply.
- **The Chat button shows the reply (issue #442).** While a reply runs, the
  rail's speech bubble holds three dots that pulse one after another, as a
  messenger shows someone typing, in the button's own muted ink (still dots
  for viewers who ask for less motion); its tip reads "Chat: Replying…". A
  reply that ends while the panel is closed leaves a small dot on the
  button's corner ("Chat: New reply") until Chat is opened. Screen readers
  hear both through a status line by the rail. Stop stays in the panel.
- **Under each reply:** a line per tool call ("Read the arrangement",
  "Changed bars 3 to 4 of track 1", "Changed bar 2 of track 1", in red with ⚠
  when it failed; the same line several times in a row is shown once, "(3
  times)"), then the
  model's words (as markdown: `docs/specs/2026-11-08-tab-chat-markdown-design.md`), then the model, the tokens in (and how many came from the
  cache) and out, and the cost OpenRouter reports, so models can be compared.
- **Changes apply at once, one Undo step per reply (Q3).** A reply's first
  change is an undo step; its later changes join that step, so one Undo
  takes the whole reply back. If the viewer edits while a reply runs, the
  reply's next change starts a new step.
- **Errors** show in red under the ask: a refused key, no credit, too many
  requests, no connection, Stop ("Stopped."), or a model that keeps calling
  tools (stopped after 12 calls; changes made by then stay, one Undo away).
- The message box and Model field keep the page's keys to themselves: Delete,
  Ctrl+Z and the like typed there never reach the tab.

## The model's tools (Q4)

- `read_arrangement`: the whole clip as alphaTex, one bar per line, each
  ending in a comment `// track T, bar B` (numbers from 1), then the number
  of tracks, the track shown, the cursor's bar, and the selected bars, then
  the problems Frets marks: each bar's red ⚠ (`barErrors`: a bar that doesn't
  add up, a tuplet that doesn't fit, an uneven Voice) as "Track T, bar B: …",
  and what the reader says reading the clip back ("Kept but not drawn yet:
  …"), or "Frets marks no problems." A change answers with the problems it
  leaves the same way, an uneven bar named once. Text the AlphaTex view
  can't read isn't the arrangement, so the model doesn't see it (issue #428).
- `replace_bars(track, first_bar, last_bar, alphatex)`: bars `first_bar` to
  `last_bar` of one track replaced by the given bars, more or fewer;
  empty deletes them; `last_bar = first_bar - 1` inserts before `first_bar`
  (and `first_bar = count + 1` after the last).
- `replace_arrangement(alphatex)`: the whole text, header lines included. A
  text with no `\title` keeps the arrangement's title, as the AlphaTex view
  does.
- Every change is read back by the AlphaTex view's reader
  (`readAlphaTex`). Text it can't read changes nothing, and its errors go
  back to the model, which can try again. Bars or a track that isn't there,
  wrong arguments, or arguments that aren't JSON are refused the same way.
- The system prompt says what the panel is for, that each ask carries the
  arrangement, how changes undo, and to mention problems that bear on the ask
  but fix them only when asked, then
  carries the agent guide, `public/tab-alphatex.txt`, fetched once a visit.

## How

- `alphatex.ts`: `alphaTexTracks(clip)` gives each track's head lines and
  bars' tokens, unwrapped; `writeAlphaTex` joins and wraps them, writing
  exactly what it wrote before.
- `chat/arrangementTools.ts`: the tool definitions, `describeArrangement`,
  `spliceBars`, `runTool`.
- `chat/openRouter.ts`: `completeWithOpenRouter` (the request, its headers:
  `Authorization`, `X-Title: Frets`; `usage: { include: true }` for the
  cost), `readCompletion`, `errorText`, `fetchToolModels`, `fetchPresets` (`GET /api/v1/presets` with
  the key; an ordinary key lists them, and browsers may ask, tested 2026-11-08).
- `chat/reply.ts`: `runReply`, the loop of model calls and tool runs, at most
  `MAX_STEPS` (12) calls; `systemPrompt`.
- `chat/chatPrefs.ts`: `frets.tab.chat` and its parser.
- `chat/ModelPicker.tsx`: the Model field and its list.
- `chat/ChatPanel.tsx`: the panel. `TabRail` takes its contents as `chat`.
- `clipState.ts`: a new action, `amend`, joins a change to the last undo
  step (a step of its own when there is none). `TabPage.tsx` sends a reply's
  first change as `replace` and the rest as `amend` while the clip is still
  the one the reply last set.
- `tabSettings.tsx`: the Chat section; a `textField`
  for a line of text.

## Not yet

- Streaming replies and thinking (after a model is chosen). Caching the
  conversation as it grows, not only the system prompt.
- Calling Anthropic directly once Claude is chosen (option A on the page).

## Tests

- `read_arrangement` numbers every bar of every track (`// track 1, bar 2`),
  names the track shown, the cursor's bar and the selected bars, says
  "Nothing is selected." with none, and its text reads back as the same clip.
- `read_arrangement` lists "Track 1, bar 2: Bar 2 doesn't add up to 4/4: 2
  beats short.", a short bar of track 2 as "Track 2, bar 1: …", "Kept but not
  drawn yet: tr (trill).", and "Frets marks no problems." with none; a
  `replace_bars` that leaves bar 2 short names it once, and one that fills it
  says no problems.
- `writeAlphaTex` writes as before (the alphaTex tests pass unchanged).
- `replace_bars` replaces bars 2 to 3 with two bars (4 stay 4), 2 to 4 with
  one (2), deletes bar 4 with empty text (3), inserts before bar 1 with
  `last_bar` 0 (5), appends with `first_bar` 5 and `last_bar` 4, and changes
  only the track asked for.
- `replace_bars` refuses track 3 of 1, bar 6 of 4, `first_bar` 3 with
  `last_bar` 1, `first_bar` 0, a fraction, a string track, and arguments that
  aren't JSON, changing nothing; text the reader can't read sends back
  "Not valid alphaTex, so nothing changed. Errors:" with its errors.
- `replace_arrangement` with no `\title` keeps "Four"; with one, takes it;
  unreadable text changes nothing. An unknown tool is refused by name.
- A reply runs the tools called in one message, sends both answers back by
  their call ids, ends with the model's words, and adds up tokens and cost; a
  model that keeps calling tools stops after 12 requests; Stop before a tool
  runs means no change.
- OpenRouter's answer is read with its tool calls (a malformed one dropped),
  model and cost; no choice is "The model sent no answer: …"; 401, 402 and
  other statuses get their messages.
- A deleted bar 4 is "Changed bar 4 of track 1"; a failed try is "Tried:
  changed bar 1 of track 1, but the alphaTex had errors". Three reads in a
  row, then a failed one, then a read show as three lines, the first "(3
  times)".
- The usage line reads `m · 12,345 in, 67 out · $0.0042`, with 10,000 cached
  `m · 12,345 in (10,000 cached), 67 out · $0.0042`, `m · $0.25`, `m`;
  OpenRouter's `prompt_tokens_details.cached_tokens` is read as the cached
  tokens. Every message but the system prompt is sent as it is.
- `frets.tab.chat` keeps a trimmed key and model; anything else falls back to
  no key and `anthropic/claude-opus-5.5`.
- `amend` after `replace` is one undo step, and redo brings it back; `amend`
  with no step before it is a step of its own; it clears redo.
- On the page, with nothing in the address: the rail ends Chords, Chat, and
  Settings lists Tab › Chat. With a key and no messages, the hint ends "Use undo to revert a reply's
  changes." and a More settings link that opens Tab › Chat.
  With no key, the box is disabled and Open Settings opens Tab › Chat, whose key
  and Model fields are plain text shown as typed, with autocomplete and spellcheck off and no autocorrect or autocapitalize attribute; saving `  sk-or-typed ` keeps `sk-or-typed` and
  enables the box.
- A reply that changes bar 1, then bar 2, then answers shows both lines, the
  answer and the usage summed; the bars change; one Undo puts both back. The
  request carries `Bearer <key>`, the model, the guide at the end of the
  system prompt, sent as one text part marked `cache_control: { type:
  'ephemeral' }`, and the ask last, followed by `<arrangement>` with its
  numbered bars and its problems.
- A second ask is sent with the first ask, alone, and answer, and only the
  second carries the arrangement; New chat clears the list
  and the next ask goes alone.
- A refused key shows OpenRouter's message and changes nothing.
- Delete and Ctrl+Z typed in the message box don't change the clip.
- A reply running when Notes opens goes on: the Chat button's status is
  working, tip "Chat: Replying…"; its change lands; ended, the button is
  marked unread ("Chat: New reply"); Chat again shows the ask, its tool line
  and the reply, and clears the mark, which doesn't come back on closing. A
  reply ended with the panel open leaves no mark.
- Closed and opened again, the panel keeps the conversation and the
  half-written message, and the next ask is sent with the earlier one.
- A reply can be stopped after the panel is closed and opened again;
  "Stopped.", and its late answer changes nothing.
- Leaving the page aborts a running reply's request.
- The Model field lists the presets first (`@preset/default`, "Tab
  default"), then only the models that take tools, all of them though the
  field holds a model only one contains; typing "tab def" leaves the preset;
  picking it saves `@preset/default` and closes the list; Escape closes it; a
  typed model is saved.
- `fetchPresets` lists active presets with a slug as `@preset/<slug>` (the
  name when there's no description), skips archived ones and ones without a
  slug, sends `Bearer <key>`, and is null on a 401 or no connection.
