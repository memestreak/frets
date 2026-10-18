# Chords over a bass outside them

## Problem

Tapping 2 2 2 1 1 1 on the Chords page (F♯ B E G♯ C F, F♯ in the bass)
showed "No name". Above the F♯ the notes are F A♭ C E B, Fm(maj7) with a
♯11, and a chart writes the voicing Fm(maj7)♯11/G♭. Name it could not find
it for two reasons: every note had to be a tone of one chord type, so a
bass outside the chord ruled out every reading, and tonal has no
m(maj7)♯11 type.

## Change

- `chordTypes.ts` adds `mMaj7#11` (1P 3m 5P 7M 11A), written `m(maj7)♯11`,
  slug `fmmaj7sharp11`, grouped Altered like the other ♯11 chords.
- `withBass(chord, bassPc)` returns the chord with a bass that isn't one of
  its tones added to its notes and tones, so the neck can label it. Its
  type and symbol stay. The bass is spelled over the root as charts write
  it, and labelled as a tension where it is one: ♭9, 9, ♭3, 3, 4, ♯11, 5,
  ♭6, 6, ♭7, 7 (Fm(maj7)♯11/G♭, C/D, C/F♯, C/A♭).
- `nameNotes` names the notes above the bass over it only when no chord of
  every note has a name, so no list that had names changes. It needs three
  different notes above the bass, and the bass's note must not come again
  higher up (then it is a tone of the chord). Those readings are ordered
  like any others. Their reason says "♭9 in the bass, outside the chord".
- `nameAs` checks the notes against the chord's tones rather than its
  type's, so a chord named over an outside bass stays named when one of its
  shapes is chosen.

Picking the name puts F and m(maj7)♯11 in the menus and the URL, as for
any slash chord; the shapes listed are the chord's own, root in the bass.

## Left for later

Ranking a slash name over a bass outside the chord ahead of a rarer type
with the bass as its root (C/A♭ before A♭maj7♯5).
