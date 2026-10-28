# Tab: My arrangements (issue #187)

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
  what is shown opens with the dialog); an empty one says "Empty". A press on
  an arrangement opens it; the open one is filled.
- A kept arrangement's line ends, muted, with when it last changed, so two of
  one name can be told apart (Jeremy, 2026-10-28): the time today, else the
  day and time, with the year when it isn't this one. Built-ins have none.
- Each arrangement's line ends with Move (when there are folders: a menu of
  the other folders, and Top level when it is in one), Rename (the name
  typed in place: Enter or leaving keeps it, Esc cancels) and Delete. Its
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
