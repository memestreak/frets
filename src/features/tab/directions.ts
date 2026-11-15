/**
 * Directions (issue #496): the Segno, Coda and Fine a song's form jumps to, and the jumps (D.C., D.S.,
 * their "al Fine" and "al Coda" forms, and To Coda) that send playback to them, as alphaTex's `\jump`
 * names them. Each bar holds its own (`MasterBar.directions`); alphaTab plays them.
 *
 * Here: how each is drawn (Bravura's signs and bold italic words, as guitar books print them), where in
 * its bar it goes (Segno and Coda at its start, the rest right-aligned to its end, as MuseScore and
 * alphaTab place them), how a line's directions stack clear of each other, and the edits.
 * Pure; `docs/specs/2026-11-15-tab-song-directions-design.md`.
 */
import { DIRECTION_NAMES, type DirectionName, type Part } from './clip';
import { GLYPHS } from './smufl';
import { boldTextWidth } from './sectionText';
import { stackWords, type StackedWord } from './stackWords';
import { namedFor } from './named';

export { DIRECTION_NAMES, type DirectionName };

/** How a direction is drawn: its words and its signs, in order, and which end of its bar it goes at. */
export interface DirectionLook {
  /** The parts drawn left to right: words, or a Segno or Coda sign. */
  parts: ({ words: string } | { sign: 'segno' | 'coda' })[];
  at: 'start' | 'end';
}

const segno = { sign: 'segno' } as const;
const coda = { sign: 'coda' } as const;
const words = (w: string) => ({ words: w });

/** Each direction's look, as Hal Leonard's guitar books print them ("To Coda ⊕", "⊕ Coda", "D.S. al Coda"). */
export const DIRECTION_LOOKS: Record<DirectionName, DirectionLook> = {
  segno: { parts: [segno], at: 'start' },
  segnosegno: { parts: [segno, segno], at: 'start' },
  coda: { parts: [coda, words('Coda')], at: 'start' },
  doublecoda: { parts: [coda, coda, words('Coda')], at: 'start' },
  fine: { parts: [words('Fine')], at: 'end' },
  dacapo: { parts: [words('D.C.')], at: 'end' },
  dacapoalcoda: { parts: [words('D.C. al Coda')], at: 'end' },
  dacapoaldoublecoda: { parts: [words('D.C. al Double Coda')], at: 'end' },
  dacapoalfine: { parts: [words('D.C. al Fine')], at: 'end' },
  dalsegno: { parts: [words('D.S.')], at: 'end' },
  dalsegnoalcoda: { parts: [words('D.S. al Coda')], at: 'end' },
  dalsegnoaldoublecoda: { parts: [words('D.S. al Double Coda')], at: 'end' },
  dalsegnoalfine: { parts: [words('D.S. al Fine')], at: 'end' },
  dalsegnosegno: { parts: [words('D.S.S.')], at: 'end' },
  dalsegnosegnoalcoda: { parts: [words('D.S.S. al Coda')], at: 'end' },
  dalsegnosegnoaldoublecoda: { parts: [words('D.S.S. al Double Coda')], at: 'end' },
  dalsegnosegnoalfine: { parts: [words('D.S.S. al Fine')], at: 'end' },
  dacoda: { parts: [words('To Coda'), coda], at: 'end' },
  dadoublecoda: { parts: [words('To Double Coda'), coda, coda], at: 'end' },
};

/**
 * The directions the Direction panel offers, in its order: the ones guitar books use. A bar holding any
 * other (the double Segno and double Coda, which alphaTex has) lists it too, so it can be taken away.
 */
export const OFFERED_DIRECTIONS: readonly DirectionName[] = [
  'segno', 'coda', 'fine', 'dacoda', 'dalsegno', 'dalsegnoalcoda', 'dalsegnoalfine', 'dacapo', 'dacapoalcoda', 'dacapoalfine',
];

/**
 * What the direction popover (Shift+R) takes for each, besides its name (dots, case and spaces don't count):
 * Dorico's Shift+R words ("ds al coda", "to coda") and their run-together forms.
 */
