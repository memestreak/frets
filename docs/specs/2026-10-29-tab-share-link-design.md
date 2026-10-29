# Tab: share an arrangement as a link (issue #206)

Jeremy, 2026-10-29. The Tab page has opened `/tab#tab=<text>` links since the
alphaTex format landed, but nothing in the app made one.

## The button

- **Copy link**, a chain-link icon button at the clip's top right after copy
  and before save, in all three views (Notation, ASCII Tab, AlphaTex).
- Pressed, it copies the link to the clipboard, shows a tick for a moment as
  copy does, and says "Copied a link to this arrangement." in the notice line.
- It links the clip as it is now (an example shown in the arrangement's place
  too), not the AlphaTex view's text as typed.

## What a link carries

- The clip's alphaTex, as Export writes it. The title is in it
  (`\title`); View options are per viewer and stay out.
- The Sound and the FX dialog's settings (Jeremy, 2026-10-29: "include the
  instrument and effects settings in the link"), as readable fields after the
  tab: `&sound=27&fx=on&distortion=on&drive=0.5&tone=0.5&reverb=on&amount=0.3&decay=1.5`
  (`sound` is the General MIDI program; `fx` the FX button's light switch).
  They are page settings, not the arrangement's, so the link is the only
  place they travel; volume, speed, transpose and the metronome stay the
  opener's.
- Compressed: UTF-8, raw deflate, base64url without padding, in
  `https://<origin>/tab#tabz=<code>` (`shareLink.ts`, the browser's
  `CompressionStream`). Sweet Child O' Mine's 181 bars make a 4.2 KB link,
  against 30 KB percent-encoded.
- `#tab=<percent-encoded text>` is still read, alphaTex or ASCII: agents and
  people write those by hand (`public/tab-alphatex.txt`).

## Opening one

- As any `#tab=` link: read on load or on hashchange, the hash cleared at
  once (before the text is inflated, so a second read finds nothing), the
  tab opened as a new arrangement (`docs/specs/2026-10-28-tab-arrangements-design.md`).
- Once its tab has opened, the link's Sound and FX become the page's (for
  every arrangement, as if set by hand). A field missing or out of range
  leaves that setting: no `sound`, or one Frets doesn't offer, keeps the
  opener's sound; with `fx` present, FX fields missing or wrong take their
  defaults; with no `fx`, the FX stay the opener's.
- A link cut short or damaged says "The link's tab is cut short or damaged."
  in the notice line and keeps the open arrangement, sound and FX.
