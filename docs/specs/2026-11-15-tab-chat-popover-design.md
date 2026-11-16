# Tab: the Chat popover

Issue #488 ("FR: Tab: chat prompt popover over the score"); the Chat
palette's half, issue #498 ("Tab: typing in the Chat palette drops the
selection"); Space after Chat, issue #507 ("Tab: Space stops playing and
stopping the arrangement after using Chat"). Asked
2026-11-15 (Jeremy): "Please open a feature request that tracks a popover
for a chat based prompt." The options were mocked (`?mock=a|b|c`) and his
calls (Q1 to Q7) are on the questions page,
https://claude.ai/artifact/JxULYXbuBiCZX7pFGkHKYf.

The Chat panel (`2026-11-08-tab-chat-design.md`) is in the Rail, away
from the music. The Chat popover takes a prompt where you are on the tab
and sends it to the same conversation.

Dorico, MuseScore and Guitar Pro 8 have no model prompt. The nearest are
VS Code's inline chat (Ctrl+I), Cursor's inline edit (Ctrl+K) and
Notion AI: a field at the cursor whose answer shows in place.

## What

- **Opening (Q2, Q3).** Ctrl/⌘+I on the tab, as VS Code's inline chat,
  or Chat… at the end of the note and bar right-click menus (not a picked
  word's or mark's, which keep Edit and Delete). It opens under the line
  at the selection's first column, else at the cursor, which a right-click
  has already moved to what it pressed. The menu item is called Chat…,
  not Ask Chat (Jeremy).
- **What the prompt is about (Q4).** The chip in the popover's head says
  it, the first of: the selected bars ("Bars 3–4", "Bar 5"); a picked
  word, mark or bar line ("Palm mute mark in bar 2"); the note the cursor
  is on ("Note at fret 7 on string 3 in bar 2"); else "Whole
  arrangement". The prompt is sent after it, as "About the selected bars
  3 to 4: …" or "About the note at fret 7 on string 3 (counted from the
  highest) in bar 2, its column 1: …". Every Chat request, from the panel
  or the popover, also tells the model the cursor's bar, the selection
  and now what is picked ("Picked: the chord name in bar 3 of track 1.").
- **What you selected stays (Jeremy, 2026-11-15).** Opening the popover
  and typing in it keeps the selection, the picked thing and the lit note,
  as a chord name's field does: the tab doesn't let them go while the
  popover has the keys. Esc gives the keys back with them still there; a
  press away lets them go, as it does from the tab.
