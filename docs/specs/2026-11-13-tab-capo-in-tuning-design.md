# Tab: the capo in the Tuning panel

Issue #463 (Jeremy, 2026-11-13): set a capo from the Tuning panel, below
the tuning presets and Strings, so a clip can be DADGAD with a capo on the
4th fret. Settled with Jeremy the same day.

This takes over "The capo stays a Text tool" in
`2026-10-29-tab-credits-tuning-design.md`, and the capo's place over the
first line in `2026-10-26-tab-words-design.md` and
`2026-10-26-tab-rhythm-design.md`, for the Tab page.

## What a capo is

- The capo is the Track's existing one (`capo`, alphaTex `\capo N`, 1 to
  12), one per Track, as before. Nothing new is stored.
- It goes on **after** the tuning: the strings are tuned first, then the
  capo raises every open string by its fret. DADGAD with a capo on 4
  sounds F♯ C♯ F♯ B C♯ F♯.
- Like a transposition, it changes what sounds, not the fingering. Frets
  stay counted from the capo, as tab is written: a `0` is the capoed open
  string, a `2` two frets above the capo. Playback, MIDI out, the staff,
  note names, Hear notes and the chord names follow; the tab's numbers
  don't.
- Changing the tuning keeps the capo; changing the capo keeps the tuning
  and every fret.

## The Tuning panel

- The Tuning panel (a Panel, not a Popover: see `GLOSSARY.md`) gains
  **Capo** under the presets, Strings and the piano: a caption, then a
  number stepper, **−**, the field, **+**.
- The field is typed into (0 to 12); ↑ and ↓ in it step by one. Empty or
  0 is no capo, and the field then reads **None**. A typed number past 12
  is taken as 12.
- **−** is greyed out at None, **+** at 12.
- Every change applies at once and is one undo step, as a preset is.
- The panel's other keys stay as they are; its caption still reads
  "Tuning: DADGAD" (the capo is not part of the tuning's name).
- The panel does not show the pitches the strings sound with the capo
  on: the Strings still name the tuning, and the staff shows what sounds.

## One way in

- The **Capo** tool leaves the Text group (one way to do a thing, as for
  the title, 2026-10-29). Its word field ("Capo on fret, 1 to 12") goes
  with it.
- The capo is no longer drawn over the first line on the Tab page, so it
  can't be picked there; Alt+← → no longer stops on it.
- A capo is taken off only in the Tuning panel (None). Delete on the
  picked tuning still does nothing.

## Drawn in the score head

- The capo is drawn once, in the head, beside the tuning's name, after a
  middle dot: "DADGAD tuning · Capo 4th fret". The fret is an ordinal:
  1st, 2nd, 3rd, 4th … 11th, 12th.
- In standard tuning the page reads "Standard tuning · Capo 4th fret". The
  exported picture leaves standard tuning unsaid, as before, so it prints
  "Capo 4th fret" alone.
- A collapsed tuning keeps the capo: "DADGAD tuning · Capo 4th fret" with
  the strings hidden.
- The capo is part of the tuning's button: a press on it picks the
  tuning, and Edit, Enter or a double-click opens the Tuning panel.
- The "Capo 4" row over the first line goes from the page and from PNG
  and SVG exports, and the first line moves up into its room.
- **show_tab** has no head, so it still draws "Capo 2" over its first
  line, as now.

## Formats

- alphaTex, the share link, MusicXML (`<capo>` in the tab staff's
  details, notes at the pitch they sound) and Guitar Pro (the track's
  capo) carry it as they do now.
- **ASCII Tab** gains a `Capo: 4` header line, after `Tuning:`, written
  only when there is a capo. It is read back: `Capo: 0` is no capo, a
  capo past 12 is read as 12 with a message ("Read capo 15 as 12, the
  highest Frets offers."), and anything else that isn't a whole number is
  left out with a message. `public/tab-ascii.txt` lists it with the other
  header lines.

## Tests

- The Tuning panel: + from None sets `\capo 1`; typing 4 sets `\capo 4`;
  − at 1, typing 0 and clearing the field each take `\capo` away; typing
  15 sets 12; − is disabled at None and + at 12; the field reads "None"
  with no capo.
- A capo change is one undo step; Undo puts the old capo back.
- DADGAD with the capo on 4: the panel's tuning stays D A D G A D;
  playback's open strings sound F♯2 C♯3 F♯3 B3 C♯4 F♯4 (MIDI 42 49 54 59
  61 66);
  the tab still shows its `0`s.
- Picking a preset with a capo on keeps the capo; changing the capo keeps
  the tuning and every fret.
- The Text group has no Capo tool.
- The head reads "DADGAD tuning · Capo 4th fret", "Standard tuning · Capo
  4th fret" on the page, "Capo 4th fret" alone in an export in standard
  tuning, and keeps the capo collapsed; ordinals 1st, 2nd, 3rd, 4th,
  11th, 12th.
- The Tab page's layout has no capo row; show_tab's layout keeps it.
- ASCII Tab: a clip with `\capo 4` writes `Capo: 4` after `Tuning:`, and
  none without a capo; `Capo: 4` reads as capo 4, `Capo: 0` as none,
  `Capo: 15` as 12 with its message, `Capo: x` left out with a message.
- The capo round-trips through the share link, alphaTex, MusicXML
  (`<capo>4</capo>`) and Guitar Pro (`staff.capo` 4).

## How

- `TuningPanel.tsx`: the Capo stepper, its value through `setCapo`
  (`barEdits.ts`), clamped to `MAX_CAPO`.
- `credits.ts`: the capo's words (`capoWords`, "Capo 4th fret") and the
  tuning's heading with them; `ScoreHead.tsx` and `exportTab.tsx` draw it.
- `layout.ts` / `rows.ts`: a capo row only when asked for (show_tab's
  `ChatTab.tsx`); `layoutText.ts`, `elements.ts`, `fieldSpots.ts`,
  `useTabPicking.ts`, `useHeadPanels.tsx` and `WordField.tsx` lose the
  capo's word on the Tab page.
- `tools.ts` and `TabPalette.tsx`: the Capo tool and its icon go.
- `ascii.ts`: the `Capo:` header, read and written;
  `public/tab-ascii.txt`.
- `docs/specs/2026-10-29-tab-credits-tuning-design.md`: its capo line
  points here.
