# Tab editing follows Dorico, then MuseScore, then Guitar Pro 8

Tab editing behaviour must be self-consistent, should do what most other notation editors do, and
should surprise as little as possible; its behaviour and rendering must meet what printed music and
those editors lead people to expect, it is configurable where that helps, and it is discoverable by
someone new (Jeremy, 2026-11-03). Where the editors disagree, Dorico wins, then MuseScore, then
Guitar Pro 8, Jeremy's order. It fits the first rule: Dorico's model (rests as gaps, notes split by the meter,
Tie chains as one note) is the most self-consistent of the three, and Guitar Pro, the most common tab editor,
lets bars run short or over and edits by the beat, which the other two don't. The principles this
produced are `docs/tab-editing-principles.md` (P1–P14).

Two limits go with it: architecture changes the principles need are made early, before features
build on the old shape; and only guitar use cases count, so no orchestral-scale features or
infrastructure (flows, players, condensing, cue notes) come in because Dorico has them.

Revisit when: Frets stops being guitar-only, or most of its users come from Guitar Pro and its way
of editing turns out to be what they expect.

## Consequences

- A Tab editing spec says, for each behaviour it settles, what Dorico, MuseScore and Guitar Pro 8
  do, and which principle or choice it follows.
- Frets departs from Guitar Pro where Guitar Pro is the odd one out (bars always full, ties forward,
  rests written by the meter), though most guitarists know Guitar Pro best.
- Keys follow Dorico's where one exists (T tie, `;` tuplet, `/` grace, `,` rest, `=` / `−`
  length), and a Frets key moves to make room.
