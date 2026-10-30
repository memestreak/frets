/**
 * The words over the tab (chord names, text, sections, tempos, the capo) and what a bar carries
 * (repeats, endings, double bars, time and key signatures). Pure: each returns a new clip.
 */

import { C_MAJOR, keyAt, sameKey, type Part, type Key, type TimeSignature, type Tempo } from './clip';
import { type Cursor, columnAt, normalize, replaceBar, withColumn, without } from './editing';

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
  if (index === 0) return time ? normalize({ ...clip, time }) : clip;
  const bar = clip.bars[index];
  return normalize(replaceBar(clip, index, time ? { ...bar, time } : without(bar, 'time')));
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
