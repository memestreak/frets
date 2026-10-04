# Fretwood: the app's design system

Date: 2026-10-04
Status: approved in the project thread, implemented with this spec.
Supersedes `2026-10-01-soft-ui-design.md`.

## Problem

Frets is adopting the Fretwood designs: the design system plus the Scale Lab
and other screens to come. The app still draws the Soft UI look. That look is
built on the Industry design system's `--color-*` tokens, uses Barlow and
Monoton type, and has no dark theme. Each new Fretwood screen would have to
bridge two token sets.

## Goal

Every page uses Fretwood's tokens, type, components and fretboard rules,
in light and dark. The quiz rules and layouts stay the same.

The design system's README and `tokens.json`
(https://claude.ai/artifact/GTUAmXkKGcQu1vVPH8ns3F) are the reference. This
spec records only how the app applies them.

## Decisions

| Question | Decision |
| --- | --- |
| Token names | Fretwood's own names (`--surface`, `--ink`, `--primary`, `--fretboard`, `--degree-*`, ...), with no `--color-` prefix. The app has no users and the old names would be debt. |
| Token file | `src/styles/fretwood.css` (replaces `industry.css`). Light values sit on `:root`. Dark values apply under `prefers-color-scheme: dark` unless `data-theme="light"`, and always under `data-theme="dark"`. |
| Theme choice | An Auto / Light / Dark switch in the nav, saved as JSON under `localStorage["frets.theme"]`. A boot script in `<head>` applies it before first paint. |
| Type | Fraunces 600 for page titles (`h1`) and the wordmark; Figtree 400–700 for everything else. Both are self-hosted with `next/font/local` (latin subset). JetBrains Mono is left out until something uses it. |
| Wordmark | The Fretwood mark (`BrandMark`, drawn with tokens so it follows the theme) and "Frets" in Fraunces. `icon.svg` and `apple-icon.png` are the same mark with the light values. |
| Page titles | Each page has one `h1`: the trainer title, the section name, or a visually hidden "Frets" on the home page. |
| Cards | `--surface-raised` with a 1px `--line` border and `--radius-lg`. No shadows. |
| Controls | `.btn-primary` / `.btn-secondary` / `.btn-ghost`, `.seg` segmented control and `.input` follow the README's component rules. Answer tiles sit on `--surface-sunken`. |

## Fretboard

Board colours come from tokens: fill `--fretboard`, frets `--fret-wire` (2px),
nut `--nut`, inlays `--inlay`, strings `--string` from 2.5px (low E) to 1px.
String names and fret numbers are `--ink-muted`, 12px, weight 500.

Every dot has a 2px `--dot-ring` ring and a Figtree 700 label.

| Dot | Colour | Shape |
| --- | --- | --- |
| Root | `--degree-root` | square |
| Unanswered target ("?") | `--dot-quiz` | circle |
| Correct answer | `--success` | circle |
| Other right fingerings (Find it) | `--success`, 55% opacity | circle |
| Wrong tap (✕) | `--danger` | circle |
| Right note outside the range | `--degree-other` | circle |
| Interval hint | degree colour by interval class (below) | square for P1/P8 |
| Note hint | `--degree-other` | circle |

The unanswered target never takes a degree colour, which would give the
answer away.

Interval hints map interval classes to the degree palette: m2/M2 second,
m3/M3 third, P4/TT extension, P5 fifth, m6/M6 sixth, m7/M7 seventh, P8 root.

The Note trainer's Find-it string is drawn in `--accent`, and the legend
swatch matches it.

## Out of scope

- New screens from the Fretwood designs (Scale Lab, chords, arpeggios,
  playback). Each comes with its own spec.
- Any change to quiz rules, settings or storage.
