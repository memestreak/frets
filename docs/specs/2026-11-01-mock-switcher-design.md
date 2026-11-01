# Mock switcher

Date: 2026-11-01. Asked by Jeremy in the Tab selection thread (PR #279): a single
preview link with `?mock=a|b|c` left him editing the address and unsure which
option he was looking at.

## What it does

- A page offering mocks declares each one with `useMock` (`src/components/mocks/`):
  its link parameter (`mock`, `blue`, …), a short name, and its options, each a
  value and a label. The first option is the default. `useMock` returns the
  option the link names, else the default.
- `MockSwitcher`, mounted once by `AppShell`, is a small card at the bottom right
  listing the page's mocks, each a segmented row with the chosen option pressed.
  Pressing an option switches the page at once and rewrites the link in place
  (no reload, no new history entry; the hash, e.g. `#tabz=`, is kept), so the
  address can be copied to share the pick.
- The card shows only when the link names one of the page's mocks. A page with
  mocks opened without them looks as it will ship; a link with `?mock=` on a page
  that has none shows nothing.
- The card's title, "Mock", folds it to one line naming the chosen options, and
  opens it again.
- Back and Forward are followed.

## Links

Every link sent to Jeremy is labelled **Mock** (a `?mock=`-style option) or
**Preview** (the branch's real behaviour). Mock links still come one per option,
each opening straight to that option; the switcher lets him move between them.

## Removing a mock

Once Jeremy picks, the page drops its `useMock` calls and keeps the picked
option's code. Nothing else needs changing.

`src/__tests__/noMocksLeft.test.ts` fails while any file outside
`src/components/mocks/` and the tests calls `useMock`, so CI stays red on a
branch with mocks and a leftover can't be merged by accident.
