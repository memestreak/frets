import {
  barNumber, groupCountsAt, partOf, hasOwnGroups, keyAt, timeAt,
  type Bar, type Clip, type Column, type MasterBar, type Part, type TrackBar,
} from './clip';
import { tempoAt, without } from './editing';
import type { TabExportStyle } from './exportTab';

/** Bars `first` to `last` (from 0, inclusive): what the menu's Copy as PNG and Export options… take. */
export type BarRange = [number, number];

/** What the cut's first bar starts with that was set on an earlier bar: the Export choices' Start with. */
export type StartWith = Pick<TabExportStyle, 'startKey' | 'startTime' | 'startTempo'>;
const EVERYTHING: StartWith = { startKey: true, startTime: true, startTempo: true };

/** The clip's bar marks as a part's bars, for the helpers that read only marks (time, key, tempo, Beat groups). */
function marksOf(clip: Clip): Pick<Part, 'time' | 'bars'> {
  // Those helpers read only MasterBar fields, never a bar's columns.
  return { time: clip.time, bars: clip.masterBars as Bar[] };
}

/** A Voice's Columns with no note tied over from before (only its first Column can be): the tie would start from nothing. */
function untied(columns: Column[]): Column[] {
  const [head, ...rest] = columns;
  if (!head?.notes.some(note => note?.tie)) return columns;
  return [{ ...head, notes: head.notes.map(note => (note?.tie ? without(note, 'tie') : note)) }, ...rest];
}

/**
 * Bars `first` to `last` of every track, as a clip of their own: what the Export dialog saves for a bar
 * selection (`docs/specs/2026-11-21-tab-export-bars-design.md`). The first bar says the time signature (with
 * its Beat groups), key and tempo in force there, even when an earlier bar set them, as a copy of those bars
 * does; each one `start` turns off is only what that bar sets itself (a time signature it doesn't set is the
 * clip's first). A Pickup stays only when bar 1 is in the range. A note tied over from before the range is a plain
 * note. The clip's line layout is for the whole clip, so the cut fills lines by width.
 */
export function clipOfBars(clip: Clip, [first, last]: BarRange, start: StartWith = EVERYTHING): Clip {
  const marks = marksOf(clip);
  const masterBars: MasterBar[] = clip.masterBars.slice(first, last + 1).map(bar => ({ ...bar }));
  const own = clip.masterBars[first];
  let head: MasterBar = without(masterBars[0], 'time');
  if (first > 0) head = without(head, 'pickup');
  // The time signature in force there, or the one the bar sets, else the clip's first, with their Beat groups.
  const timeFrom = start.startTime || own.time ? first : 0;
  const time = timeAt(marks, timeFrom);
  head = hasOwnGroups(marks, timeFrom) ? { ...head, beatGroups: groupCountsAt(marks, timeFrom) } : without(head, 'beatGroups');
  // A clip that sets no key (or tempo) anywhere doesn't say one in the cut either.
  if (start.startKey && clip.masterBars.some(bar => bar.key)) head = { ...head, key: keyAt(marks, first) };
  const tempo = start.startTempo ? tempoAt(marks, first) : null;
  if (tempo) head = { ...head, tempo };
  masterBars[0] = head;
  const tracks = clip.tracks.map(track => {
    const bars: TrackBar[] = track.bars.slice(first, last + 1);
    bars[0] = { ...bars[0], voices: bars[0].voices.map(untied) };
    return { ...track, bars };
  });
  return without(without({ ...clip, time, masterBars, tracks }, 'systemsLayout'), 'defaultSystemsLayout');
}

/** "bar 9" or "bars 9–12", as the clip numbers them; a Pickup bar (numbered 0) is "pickup bar". */
export function barsName(clip: Clip, [first, last]: BarRange): string {
  const marks = marksOf(clip);
  const [a, b] = [barNumber(marks, first), barNumber(marks, last)];
  if (a === 0) return b === 0 ? 'pickup bar' : `pickup bar to bar ${b}`;
  return a === b ? `bar ${a}` : `bars ${a}–${b}`;
}

/**
 * Track `track` of the clip, or of bars `range` of it as the Export choices `style` cut them: what an image
 * draws. With the choices' bar numbers From arrangement, the bars keep the numbers they have in the whole
 * clip, as a picture of bars 9–12 of the song should read; else they count from 1.
 */
export function imagePart(clip: Clip, track: number, range: BarRange | null, style: StartWith & Pick<TabExportStyle, 'barNumbers'>): Part {
  if (!range) return partOf(clip, track);
  const part = partOf(clipOfBars(clip, range, style), track);
  return style.barNumbers === 'arrangement' ? { ...part, firstNumber: barNumber(marksOf(clip), range[0]) } : part;
}
