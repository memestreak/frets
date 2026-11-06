/**
 * A section over the bar it starts at: how it is measured, and how a line's sections make room for each
 * other (issue #389, `docs/specs/2026-11-06-tab-section-overlap-design.md`). Pure; `layoutClip` places
 * each line's sections once, and the drawing, the hit tests and the fields use what it placed.
 */
import { type Section } from './clip';
import { stackWords, type StackedWord } from './stackWords';

export const SECTION_SIZE = 14;
/** A section's rehearsal mark box: its height (a square for one letter). */
export const SECTION_BOX_HEIGHT = 19;
/** From one section row's middle to the next: a boxed mark clears the one over it. */
export const SECTION_LINE = 21;
/** The room kept between a section's end and the next section's start. */
export const SECTION_GAP = 12;
/** A bar's section and tempo start this far right of its opening line (`barTextX`). */
export const BAR_TEXT_INSET = 4;

/**
 * About how wide a run of bold Figtree is at a size, with narrow, wide and capital letters apart: a
 * guess, for placing what follows a word and for presses on it.
 */
export function boldTextWidth(text: string, size: number): number {
  let em = 0;
  for (const c of text) {
    em += /[il.,:;'!|]/.test(c) ? 0.28 : /[fjrt ]/.test(c) ? 0.36 : /[mwMW]/.test(c) ? 0.86 : /[A-Z]/.test(c) ? 0.68 : 0.57;
  }
  return em * size;
}

/** How wide a run of a section's name is drawn. */
export function sectionTextWidth(text: string): number {
  return boldTextWidth(text, SECTION_SIZE);
}

/**
 * A section as guitar books print it (Jeremy, 2026-10-28): its rehearsal mark (if any) in an outlined
 * box, then its name in bold with no box. Each part's place and width from the bar's start.
 */
export function sectionBoxes(section: Section): { marker: { x: number; width: number } | null; text: { x: number; width: number } } {
  const marker = section.marker ? { x: 0, width: Math.max(SECTION_BOX_HEIGHT, section.marker.length * 9 + 6) } : null;
  const x = marker ? marker.width + 5 : 0;
  return { marker, text: { x, width: sectionTextWidth(section.text) } };
}

/**
 * MOCK (issue #389), removed once Jeremy picks: how a section too long for its bar makes room.
 * `stack` moves it up a level, `wrap` wraps it first and then moves it up, `widen` widens its bar.
 */
export type SectionFit = 'stack' | 'wrap' | 'widen';
let fit: SectionFit = 'stack';
export function setSectionFit(value: SectionFit) {
  fit = value;
}
export function sectionFit(): SectionFit {
  return fit;
}

/** How far right of its bar's opening line a section reaches, with the room kept before the next. */
export function sectionReach(section: Section): number {
  const { text } = sectionBoxes(section);
  return BAR_TEXT_INSET + text.x + text.width + SECTION_GAP;
}

/** The least room a wrapped section's name wraps to, so a name over a short bar isn't a word a line. */
const SECTION_MIN_ROOM = 100;

/**
 * The sections of one line, left to right, each from `x0` (its bar's text start): a name that runs into
 * the next section moves up a level, as Dorico and MuseScore move colliding text away from the staff,
 * and with `wrap` first wraps to the room before the next section (`stackWords`).
 */
export function placeSections(sections: { x0: number; section: Section }[], end: number): { placed: StackedWord[]; rows: number } {
  return stackWords(
    sections.map(({ x0, section }) => ({ x0, lead: sectionBoxes(section).text.x, text: section.text })),
    end,
    { width: sectionTextWidth, gap: SECTION_GAP, wrap: fit === 'wrap', minRoom: SECTION_MIN_ROOM, maxRoom: Infinity },
  );
}
