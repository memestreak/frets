/**
 * The words over the tab (chord names, text, sections, tempos, the capo) and what a bar carries
 * (repeats, endings, double bars, time and key signatures). Pure: each returns a new clip.
 */

import { C_MAJOR, keyAt, sameKey, MAX_BPM, MIN_BPM, type Clip, type Key, type TimeSignature, type Tempo } from './clip';
import { type Cursor, columnAt, normalize, replaceBar, withColumn, without } from './editing';

/** The free text over the cursor's column; empty or blank clears it. */
export function setBeatText(clip: Clip, cursor: Cursor, text: string): Clip {
  if (!columnAt(clip, cursor)) return clip;
  const t = text.trim();
  return withColumn(clip, cursor, column => {
    const rest = without(column, 'text');
    return t ? { ...rest, text: t } : rest;
  });
}

/** The chord name over the cursor's column; empty or blank clears it. */
export function setChordName(clip: Clip, cursor: Cursor, name: string): Clip {
  if (!columnAt(clip, cursor)) return clip;
  const chord = name.trim();
  return withColumn(clip, cursor, column => {
    const rest = without(column, 'chord');
    return chord ? { ...rest, chord } : rest;
  });
}

/** The section starting at a bar ("Chorus"); empty or blank clears it, keeping no rehearsal mark. */
export function setSection(clip: Clip, bar: number, text: string): Clip {
  const t = text.trim();
  const { section, ...rest } = clip.bars[bar];
  return replaceBar(clip, bar, t ? { ...rest, section: { ...section, text: t } } : rest);
}

/** The tempo from a bar on, with its label if any ("Slowly"); null clears it. */
export function setTempo(clip: Clip, bar: number, tempo: Tempo | null): Clip {
  const rest = without(clip.bars[bar], 'tempo');
  return replaceBar(clip, bar, tempo === null ? rest : { ...rest, tempo });
}

/**
 * A tempo as typed in its field: bpm, then an optional label ("100 A little faster"; Jeremy,
 * 2026-10-27), the bpm kept within MIN_BPM to MAX_BPM. Nothing typed is null, no tempo; text that
 * doesn't start with a number is undefined, so the tempo stays as it was.
 */
export function readTempo(typed: string): Tempo | null | undefined {
  const t = typed.trim();
  if (t === '') return null;
  const match = /^(\d+)\s*(.*)$/.exec(t);
  if (!match) return undefined;
  const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Number(match[1])));
  return match[2] ? { bpm, label: match[2] } : { bpm };
}

/** A tempo as its field shows it: bpm, then the label. */
export function tempoText(tempo: Tempo | undefined): string {
  return tempo ? [tempo.bpm, tempo.label].filter(Boolean).join(' ') : '';
}

/** The capo's fret; null for none. */
export function setCapo(clip: Clip, capo: number | null): Clip {
  const rest = without(clip, 'capo');
  return capo === null ? rest : { ...rest, capo };
}

/* — bars — */

/** A repeat starting at the cursor's bar, or none. */
export function toggleRepeatStart(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { repeatStart, ...rest } = bar;
  return replaceBar(clip, cursor.bar, repeatStart ? rest : { ...rest, repeatStart: true });
}

/** The cursor bar's repeat end, stepping through played twice, three times, four times and none. */
export function cycleRepeatEnd(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { repeatEnd, ...rest } = bar;
  const next = repeatEnd === undefined ? 2 : repeatEnd < 4 ? repeatEnd + 1 : undefined;
  return replaceBar(clip, cursor.bar, next ? { ...rest, repeatEnd: next } : rest);
}

/** A double bar line at the end of the cursor's bar, or none. */
export function toggleDoubleBar(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { doubleBar, ...rest } = bar;
  return replaceBar(clip, cursor.bar, doubleBar ? rest : { ...rest, doubleBar: true });
}

/** The cursor bar's ending bracket, stepping through 1., 2. and none. */
export function cycleEnding(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { ending, ...rest } = bar;
  const next = ending === undefined ? 1 : ending < 2 ? ending + 1 : undefined;
  return replaceBar(clip, cursor.bar, next ? { ...rest, ending: next } : rest);
}

/**
 * The ending bracket over bar `bar` and the bars round it under the same one: set to `n`, or taken away
 * with null (a press picks a drawn bracket, Jeremy 2026-10-28).
 */
export function setEnding(clip: Clip, bar: number, n: number | null): Clip {
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
export function setBarTime(clip: Clip, index: number, time: TimeSignature | null): Clip {
  if (index === 0) return time ? normalize({ ...clip, time }) : clip;
  const bar = clip.bars[index];
  return normalize(replaceBar(clip, index, time ? { ...bar, time } : without(bar, 'time')));
}

/**
 * A key signature from a bar on (issue #122), or null to take a bar's own away; on the first bar
 * it is the clip's own, and C major there is the same as none.
 */
export function setBarKey(clip: Clip, index: number, key: Key | null): Clip {
  const bar = clip.bars[index];
  const before = index === 0 ? C_MAJOR : keyAt(clip, index - 1);
  // Setting the key already in force takes the bar's own away.
  const keep = key && !sameKey(key, before);
  return replaceBar(clip, index, keep ? { ...bar, key } : without(bar, 'key'));
}

/* — moving — */
