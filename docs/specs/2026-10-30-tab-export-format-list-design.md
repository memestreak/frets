# Tab: the Export dialog's Format list

Issue #257. Jeremy (2026-10-30): "consolidate the downloads into a single
drop-down that includes the various formats that are available for
download. And we should have one download button."

## Before

Eight buttons in three styles over two rows: Copy PNG, Copy SVG, Download
PNG, Download SVG, then "Other formats": Download alphaTex, Download ASCII,
Download MusicXML ⚠, Download Guitar Pro ⚠. Then a status line and Done.
The image choices (preview, Size, Transparent, Clip name, Name) sat above
all of them though they only touch the images.

## The dialog

From top to bottom:

1. **Export ‹name›** and ×.
2. For PNG and SVG only: the preview and its size line.
3. **Format**, a list: PNG image (first, picked when the page opens), SVG
   image, ASCII tab, alphaTex, MusicXML, Guitar Pro. A red ⚠ before it, with
   the reason on hover, when the picked file can't hold all of the clip
   (MusicXML or Guitar Pro with FX on, as before). The dialog opens again on
   the format last picked while the page is open; it isn't saved.
4. Under Format, for PNG and SVG only (Jeremy, 2026-10-31: Format above
   the size and the other options; size only where it applies):
   - **Size (px wide)**, as before.
   - **Transparent background** On | Off (was "Transparent"; SVG leaves out
     its white rectangle, PNG its white pixels).
   - **Clip name** Show | Hide. The name is the clip's own; the dialog no
     longer has a field to change it for one export.
5. The status line on the left; on the right **Copy** and **Download**
   (primary).
   - **Download** saves the picked format through `saveFile.ts`, the same
     path as the card's Save as… list: the browser's Save As dialog where
     it has one (Chrome, Edge), else a download. The file names are the
     card's: `<name>.png`, `.svg`, `.txt`, `.alphatex.txt`, `.musicxml`,
     `.gp`, `<name>` being the clip's name.
   - **Copy** copies PNG and SVG as before, and ASCII tab and alphaTex as
     text. It isn't shown for MusicXML and Guitar Pro, which don't paste.

The preview and the image choices fold open or shut over 200 ms with a
fade as the format changes between an image and a file (Jeremy,
2026-10-31: appearing and vanishing at once was jarring). They stay drawn,
`aria-hidden` and `inert` while shut; the row eases between 0 and its full
height (`grid-template-rows` 0fr ↔ 1fr). With reduced motion they switch at
once. The dialog's top is pinned (8% of the window down) rather than
centred, so it only grows and shrinks downward.

Done goes: × and Esc close the dialog. The Export button that opened it
with a press lets go of its focus when the dialog closes, so it doesn't stay
lit (`useLetGoAfterUse`, app-wide for any button that opens a dialog).
Opened from the keyboard, it keeps the focus.

What each format holds is unchanged: the images and ASCII tab are the track
on screen; alphaTex, MusicXML and Guitar Pro are every track.

## Code

`TabExportDialog.tsx`: `TAB_EXPORT_FORMATS`, one table of what each format
saves (its `SaveKind` and a maker) and one of what Copy does. The dialog's
own `downloadText` helper is gone; downloads go through `saveFile`.

## Tests

`TabPage.test.tsx`: the list's options; for each format, whether the
preview and Copy show and that there's one Download; the format is kept
after closing; Copy for alphaTex and ASCII; Download for each text format
and SVG with its file name; the ⚠ only while MusicXML or Guitar Pro is
picked; Guitar Pro from the list and from the card's Save as… list; Format
before Size and no Name field. `LetGoAfterUse.test.tsx`: a pressed button
let go when the dialog it opened closes, kept when opened from the keyboard.