- **The Chat palette does the same (issue #498).** Jeremy, 2026-11-15:
  "When I make selections in the arrangement and attempt to use chat via
  the side palette, my selections disappear." Pressing and typing in the
  Chat palette keeps the selection, the picked thing and the lit note as
  the popover does, and the same chip, over the message box, says what
  the message is about; it is sent as "About …: …". What is picked and
  the cursor's note count only while the tab has them lit, so the
  palette, used without touching the tab or after a press away, says
  Whole arrangement and sends the message as typed. The keys going on
  from the palette to another control, or a press away, let them go.
- **Space types while Chat has the keys, then plays again (issue #507).**
  Jeremy, 2026-11-15: "Space should work when I'm typing in the chat text
  box, but if I've selected the arrangement space should start and stop
  the arrangement." In the palette's message box and the popover's field
  Space types a space, after Send too. A press back on the arrangement
  gives the keys back to the page wherever it lands: on a note or a staff
  line the tab takes them; on blank space above, below or between the
  staves (the presses that place the playback line and don't take the
  focus) the message box lets them go. Esc from the popover gives them to
  the tab. Then Space plays and stops, and nothing scrolls.
- **The reply stays in the popover (Q1).** After Enter the field empties
  and the popover stays open: the tool notes as they come ("Changed bars 3
  to 4…"), then the reply's markdown and its model and cost line, then
  Undo (when the reply changed the arrangement) and Open in Chat. Another
  prompt can follow in the same popover. A reply that ends while the
  popover is open is read, so Chat's icon shows no unread dot for it.
  Esc, or a press away, closes it; Esc gives the keys back to the tab and
  keeps the selection.
- **Earlier prompts (Q1).** ↑ in the field brings back the prompts sent
  from the popover this visit, newest first; ↓ goes forward again, to an
  empty field. No suggested prompts.
- **One conversation (Q5).** The popover sends through the Chat panel's
  conversation: its prompts and replies are in the panel's list, and Open
  in Chat closes the popover and opens the panel to carry on. The panel's
  half-written message and its images are left alone.
- **Changes apply at once (Q6).** As in the panel: one Undo step per
  reply. The popover's Undo is that Undo.
- **No model picker (Q7).** The model is the Chat panel's; the line under
  the reply names it.
- **With no key** the field is disabled and says to add the OpenRouter
  key in Settings first.

## Tests

- Ctrl/⌘+I opens the popover; with nothing selected its chip says Whole
  arrangement and the request is the prompt as typed.
- With bars 1 to 2 selected the chip says Bars 1–2 and the request
  starts "About the selected bars 1 to 2:".
- After Enter the popover stays open, shows the reply and its model
  line, and the prompt and reply are in the Chat panel's list.
- A reply that changed the arrangement shows Undo, and Undo takes the
  change back; a reply that changed nothing shows no Undo.
- ↑ brings back the last prompt sent, ↓ empties the field again.
- Esc closes the popover and keeps the selection.
- On a note, the chip and the request name that note, and the note
  stays lit while the popover's field has the keys.
- The bar menu ends with Chat…, which opens the popover.
- A picked chord name is described to the model ("Picked: the chord name
  in bar 1 of track 1.").
- In the Chat palette (issue #498): with bars 1 to 2 selected, pressing
  and typing in the message box keeps them lit, the chip says Bars 1–2
  and the request starts "About the selected bars 1 to 2:"; on a note it
  stays lit and the request names it; a picked time signature stays
  picked and is named ("About the time signature in bar 1:"); used
  without touching the tab, it says Whole arrangement and sends the
  message as typed; the keys going on to another control let the note go.
- Space after Chat (issue #507): Space types (the page leaves the key)
  in the palette's message box, after Send, in a new empty arrangement and
  in the popover's field; then Space plays after a press above the staff,
  far below the drawing and on a string or staff line in Tab, Both and
  Staff, after a press on a note (the tab has the keys), after Send and a
  press above the staff, in a new empty arrangement after a press in its
  bar, after Esc from the popover, and after Send in the popover and a
  press above the staff.
- `aboutBars`, `aboutThing` and `scopedPrompt` for one bar, several
  bars, a mark, a note, a dead note and none.
- `pickedWords` for a word, a bar line and a mark.

## How

1. `chat/useChatSession.ts`: `send(text)` sends `text` alone, leaving the
   draft; each reply records whether it `changed` the arrangement.
2. `chat/ChatPopover.tsx`: the popover.
3. `chat/about.ts` and `PageSpot.picked`: what the prompt is about, and
   what is picked in words in every request's description of where the
   viewer is.
4. `TabPage.tsx`: Ctrl/⌘+I and the menus' Chat…; `chat/useTabChat.ts`:
   where the popover opens.
5. `shortcuts.ts`: Mod+I, and the popover's own keys.
6. `usePageKeys.ts`: the popover and the Chat palette are places the tab
   keeps what is picked and lit for (`TAB_KEEPERS`); `TabPage`'s
   `TAB_KEEPS` keeps the selection on a press in the Chat palette.
7. `chat/useTabChat.ts` `chatAbout` and `ChatPanel.tsx`: the palette's chip, and
   `send(undefined, about)` in `useChatSession` (issue #498).
8. `usePlayRange.ts` `pickColumn`: a press on blank space (which
   `TabClip`'s `keepFocus` keeps from taking the focus) lets go of a
   field off the tab, the Chat palette's message box above all (issue #507).

## Not yet

- A menu for choosing what goes with the prompt as context, and what to
  do with the reply (such as writing it into new bars) (Jeremy's note on
  Q4: "It's possible that we want an advanced menu").
- A preview of the changes before they are kept (Q6, option 2).
