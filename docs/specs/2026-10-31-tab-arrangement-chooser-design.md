# Tab: Arrangements… as a file chooser, and Save instead of autosave (issue #259)

Jeremy, 2026-10-30 and 31. The arrangement manager should feel "less like a clip
previewer and more like a simple file chooser", and arrangements are saved with a
**Save** button, not as they are edited. This replaces the saving and the dialog of
`2026-10-28-tab-arrangements-design.md` (issue #187); its storage, folders,
picking, delete with Undo and dragging stay as that spec has them.

## Saving

- Nothing is written to My arrangements until **Save** or **Save as…**. The clip
  has unsaved changes while it differs from the clip as last saved or opened;
  undoing back to that clip leaves nothing unsaved.
- **Save** saves the open arrangement where it is. An arrangement never saved (a
  new clip, a built-in, an import, a drop or a link) asks for a name and a folder
  first, as Save as… does. Save with nothing to save does nothing.
- **Save as…** saves a copy under a name and in a folder; the page then shows the
  copy, and the arrangement it came from stays as last saved. It replaces
  Duplicate. Its dialog is narrow (376 px). Beside its folder list, **New folder** swaps
  the list for a name to type (Esc or × goes back); the folder is made when Save
  is pressed, so Cancel leaves none behind.
- **A dot on Save** (small, muted, at its corner) shows unsaved changes. Save is
  never greyed out.
- **"Save changes to ‹name›?"** (Save / Don't save / Cancel) asks before unsaved
  changes are replaced: Open, New, Import…, a drop, a link followed while the page
  is open, or a link opened on a visit while a draft of other changes waits. Save
  on an arrangement never saved goes through Save as… first. Closing or reloading
  the browser tab with unsaved changes gets the browser's own warning
  (`beforeunload`; a page can't show its own there).
- **The draft** (`frets.tab.draft`): while the open clip has unsaved changes or was
  never saved, it is kept there, with the clip it is a change of (for one never
  saved), so a reload or a crash brings it back as it was, still unsaved. Saved and
  unchanged, the draft is cleared.
- **The next visit** shows whatever was open as it was left: the draft, else the
  arrangement the index names, else a new empty clip.
- **Renaming** in Arrangements… is a file operation: it saves the new name at
  once. The open arrangement's title follows, and its other unsaved changes stay
  unsaved; undo takes back the edits, not the name. Changing the title on the page
  is an edit like any other, saved with Save.
- **Keys**, anywhere on the page, in place of the browser's own: ⌘S / Ctrl+S
  Save, ⇧⌘S / Ctrl+Shift+S Save as…, ⌘O / Ctrl+O Arrangements…. ⌘N is the
  browser's (a new window), so New has no key. Over another dialog they do
  nothing.
- **The page's buttons**: New, Arrangements…, Save, Save as…, Import…, Export,
  Settings. Back to my clip and Keep a copy are gone, with the page's "shown in
  place" mode for built-ins.
- The card's **Save as…** (a file download) is now **Download…** ("Download text
  file", "Download alphaTex file" in the text views), so "Save" always means My
  arrangements.

## Links

- A `#tab=` / `#tabz=` link, and a built-in's `#example=<file name>`, open as a
  new arrangement, not saved. The link stays in the address until the clip is
  edited, saved or replaced, so a reload before then opens it again (Jeremy's
  pick, Q5). A link that can't be read says why and leaves the address.
- Opening a built-in from Arrangements… puts its `#example=` link in the address
  too, by the same rule.
- Saved arrangements have no link of their own; Copy link makes one from whatever
  is open.

## The dialog

Jeremy picked the two panes (mock b, over one folder at a time) on 2026-10-31.

- **Places** on the left: My arrangements, its folders under it (each with Rename
  and Delete, and each takes dragged arrangements, My arrangements too), then
  Built-in and its folders. The open arrangement's folder is shown on opening.
  Pressing My arrangements or Built-in while it is the place shown folds its
  folders away, or back (a small chevron says which); pressing it from elsewhere
  shows it unfolded (Jeremy, 2026-10-31).
- **Where**: beside the title, the place shown ("Arrangements › Built-in ›
  Rhythm"); the earlier steps can be pressed.
- **Files** in the middle: the chosen place's arrangements, one line each by name
  with a file icon,
  a saved one with its last change, Rename and Delete. Picking, Shift ranges,
  Cmd/Ctrl, Delete/Backspace and dragging the picked ones work as in #187.
  "Nothing saved here yet." in an empty folder.
- **Preview** on the right, not there until a single file is picked (Jeremy: no
  empty sheet). The file is drawn read-only (Staff, Tab or
  Both as the page draws), with no animation (Jeremy first asked for one, then
  found it a distraction, 2026-10-31). Under it, **Insert** puts the whole file in at the page's
  cursor (as a paste: one undo step, an edit of the open arrangement, no "Save
  changes?") and closes the dialog, and **Copy alphaTex** copies its text. For
  the built-ins this makes Arrangements… a library of small examples to recall the
  syntax from, copy or insert (Jeremy's use case).
- **Footer**: New folder; Cancel and **Open** (primary; never greyed: while no
  single file is picked it does nothing). A double click, a double tap or Enter on a line opens too, and
  the dialog closes.
- **One height**: the dialog is as tall as it can be up to 640 px whatever it
  shows, and the panes scroll inside it with thin scroll bars in the theme's
  colours.
- **Phones** (dialog narrower than 640 px): one folder at a time under a path
  ("Arrangements › Built-in › Rhythm"), folders heading the list; a tapped file's
  preview takes the whole dialog, with a Back link and Open there.

## Not done

- Whole-library export and import, per-arrangement links (as in #187).
- MusicXML import (skipped, 2026-10-30).
