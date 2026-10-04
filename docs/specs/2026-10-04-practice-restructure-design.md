# Practice section: room for features beyond the quizzes

Date: 2026-10-04
Status: approved in the project thread, implemented with this spec

## Problem

Frets is about to grow past its two quiz trainers. The Fretwood designs add
a Scale Lab, diatonic chords, arpeggios and playback. Today the app is shaped
around exactly two trainers:

- the routes are `/intervals` and `/notes`, and `/` redirects to one of them;
- the nav hard-codes the two trainers;
- quiz-only logic sits in the shared `src/lib/`, `src/components/` and
  `src/hooks/` next to code every feature will need.

Adding a feature today means touching the quiz code's folders and the nav.

## Goal

Move the quizzes into their own section, so that each later feature is added
without editing the quizzes:

- add an entry to one list;
- add a route under `src/app/`;
- add a folder under `src/features/`.

The trainers' rules, controls and look stay the same.

## Decisions

| Question | Decision |
| --- | --- |
| Section name | Practice |
| Trainer URLs | `/practice/intervals`, `/practice/notes` |
| Old URLs | Removed outright. There are no redirects or stubs, and `public/_redirects` is deleted, because the app has no users. |
| `/` | A home page listing each section and its pages |
| `/practice` | A section index page listing its trainers |
| Where the section list lives | `src/components/sections.ts`. It is the single source for the nav and both index pages. |
| How the nav finds the active page | From the URL (`usePathname`). Pages no longer pass an `active` prop. |
| Where `AppShell` is mounted | Once, in the root layout |
| Feature code | `src/features/practice/`, holding the trainers, their pure logic, the quiz UI and the quiz hooks |
| Shared code | `src/lib/` (music, fret window, geometry, storage), `src/components/` (shell, nav, fretboard, controls, icons), `src/hooks/usePersist.ts` |
| Storage keys | `frets.<section>.<page>`, so `frets.practice.intervals` and `frets.practice.notes`. Nothing is migrated from `eminor.*.v2`. |
| Tests | Practice tests move to `src/__tests__/practice/` |

## Code layout

```
src/
  app/
    layout.tsx                 AppShell around every page
    page.tsx                   home: sections and their pages
    practice/page.tsx          Practice index
    practice/intervals/page.tsx
    practice/notes/page.tsx
  components/
    sections.ts                SECTIONS, PRACTICE, locate(pathname)
    AppShell.tsx  AppNav.tsx  AppFooter.tsx  PageList.tsx
    controls.tsx  icons.tsx  fretboard/
  features/practice/
    intervals/  IntervalTrainer.tsx  intervalState.ts  intervals.ts
    notes/      NoteTrainer.tsx      noteState.ts      notes.ts
    quiz/       trainerState.ts quizFlow.ts stats.ts attempt.ts
                useTrainer.ts useQuizKeyboard.ts useAutoAdvance.ts
                AnswerCard BoardFrame SessionStatsCard SettingsDialog
                SettingsParts TrainerHeader
    TrainerLoaders.tsx
  hooks/usePersist.ts
  lib/  music.ts fretWindow.ts fretboardGeometry.ts storage.ts
```

Code moves out of a feature folder into `src/lib/` or `src/components/` only
once a second section needs it. Settings UI is the likely first case, when
the Scale Lab gets settings.

## Nav

The nav shows three things:

- The FRETS wordmark, which links home.
- One link per section. The active section's link shows the current page's
  title (for example "Interval trainer"), so the existing "you are here"
  label is kept.
- The active section's pages as a segmented control, with `aria-current` on
  the current page. It is hidden on the home page.

The styling stays as it is. The Fretwood restyle (Phase 2) redraws the nav.

## Out of scope

- Any visual change. The Fretwood design system is Phase 2.
- Making the tuning a parameter, spelled notes, and the `tonal` library.
  These come with the Scale Lab, the first feature in a new section.
