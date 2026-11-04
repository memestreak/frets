/**
 * The words over the tab (chord names, text, sections, tempos, the capo) and what a bar carries
 * (repeats, endings, double bars, time and key signatures). Pure: each returns a new clip.
 */

import { C_MAJOR, sameKey, type Key } from '@/lib/theory/keys';
import { barLength, barSpan, barTicks, keyAt, meterOffset, timeAt, type Bar, type Column, type Part, type TimeSignature, type Tempo } from './clip';
import { type Cursor, columnAt, emptyColumn, normalize, replaceBar, withColumn, without } from './editing';
import { meterOf, spell } from './sounding';
import { layFrom } from './timeline';

/** The free text over the cursor's column; empty or blank clears it. */
export function setBeatText(clip: Part, cursor: Cursor, text: string): Part {
  if (!columnAt(clip, cursor)) return clip;
  const t = text.trim();
  return withColumn(clip, cursor, column => {
    const rest = without(column, 'text');
    return t ? { ...rest, text: t } : rest;
  });
}

/** The chord name over the cursor's column; empty or blank clears it. */
export function setChordName(clip: Part, cursor: Cursor, name: string): Part {
  if (!columnAt(clip, cursor)) return clip;
  const chord = name.trim();
  return withColumn(clip, cursor, column => {
    const rest = without(column, 'chord');
    return chord ? { ...rest, chord } : rest;
  });
}

/** The section starting at a bar ("Chorus"); empty or blank clears it, keeping no rehearsal mark. */
export function setSection(clip: Part, bar: number, text: string): Part {
  const t = text.trim();
  const { section, ...rest } = clip.bars[bar];
  return replaceBar(clip, bar, t ? { ...rest, section: { ...section, text: t } } : rest);
}

/** The tempo from a bar on, with its label if any ("Slowly"); null clears it. */
export function setTempo(clip: Part, bar: number, tempo: Tempo | null): Part {
  const rest = without(clip.bars[bar], 'tempo');
  return replaceBar(clip, bar, tempo === null ? rest : { ...rest, tempo });
}

/** The capo's fret; null for none. */
export function setCapo(clip: Part, capo: number | null): Part {
  const rest = without(clip, 'capo');
  return capo === null ? rest : { ...rest, capo };
}

/* — bars — */

/** A repeat starting at the cursor's bar, or none. */
export function toggleRepeatStart(clip: Part, cursor: Cursor): Part {
  const bar = clip.bars[cursor.bar];
  const { repeatStart, ...rest } = bar;
  return replaceBar(clip, cursor.bar, repeatStart ? rest : { ...rest, repeatStart: true });
}

/** The cursor bar's repeat end, stepping through played twice, three times, four times and none. */
export function cycleRepeatEnd(clip: Part, cursor: Cursor): Part {
  const bar = clip.bars[cursor.bar];
  const { repeatEnd, ...rest } = bar;
  const next = repeatEnd === undefined ? 2 : repeatEnd < 4 ? repeatEnd + 1 : undefined;
  return replaceBar(clip, cursor.bar, next ? { ...rest, repeatEnd: next } : rest);
}

/** The most times a repeat's count field takes. */
export const MAX_REPEAT_TIMES = 9;

/** A bar's repeat end played `times` times (2 to 9; 2 is written without a count); the bar must end a repeat. */
export function setRepeatTimes(clip: Part, bar: number, times: number): Part {
  if (clip.bars[bar]?.repeatEnd === undefined) return clip;
  const repeatEnd = Math.min(MAX_REPEAT_TIMES, Math.max(2, Math.round(times)));
  return replaceBar(clip, bar, { ...clip.bars[bar], repeatEnd });
}

/**
 * A picked bar line taken away (issue #276): a repeat's start or end, or a double bar line; a repeat's
 * count goes back to twice, which is written without one.
 */
export function removeBarLine(clip: Part, { kind, bar }: { kind: 'repeatStart' | 'repeatEnd' | 'repeatCount' | 'doubleBar'; bar: number }): Part {
  if (!clip.bars[bar]) return clip;
  if (kind === 'repeatCount') return setRepeatTimes(clip, bar, 2);
  return replaceBar(clip, bar, without(clip.bars[bar], kind));
}

/** A double bar line at the end of the cursor's bar, or none. */
export function toggleDoubleBar(clip: Part, cursor: Cursor): Part {
  const bar = clip.bars[cursor.bar];
  const { doubleBar, ...rest } = bar;
  return replaceBar(clip, cursor.bar, doubleBar ? rest : { ...rest, doubleBar: true });
}

/** The cursor bar's ending bracket, stepping through 1., 2. and none. */
export function cycleEnding(clip: Part, cursor: Cursor): Part {
  const bar = clip.bars[cursor.bar];
  const { ending, ...rest } = bar;
  const next = ending === undefined ? 1 : ending < 2 ? ending + 1 : undefined;
  return replaceBar(clip, cursor.bar, next ? { ...rest, ending: next } : rest);
}

/**
 * The ending bracket over bar `bar` and the bars round it under the same one: set to `n`, or taken away
 * with null (a press picks a drawn bracket, Jeremy 2026-10-28).
 */
