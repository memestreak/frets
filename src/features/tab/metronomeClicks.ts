/**
 * What Tab's metronome clicks in a bar (issues #148, #477; `docs/specs/2026-11-14-tab-metronome-parity-design.md`):
 * where each click falls, what kind it is, and how hard it is struck. Pure; `playback.ts` puts the
 * clicks in the clip's MIDI.
 */
import type { ClickSound } from '@/lib/clickSounds';

/** alphaTab's ticks in a quarter note. */
const QUARTER = 960;

/** What the beats are split into: a click on every eighth, triplet eighth or sixteenth between them. */
export type Subdivide = 'off' | 'eighths' | 'triplets' | 'sixteenths';
export const SUBDIVIDES: readonly (readonly [Subdivide, string])[] = [
  ['off', 'Off'], ['eighths', 'Eighths'], ['triplets', 'Triplets'], ['sixteenths', 'Sixteenths'],
];
/** How long each kind of subdivision is, in ticks. */
const SUBDIVISION_TICKS: Record<Exclude<Subdivide, 'off'>, number> = { eighths: QUARTER / 2, triplets: QUARTER / 3, sixteenths: QUARTER / 4 };

/** Which beats click: every one, the backbeat, or only beat one. */
export type ClickOn = 'every' | 'backbeat' | 'one';
export const CLICK_ONS: readonly (readonly [ClickOn, string])[] = [
  ['every', 'Every beat'], ['backbeat', 'Backbeat'], ['one', 'Beat one'],
];

/** How loud each kind of click is, 0 to 1: beat one, the other beats, and the subdivisions between them. */
export interface ClickLevels {
  one: number;
  beats: number;
  subdivisions: number;
}

/** How the metronome clicks, from Tab › Metronome; the bar itself comes from the arrangement. */
export interface ClickPattern {
  sound: ClickSound;
  subdivide: Subdivide;
  clickOn: ClickOn;
  levels: ClickLevels;
}

export const DEFAULT_LEVELS: ClickLevels = { one: 1, beats: 1, subdivisions: 0.6 };
export const DEFAULT_PATTERN: ClickPattern = { sound: 'wood', subdivide: 'off', clickOn: 'every', levels: DEFAULT_LEVELS };

export const SUBDIVIDE_VALUES = SUBDIVIDES.map(([v]) => v);
export const CLICK_ON_VALUES = CLICK_ONS.map(([v]) => v);

export function samePattern(a: ClickPattern, b: ClickPattern): boolean {
  return a.sound === b.sound && a.subdivide === b.subdivide && a.clickOn === b.clickOn
    && a.levels.one === b.levels.one && a.levels.beats === b.levels.beats && a.levels.subdivisions === b.levels.subdivisions;
}

/**
 * How the metronome counts a bar: how far apart its clicks are (ticks), how many there are, and
 * which of them start a Beat group (struck harder), beat one aside.
 */
export interface Count {
  ticks: number;
  clicks: number;
  groupStarts: number[];
}

/**
 * How the metronome counts a time signature: a click per beat, the bottom number's note. Bars over
 * 8 or shorter follow their Beat groups (`groups`, counted in the bottom number): each group's first
 * click is struck harder, so 6/8 clicks six eighths with the 1 and the 4 standing out (Jeremy,
 * 2026-10-28: two clicks a bar of 6/8 was too few) and 7/8 as 2+2+3 the 1, the 3 and the 5.
 * Quarter and half bars have no group accents.
 */
export function countOf(beats: number, value: number, groups: readonly number[] = []): Count {
  const groupStarts: number[] = [];
  if (value >= 8) {
    let at = 0;
    for (const n of groups.slice(0, -1)) {
      at += n;
      if (at < beats) groupStarts.push(at);
    }
  }
  return { ticks: (4 / value) * QUARTER, clicks: beats, groupStarts };
}

export type ClickKind = 'one' | 'group' | 'beat' | 'sub';

/** One click of a bar: how far into the bar it is (ticks), and what kind. */
export interface Click {
  offset: number;
  kind: ClickKind;
}

/** How many clicks each beat is split into: a whole number of the subdivision's length, else 1. */
export function stepsPerBeat(count: Count, subdivide: Subdivide): number {
  if (subdivide === 'off') return 1;
  const steps = count.ticks / SUBDIVISION_TICKS[subdivide];
  return Number.isInteger(steps) && steps > 1 ? steps : 1;
}

/**
 * Whether beat `k` (from 0) of a bar clicks. Backbeat: in a bar with Beat group accents, every
 * group's start but the first (7/8 as 2+2+3: the 3 and the 5); in any other, every second beat
 * (2 and 4; in 3/4 the 2).
 */
function beatClicks(count: Count, k: number, clickOn: ClickOn): boolean {
  if (k === 0) return clickOn !== 'backbeat';
  if (clickOn === 'every') return true;
  if (clickOn === 'one') return false;
  return count.groupStarts.length > 0 ? count.groupStarts.includes(k) : k % 2 === 1;
}

/**
 * A bar's clicks in order: each beat that clicks, then its subdivisions. `countIn` clicks every beat
 * whatever `clickOn` says, so the count is always plain to follow.
 */
export function barClicks(count: Count, { subdivide, clickOn }: Pick<ClickPattern, 'subdivide' | 'clickOn'>, { countIn = false } = {}): Click[] {
  const steps = stepsPerBeat(count, subdivide);
  const step = count.ticks / steps;
  const clicks: Click[] = [];
  for (let k = 0; k < count.clicks; k++) {
    if (!countIn && !beatClicks(count, k, clickOn)) continue;
    const kind: ClickKind = k === 0 ? 'one' : count.groupStarts.includes(k) ? 'group' : 'beat';
    clicks.push({ offset: k * count.ticks, kind });
    for (let s = 1; s < steps; s++) clicks.push({ offset: k * count.ticks + s * step, kind: 'sub' });
  }
  return clicks;
}

/**
 * How hard each kind of click is struck, out of 127, at full level: beat one (its own, higher
 * click), a group's start, and every other beat or subdivision.
 */
const VELOCITY: Record<ClickKind, number> = { one: 110, group: 120, beat: 80, sub: 80 };

/** How hard a click is struck, out of 127: its kind's velocity scaled by its level, at least 1 unless the level is 0. */
export function clickVelocity(kind: ClickKind, levels: ClickLevels): number {
  const level = kind === 'one' ? levels.one : kind === 'sub' ? levels.subdivisions : levels.beats;
  return level <= 0 ? 0 : Math.max(1, Math.round(VELOCITY[kind] * level));
}
