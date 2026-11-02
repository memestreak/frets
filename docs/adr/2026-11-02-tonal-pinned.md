# tonal pinned to 6.4.3

Status: retired 2026-11-02. tonal 6.5.1 imports under Node, so `tonal` is a
caret range (`^6.5.1`) like the other dependencies.

`tonal` is pinned to exactly 6.4.3 in `package.json`, because 6.5.0 can't
be imported under Node, which the tests and the build need. Don't loosen
the pin to a range.

Revisit when: a later tonal release imports under Node.
