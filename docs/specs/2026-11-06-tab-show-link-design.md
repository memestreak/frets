# Tab: a link picks the staff view, the tab or both

Jeremy, 2026-11-06, on a preview link to a staff fix: "The preview link
assumes that the tab is visible but it's not by default. Is that something
that could be set in the preview link?" Then: "Yes, let's add that in a
separate PR."

## What it does

- A link to the Tab page can say which parts the Notation view shows:
  `/tab?show=staff`, `?show=tab` or `?show=both`. **Staff** is the staff
  view (the notation staff alone), **Tab** the tab alone, **Both** the staff
  over the tab, as the Staff | Tab | Both switch names them.
- It goes before any hash, so it rides with a tab link:
  `https://frets.eminor.net/tab?show=both#tabz=…`, and with `?theme=`:
  `/tab?theme=light&show=staff#example=…`.
- It holds for that visit only. The viewer's saved Show (Tab › Notation,
  `frets.tab.notation`'s `show`, Tab by default) is not changed, so the next
  visit without `?show=` opens as before.
- The page reads it once, on load, and takes it out of the address (the
  other parameters and the hash stay), as `?theme=` is taken out. A reload
  shows the saved choice.
- Pressing Staff, Tab or Both ends it and saves the choice as always, even
  when it is the one the link showed. Settings saving another Show ends it
  too. A change in View options saves the saved Show, never the link's.
- A value that names none of the three (`?show=notation`, `?show=Staff`,
  `?show=`) is ignored, and taken out of the address all the same.
- It doesn't switch views: the page opens in Notation, as always.

## Who makes these links

- Preview links Claude sends for a staff change carry `?show=staff` or
  `?show=both`, as they carry `?theme=light`.
- Agents writing a link for the user add it when the staff matters (a
  transcription from sheet music): `public/tab-alphatex.txt` section 8 and
  `public/skills/frets-tab/SKILL.md`.
- The `show_tab` MCP App's link (its result's "Open in Frets" link, and the
  Open in Frets button) carries the view it shows: the call's `view` in the
  result, the app's switch on the button.
- Copy link on the Tab page does not: what the page shows is the viewer's
  choice and stays out of the link
  (`docs/specs/2026-10-29-tab-share-link-design.md`).

## How

- `shareLink.ts`: `SHOW_PARAM`, `readShowParam(search)` and
  `dropShowParam()`; `shareLink(origin, text, show?)` puts `?show=` before
  the hash.
- `TabPage.tsx`: the link's choice is state, `{ show, over }`, `over` being
  the saved Show it was opened over. The page shows `show` while the saved
  Show is still `over`; the switch clears it. View options save
  `notation.show`, not the parts shown.
- `mcp/register.ts` and `mcp/ChatTab.tsx` pass the view to `shareLink`.

## Tests

- `readShowParam` reads `staff`, `tab` and `both`, also after another
  parameter; it reads nothing for none, `?show=`, `?show=Staff`,
  `?show=notation` and `?show=staff%20`.
- `shareLink(origin, text, 'staff')` starts `<origin>/tab?show=staff#tabz=`
  and reads back as the text; with no `show` the link has no query.
- `?theme=light&show=staff` over a saved Tab draws the staff view, saves
  nothing, and leaves `?theme=light` in the address.
- `?show=both` with nothing saved draws Both and saves nothing; `?show=tab`
  over a saved Staff draws the tab alone.
- After `?show=both`, pressing Both saves Both; pressing Staff shows and
  saves Staff.
- A View options change after `?show=staff` saves `show: 'tab'` (the saved
  one) and the page still shows the staff view.
- Settings saving Both after `?show=staff` shows and saves Both.
- `?show=notation` over a saved Both shows Both and leaves no query.
- `show_tab` with `view: 'tab'` answers with a `/tab?show=tab#tabz=` link;
  the app's Open in Frets opens `?show=both` for a call with no view and
  `?show=staff` once the switch shows the staff.
