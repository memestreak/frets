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

- **My arrangements**, latest change first: each row shows the title (the
  clip's own `\title`, so renaming one renames the other) and when it last
  changed ("Today, 9:45 PM", else the date). A press opens it; the pencil
  renames it in place (Enter or leaving the field keeps it, Esc cancels); the
  bin deletes it, with Undo in the dialog until it closes. Deleting the open
  one opens the latest other, or a new empty clip. The open one is filled.
- **New arrangement** opens an empty clip; **Duplicate** copies the open one
  (same title) and opens the copy.
- **Samples** (the folder, as before) and **Examples**, opened in place of the
  open arrangement as before: never saved, `#example=<id>` links kept, Back to
  my clip returns. **Keep a copy**, beside Back to my clip, makes the example,
  with any edits, a new arrangement and opens it.
- Layout mocks while he compares: `?mock=a` (default) lists the three under
  headings; `?mock=b` shows one at a time behind a My arrangements | Samples |
  Examples switch.

## Storage

`frets.tab.arrangements` is the index (`{ open, items: [{ id, name, changed }] }`);
each clip is under `frets.tab.arrangement.<id>`, so an edit writes only its
own clip. `frets.tab.clip` is gone (no users yet, no migration).

## Not now

- Export or import of the whole library as one file.
- A link to a kept arrangement (they live in one browser; `#tab=` shares one).