export function setEnding(clip: Part, bar: number, n: number | null): Part {
  const was = clip.bars[bar]?.ending;
  if (was === undefined) return clip;
  let first = bar;
  while (first > 0 && clip.bars[first - 1].ending === was) first--;
  let last = bar;
  while (last + 1 < clip.bars.length && clip.bars[last + 1].ending === was) last++;
  let next = clip;
  for (let i = first; i <= last; i++) {
    const rest = { ...next.bars[i] };
    delete rest.ending;
    next = replaceBar(next, i, n ? { ...rest, ending: n } : rest);
  }
  return next;
}

/**
 * The time signature from bar `index` on. On the first bar it is the clip's own; on a later bar it
 * starts a change, and null (or the time signature already in force) takes the change away.
 */
export function setBarTime(clip: Part, index: number, time: TimeSignature | null): Part {
  if (index === 0) {
    if (!time) return clip;
    // A Pickup bar keeps its length while it is still shorter than a bar of the new time signature.
    const pickup = clip.bars[0]?.pickup;
    const next = pickup && pickup >= barTicks(time) ? replaceBar(clip, 0, without(clip.bars[0], 'pickup')) : clip;
    return normalize({ ...next, time });
  }
  const bar = clip.bars[index];
  return normalize(replaceBar(clip, index, time ? { ...bar, time } : without(bar, 'time')));
}

/** The unit the Pickup field counts in: the beat its time signature writes (a quarter in 4/4, an eighth in 6/8). */
export function pickupUnit(time: TimeSignature): number {
  return barTicks(time) / time.beats;
}

/**
 * The first bar made a Pickup bar `length` ticks long, or a full bar with 0
 * (`docs/specs/2026-11-04-tab-bars-always-full-design.md`); a length of a whole bar or more is none. The
 * music is not re-barred here: the editor re-bars it from bar 1 (`commitReBar`).
 */
export function setPickup(clip: Part, length: number): Part {
  const bar = without(clip.bars[0], 'pickup');
  const keep = length > 0 && length < barTicks(timeAt(clip, 0));
  if (!keep && clip.bars[0].pickup === undefined) return clip;
  if (keep && clip.bars[0].pickup === length) return clip;
  return replaceBar(clip, 0, keep ? { ...bar, pickup: length } : bar);
}

/**
 * A key signature from a bar on (issue #122), or null to take a bar's own away; on the first bar
 * it is the clip's own, and C major there is the same as none.
 */
export function setBarKey(clip: Part, index: number, key: Key | null): Part {
  const bar = clip.bars[index];
  const before = index === 0 ? C_MAJOR : keyAt(clip, index - 1);
  // Setting the key already in force takes the bar's own away.
  const keep = key && !sameKey(key, before);
  return replaceBar(clip, index, keep ? { ...bar, key } : without(bar, 'key'));
}

/* — moving — */

/* — fixing an Uneven bar, from its ⚠ (`docs/specs/2026-11-04-tab-bars-always-full-design.md`) — */

/** Every Voice of the bar, its own first: the Part's Columns, then those it carries. */
function voicesOf(bar: Bar): Column[][] {
  return [bar.columns, ...(bar.otherVoices ?? []).map(other => other.columns)];
}

/** Which fixes bar `index` takes: Move extra into next bar when a Voice is overfull, Fill with rests (and, on bar 1, Make pickup bar) when one is short. */
export function barFixes(clip: Part, index: number): { over: boolean; short: boolean; pickup: boolean } {
  const span = barSpan(clip, index);
  const lengths = voicesOf(clip.bars[index]).filter((columns, v) => v === 0 || columns.length > 0).map(columns => barLength({ columns }));
  const over = lengths.some(length => length > span);
  const short = lengths.some(length => length < span) && !(clip.bars.every(bar => bar.columns.length === 0));
  return { over, short, pickup: short && !over && index === 0 && lengths[0] > 0 && lengths.every(length => length <= lengths[0]) };
}

/** Bar `index` with the time each short Voice lacks put at its end as a Gap, written by the meter. */
export function fillWithRests(clip: Part, index: number): Part {
  const bar = clip.bars[index];
  const span = barSpan(clip, index);
  const meter = meterOf(timeAt(clip, index));
  const offset = meterOffset(clip, index);
  const filled = (columns: Column[]) => {
    const length = barLength({ columns });
    if (columns.length === 0 || length >= span) return columns;
    return [...columns, ...spell(meter, offset + length, span - length, 'rest').map(emptyColumn)];
  };
  const next: Bar = { ...bar, columns: bar.columns.length === 0 ? bar.columns : filled(bar.columns) };
  if (bar.otherVoices) next.otherVoices = bar.otherVoices.map(other => ({ ...other, columns: filled(other.columns) }));
  return replaceBar(clip, index, next);
}

/** Bar `index` with the time past its end moved into the next bar, pushing the music after it along, in every Voice: nothing is lost. */
export function moveExtra(clip: Part, index: number): Part | null {
  return layFrom(clip, index);
}

/** Bar 1 made a Pickup bar as long as its music, even when that is part of a beat. */
export function makePickup(clip: Part): Part {
  return setPickup(clip, Math.max(...voicesOf(clip.bars[0]).map(columns => barLength({ columns }))));
}
