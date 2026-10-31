# Tab: My arrangements (issue #187)

> Saving (autosave), the one-list dialog and built-ins shown in place of the clip
> are replaced by `2026-10-31-tab-arrangement-chooser-design.md` (issue #259).

Jeremy, 2026-10-28. The Tab page kept one clip; now it keeps any number, and one
dialog, **Arrangements…**, replaces Examples….

## Saving

- Always autosave (his choice): the clip on the page is always one of My
  arrangements, saved into the browser as it is edited, as the single clip was.
  There is no Save button and no unsaved state.
- A new, empty clip joins the list once it has a note or a title.
- Import…, a dropped file and a `#tab=` link open the tab as a **new**
  arrangement, so they never write over one that is kept. A paste still goes
  in at the cursor.
- The open arrangement is reopened on the next visit.

## The dialog

One list, one line per arrangement or folder, by name (A to Z, numbers in
number order). Jeremy, 2026-10-28: folders one level deep, samples in a
folder of their own, the built-ins as files in the repository.

- **My arrangements**: folders first, then the arrangements at the top level.
  A press on a folder opens or closes it (closed by default; the one holding
  what is shown opens with the dialog); an empty one says "Empty". The open
  arrangement's line is outlined.
- Picking and opening (Jeremy, 2026-10-30), as in a file browser: a click on
  an arrangement's line picks it alone (filled); a **double click** opens it.
  A double tap opens it on a phone too, counted by the dialog where the
  browser doesn't (two taps on one line within 400 ms). Enter or Space on a
  line opens it, so the keyboard needs no double press. **Shift**-click
  picks every line from the last one picked to this one, as listed
  (leaving out what is in closed folders); **Cmd**-click (Ctrl on Windows and
  Linux) adds or takes away one line. A press with Shift, Cmd or Ctrl never
  opens. Only kept arrangements are picked several at a time; a built-in line
  is picked on its own, and a folder's line still opens or closes it. The
  dialog opens with nothing picked.
- Delete on a picked line deletes every picked arrangement (its label says how
  many, e.g. "Delete 3 arrangements"); on a line that isn't picked it deletes
  that one. Delete or Backspace with the focus in My arrangements deletes the
  picked ones. One Undo brings them all back ("Deleted 3 arrangements."), and
  nothing stays picked after a delete. Dragging a picked line carries every
  picked one.
- A kept arrangement's line ends, muted, with when it last changed, so two of
  one name can be told apart (Jeremy, 2026-10-28): the time today, else the
  day and time, with the year when it isn't this one. Built-ins have none.
- An arrangement is moved by dragging its line onto a folder (the folder's
  line or what it holds, outlined while it is over one), or onto the list
  outside the folders for the top level (Jeremy, 2026-10-28: drag and drop
  in place of a Move button). Its line ends with Rename (the name typed in
  place: Enter or leaving keeps it, Esc cancels) and Delete. Its
  name is the clip's own `\title`, so renaming one renames the other.
- A folder's line has Rename and Delete; deleting a folder deletes what is in
  it. Every delete has Undo in the dialog until it closes. Deleting the open
  arrangement opens the latest other, or a new empty clip.
- **New arrangement** opens an empty clip at the top level; **New folder**
  adds "New folder" with its name ready to type; **Duplicate** copies the
  open one (same title) and opens the copy.
- **Built-in**: a folder per directory of `src/features/tab/builtin_arrangements/`
  (`song_structure` shows as "Song structure"), each file a line titled by its
  `\title`. They open in place of the open arrangement as the examples did:
  never saved, `#example=<file name>` links, Back to my clip returns, and
  **Keep a copy** makes one, with its edits, a new arrangement.
- The built-ins are files so they are managed in git: adding one is adding a
  file. All but `samples/` are round-trip tests (read with no warnings, every
  bar full, written back exactly); `samples/` is for trying things out.
  The topic folders replace the `example_` names Jeremy sketched:
  `articulations`, `rhythm`, `song_structure`, `sweet_child`, `samples`.

## Storage

`frets.tab.arrangements` is the index (`{ open, folders: [{ id, name }], items: [{ id, name, changed, folder? }] }`);
each clip is under `frets.tab.arrangement.<id>`, so an edit writes only its
own clip. `frets.tab.clip` is gone (no users yet, no migration).

## Not now

- Export or import of the whole library as one file.
- A link to a kept arrangement (they live in one browser; `#tab=` shares one).
