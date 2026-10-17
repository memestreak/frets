# Added-eleventh chords

## Problem

Tapping x 5 4 0 3 0 on the Chords page (D F♯ G D E, D in the bass) is
named only "Em9/D (no 5)". Over D the notes are 1, 9, 3 and 11, and none
of tonal's chord types has a major 3rd and an 11th without a ♭7, so the
D reading never reaches Name it.

## Change

`chordTypes.ts` adds two types to tonal before reading its list:

| id           | intervals            | symbol        | aliases searched             |
|--------------|----------------------|---------------|------------------------------|
| `Madd11`     | 1P 3M 5P 11P         | `add11`       | add11, Madd4, add4           |
| `Madd9add11` | 1P 3M 5P 9M 11P      | `add9(add11)` | add9add11, add2add4          |

They are grouped like any other type (Extended), so they come after the
common types in the Type menu and in Name it: the shape above lists
"Em9/D (no 5)" then "Dadd9(add11) (no 5)". Their slugs follow the rule
(`dmajadd11`, `dmajadd9add11`) and the search box finds "Cadd11" and
"Cadd9(add11)".

## Optional tones

The rule that lets a voicing leave out the 9th under an 11th (and the 11th
under a 13th) now applies only to chords with a 7th. In an add chord the
added tone is the point of the name: without it, add9(add11) would also
name a bare D F♯ G, and `69#11` (C6/9♯11) could drop its 9. No other
type's optional tones change.