const DIRECTION_WORDS: Record<DirectionName, readonly string[]> = {
  segno: ['sign'],
  segnosegno: ['segno segno', 'double sign'],
  coda: [],
  doublecoda: ['coda coda'],
  fine: [],
  dacapo: ['dc', 'da capo'],
  dacapoalcoda: ['dc al coda', 'dcalcoda', 'da capo al coda'],
  dacapoaldoublecoda: ['dc al double coda', 'da capo al double coda'],
  dacapoalfine: ['dc al fine', 'dcalfine', 'da capo al fine'],
  dalsegno: ['ds', 'dal segno'],
  dalsegnoalcoda: ['ds al coda', 'dsalcoda', 'dal segno al coda'],
  dalsegnoaldoublecoda: ['ds al double coda', 'dal segno al double coda'],
  dalsegnoalfine: ['ds al fine', 'dsalfine', 'dal segno al fine'],
  dalsegnosegno: ['dss', 'dal segno segno'],
  dalsegnosegnoalcoda: ['dss al coda'],
  dalsegnosegnoaldoublecoda: ['dss al double coda'],
  dalsegnosegnoalfine: ['dss al fine'],
  dacoda: ['tocoda', 'to coda'],
  dadoublecoda: ['to double coda'],
};

/** The popover's list: those the panel offers, in its order, then the rest alphaTex has. */
const LISTED: readonly DirectionName[] = [...OFFERED_DIRECTIONS, ...DIRECTION_NAMES.filter(n => !OFFERED_DIRECTIONS.includes(n))];

/** The directions the direction popover lists for what is typed ("ds" finds D.S. first, then D.S. al Coda…). */
export function directionsFor(typed: string): readonly DirectionName[] {
  return namedFor(LISTED, name => [directionName(name), ...DIRECTION_WORDS[name]], typed);
}

/** The direction a name in the popover's list stands for. */
export function directionNamed(text: string): DirectionName | null {
  return DIRECTION_NAMES.find(name => directionName(name) === text) ?? null;
}

/** A direction's name in words, for the panel, the menu and screen readers. */
export function directionName(name: DirectionName): string {
  if (name === 'segno') return 'Segno';
  if (name === 'segnosegno') return 'Double Segno';
  if (name === 'coda') return 'Coda';
  if (name === 'doublecoda') return 'Double Coda';
  return DIRECTION_LOOKS[name].parts.flatMap(p => ('words' in p ? [p.words] : [])).join(' ');
}

/** The words' size, a little under a section's, in bold italic. */
export const DIRECTION_SIZE = 13;
/** How big a sign is drawn: staff spaces to pixels. A Segno is then about 17 pixels tall, a Coda 23. */
export const SIGN_SCALE = 5.5;
/**
 * The room between a direction's parts, and the least between two directions on one level: less than the
 * insets either side of a bar line, so a jump at one bar's end and a Coda at the next one's start sit
 * side by side, the bar line between them.
 */
const PART_GAP = 4;
const DIRECTION_GAP = 6;
/** From one level of directions to the next one up: a Coda sign clears the one over it. */
export const DIRECTION_LINE = 26;
/** A start direction starts this far right of its bar's opening line; an end one ends this far left of its closing one. */
export const DIRECTION_INSET = 4;

/** A sign's outline and how far its middle is under its origin, in staff spaces, so it is centred on its row. */
export function signGlyph(sign: 'segno' | 'coda'): { d: string; width: number; middle: number } {
  // The outlines' heights (scripts/smufl-glyphs.mjs): Segno from 3.04 over its origin to 0.11 under, Coda 3.59 to 0.63.
  const middle = sign === 'segno' ? (-3.036 + 0.108) / 2 : (-3.592 + 0.633) / 2;
  return { d: GLYPHS[sign].d, width: GLYPHS[sign].width, middle };
}

