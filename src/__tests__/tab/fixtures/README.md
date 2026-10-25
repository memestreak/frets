# ASCII import fixtures

Each case is a pair:

- `<name>.in.txt`: tab as people write it, often not in the canonical form
  of `public/tab-ascii.txt`.
- `<name>.out.txt`: what importing it must give. Warnings start with `! `
  and errors with `x `, then a blank line, then the clip written back as
  canonical ASCII.

`../fixtures.test.ts` checks every pair, and that each `.out.txt`'s ASCII
reads back with nothing guessed or ignored and writes out the same.

The cases cover the symbols on two tab-notation pages (written for these
tests, in the same notation, not copied):
https://how-to-play-electric-guitar.net/tab-symbols.html and
https://total-guitar-lessons.com/beginner/tabs/beginner-guitar-tablature4.php.
Some of them show what Frets does not read as meant (`tap-suffix`,
`palm-mute-x`, `whammy-dip`, `trill-tremolo`, `accent-line`,
`harmonic-label`, the `{n}` in `harmonic-artificial`); their goldens record
today's reading, so a change to it shows up as a diff.

To add a case, add `<name>.in.txt`, then run

    UPDATE_FIXTURES=1 npx vitest run src/__tests__/tab/fixtures.test.ts

and read the new `.out.txt` before committing it. The same command
rewrites every golden after a deliberate change to the reader or writer;
review the diff.