/** Each part's place from the direction's left end, and the whole width. */
export function directionParts(name: DirectionName): { parts: (DirectionLook['parts'][number] & { x: number; width: number })[]; width: number } {
  let x = 0;
  const parts = DIRECTION_LOOKS[name].parts.map((part, k) => {
    if (k > 0) x += PART_GAP;
    const width = 'words' in part ? directionWordsWidth(part.words) : signGlyph(part.sign).width * SIGN_SCALE;
    const placed = { ...part, x, width };
    x += width;
    return placed;
  });
  return { parts, width: x };
}

/** About how wide a direction's bold italic words are. */
export function directionWordsWidth(text: string): number {
  return boldTextWidth(text, DIRECTION_SIZE);
}

/** A bar's directions to place: its bar's ends, and which directions it has. */
export interface BarDirections {
  bar: number;
  /** Its opening and closing lines' x. */
  x0: number;
  x1: number;
  directions: readonly DirectionName[];
}

/** A direction placed on a line: its bar, its left end, its width, and its level (0 nearest the music). */
export interface PlacedDirection {
  bar: number;
  name: DirectionName;
  x: number;
  width: number;
  /** Its row, from the top of the line's direction rows: the highest level is 0. */
  top: number;
}

/**
 * A line's directions, left to right, each at its end of its bar, stacked by the rule sections and Text
 * use (`stackWords`): one that would touch one before it moves up a level, away from the music. A
 * direction never wraps. `rows` is how many levels the line takes (at least one).
 */
export function placeDirections(bars: BarDirections[]): { placed: PlacedDirection[]; rows: number } {
  const items = bars.flatMap(({ bar, x0, x1, directions }) => {
    // At the bar's end, the first written is nearest the bar line: right to left.
    let end = x1 - DIRECTION_INSET;
    let start = x0 + DIRECTION_INSET;
    const out: { bar: number; name: DirectionName; x: number; width: number }[] = [];
    for (const name of directions) {
      const { width } = directionParts(name);
      if (DIRECTION_LOOKS[name].at === 'start') {
        out.push({ bar, name, x: start, width });
        start += width + DIRECTION_GAP;
      } else {
        out.push({ bar, name, x: end - width, width });
        end -= width + DIRECTION_GAP;
      }
    }
    return out;
  }).sort((a, b) => a.x - b.x);
  if (items.length === 0) return { placed: [], rows: 1 };
  const { placed, rows } = stackWords(
    items.map(item => ({ x0: item.x, lead: 0, text: item.name })),
    Infinity,
    // Never wrapped: each is one word as wide as it is drawn.
    { width: (_line, _at, k) => items[k].width, gap: DIRECTION_GAP, minRoom: Infinity, maxRoom: Infinity },
  );
  return { placed: items.map((item, k) => ({ ...item, top: (placed[k] as StackedWord).top })), rows };
}

/** The directions of a bar, in alphaTab's order (which `\jump` writes them in). */
export function directionsAt(clip: Part, bar: number): readonly DirectionName[] {
  return clip.bars[bar]?.directions ?? [];
}

/** The bar with `name` turned on or off; the others stay, in alphaTab's order. */
export function toggleDirection(clip: Part, bar: number, name: DirectionName): Part {
  const now = directionsAt(clip, bar);
  return setDirection(clip, bar, name, !now.includes(name));
}

/** The bar with `name` on or off. */
export function setDirection(clip: Part, bar: number, name: DirectionName, on: boolean): Part {
  const target = clip.bars[bar];
  if (!target) return clip;
  const now = target.directions ?? [];
  if (now.includes(name) === on) return clip;
  const next = DIRECTION_NAMES.filter(n => (n === name ? on : now.includes(n)));
  const bars = clip.bars.slice();
  const changed = { ...target };
  if (next.length > 0) changed.directions = next;
  else delete changed.directions;
  bars[bar] = changed;
  return { ...clip, bars };
}

/** Whether a direction is one a jump goes to (Segno, Coda), drawn at its bar's start; a bar with one starts a section of the form. */
export function startsForm(name: DirectionName): boolean {
  return DIRECTION_LOOKS[name].at === 'start';
}
