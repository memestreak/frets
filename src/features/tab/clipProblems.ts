/**
 * The bar problem messages of a Clip, in words: how far a bar is from filling its time signature, a
 * tuplet that isn't whole, notes clashing on a string, and the sentences of the warning under a bar.
 * Split from `clip.ts` (health check, #442). Pure; no React.
 */
import {
  barLength, barNumber, barSpan, barTicks, fewestRests, isUneven, NOTE_VALUES, sameTuplet, STRING_COUNT, ticks, timeAt, tupletLabel, WHOLE,
  type Bar, type Column, type Duration, type NoteValue, type Part, type TimeSignature,
} from './clip';

/** How far a bar is from filling its time signature, in words ("1 beat and a 32nd"), and which way; null when it fills it. */
export function unevenBy(clip: Pick<Part, 'time' | 'bars'>, index: number): { words: string; over: boolean } | null {
  const time = timeAt(clip, index);
  const off = barLength(clip.bars[index]) - barSpan(clip, index);
  return off === 0 ? null : { words: timeInWords(Math.abs(off), time), over: off > 0 };
}

const NOTE_NAMES: Readonly<Record<NoteValue, string>> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: '8th', 16: '16th', 32: '32nd', 64: '64th' };

/** A note length in words, with its article: "a quarter", "an 8th", "a dotted 16th", "an 8th triplet". */
function noteInWords(duration: Duration): string {
  const dots = ['', 'dotted ', 'double-dotted '][duration.dots];
  const name = `${dots}${NOTE_NAMES[duration.value]}${duration.tuplet ? ' triplet' : ''}`;
  return `${name.startsWith('8') ? 'an' : 'a'} ${name}`;
}

const FRACTIONS: Readonly<Record<string, string>> = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
};

/** `part` of `whole` as a fraction in lowest terms, in one glyph where there is one: "⅓", "5/24". */
function fraction(part: number, whole: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(part, whole);
  const text = `${part / d}/${whole / d}`;
  return FRACTIONS[text] ?? text;
}

/**
 * A length of time, `t` ticks, the way a guitarist counts it in a bar of `time`: whole beats (a beat
 * is the time signature's bottom number, so an 8th in 6/8), then what's left as the fewest plain
 * notes, else as one triplet note, else as a fraction of a beat ("1 beat and ⅕ of a beat").
 */
export function timeInWords(t: number, time: TimeSignature): string {
  const beat = WHOLE / time.value;
  const beats = Math.floor(t / beat);
  const left = t - beats * beat;
  const parts: string[] = beats > 0 ? [`${beats} beat${beats === 1 ? '' : 's'}`] : [];
  if (left > 0) {
    const plain = fewestRests(left);
    const triplet = NOTE_VALUES.map((value): Duration => ({ value, dots: 0, tuplet: 3 })).find(d => ticks(d) === left);
    if (plain.reduce((sum, d) => sum + ticks(d), 0) === left) parts.push(...plain.map(noteInWords));
    else if (triplet) parts.push(noteInWords(triplet));
    else parts.push(`${fraction(left, beat)} of a beat`);
  }
  return listed(parts);
}

/**
 * A sentence for each bar and string where two of the part's Voices sound at once: "Bar 3 has two voices
 * on string 2." A tied note sounds on; a grace note takes no time and is left out. Strings are numbered as
 * tab numbers them, 1 the high e.
 */
export function stringClashes(part: Pick<Part, 'bars' | 'voice'>): string[] {
  const out: string[] = [];
  part.bars.forEach((bar, b) => {
    if (!bar.otherVoices?.length) return;
    const voices = [bar.columns, ...bar.otherVoices.map(o => o.columns)];
    const spans = voices.map(columns => {
      const on: [number, number][][] = Array.from({ length: STRING_COUNT }, () => []);
      let t = 0;
      for (const column of columns) {
        if (column.grace) continue;
        const end = t + ticks(column.duration);
        column.notes.forEach((note, s) => { if (note) on[s].push([t, end]); });
        t = end;
      }
      return on;
    });
    for (let s = 0; s < STRING_COUNT; s++) {
      const clash = spans.some((a, i) => spans.some((c, k) => k > i
        && a[s].some(([from, to]) => c[s].some(([f, e]) => from < e && f < to))));
      if (clash) out.push(`Bar ${barNumber(part, b)} has two voices on string ${s + 1}.`);
    }
  });
  return out;
}

/** A list of numbers in words: "2", "2 and 5", "2, 5 and 7". */
export function listed(numbers: readonly (number | string)[]): string {
  return numbers.length < 2 ? numbers.join('') : `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

/**
 * The line that names each bar that doesn't add up and by how much, a clause a bar; a bar with the
 * same time signature as the one named before it leaves the time signature out ("Bar 2 doesn't add
 * up to 4/4: 1 beat short; bar 3: 1 beat short; bar 5 doesn't add up to 3/4: a 16th over."), or null
 * when every bar adds up.
 */
export function unevenMessage(clip: Pick<Part, 'time' | 'bars'>): string | null {
  const parts: string[] = [];
  let lastTime = '';
  clip.bars.forEach((bar, i) => {
    if (!isUneven(clip, i)) return;
    const time = timeAt(clip, i);
    const key = `${time.beats}/${time.value}`;
    const amount = amountText(unevenBy(clip, i));
    parts.push(key === lastTime ? `bar ${barNumber(clip, i)}${amount}` : `bar ${barNumber(clip, i)} doesn't add up to ${key}${amount}`);
    lastTime = key;
  });
  clip.bars.forEach((_, i) => parts.push(...otherVoicesUneven(clip, i)));
  if (parts.length === 0) return null;
  const line = `${parts.join('; ')}.`;
  return line[0].toUpperCase() + line.slice(1);
}

/**
 * What is wrong with the tuplets in one bar, a sentence each ("The tuplet of 5 in bar 2 has 4 notes;
 * it needs 5."). A run of columns in the same kind of tuplet is counted in its shortest note, so a
 * quarter and an eighth make a whole triplet; the run must come to a whole number of groups. Grace
 * notes take no part.
 */
export function tupletProblems(bar: Bar, index: number): string[] {
  const problems: string[] = [];
  const columns = bar.columns.filter(c => !c.grace);
  let i = 0;
  while (i < columns.length) {
    const first = columns[i].duration;
    if (!first.tuplet) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < columns.length && sameTuplet(columns[end + 1].duration, first)) end++;
    const plain = columns.slice(i, end + 1).map(c => ticks({ value: c.duration.value, dots: c.duration.dots }));
    const notes = plain.reduce((sum, t) => sum + t, 0) / Math.min(...plain);
    const n = first.tuplet;
    if (notes % n !== 0) {
      const needs = Math.ceil(notes / n) * n;
      const count = Number.isInteger(notes) ? String(notes) : notes.toFixed(1);
      problems.push(`The tuplet of ${tupletLabel(first)} in bar ${index + 1} has ${count} note${notes === 1 ? '' : 's'}; it needs ${needs}.`);
    }
    i = end + 1;
  }
  return problems;
}

/**
 * How a bar's columns (grace notes left out) fall into tuplet groups, by their places in that list:
 * each run of the same kind of tuplet is cut into groups of n of its shortest note (a quarter and an
 * eighth fill a triplet of eighths), the last one short if the run is. Each group is drawn with its
 * bracket and number.
 */
export function tupletGroups(columns: Column[]): { from: number; to: number; duration: Duration }[] {
  const groups: { from: number; to: number; duration: Duration }[] = [];
  let i = 0;
  while (i < columns.length) {
    const first = columns[i].duration;
    if (!first.tuplet) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < columns.length && sameTuplet(columns[end + 1].duration, first)) end++;
    const plain = (c: Column) => ticks({ value: c.duration.value, dots: c.duration.dots });
    const unit = Math.min(...columns.slice(i, end + 1).map(plain));
    let from = i;
    let filled = 0;
    for (let k = i; k <= end; k++) {
      filled += plain(columns[k]);
      if (filled >= first.tuplet * unit || k === end) {
        groups.push({ from, to: k, duration: first });
        from = k + 1;
        filled = 0;
      }
    }
    i = end + 1;
  }
  return groups;
}

/** The line that names every tuplet missing notes or with extra ones, or null when every one is whole. */
export function brokenTupletMessage(clip: Pick<Part, 'bars'>): string | null {
  const lines = clip.bars.flatMap((bar, b) => tupletProblems(bar, barNumber(clip, b) - 1));
  return lines.length > 0 ? lines.join(' ') : null;
}

/** ": 1 beat short", ": a 16th over", or nothing when the bar fills its time (no way to be uneven, then). */
/**
 * A clause for each of bar `index`'s other Voices that doesn't fill it: "bar 4's voice 2 doesn't add up
 * to 4/4: 1 beat short". An empty Voice is absent, never short.
 */
function otherVoicesUneven(clip: Pick<Part, 'time' | 'bars'>, index: number): string[] {
  const time = timeAt(clip, index);
  return (clip.bars[index].otherVoices ?? []).flatMap(({ voice, columns }) => {
    const off = barLength({ columns }) - barTicks(time);
    if (off === 0) return [];
    const amount = amountText({ words: timeInWords(Math.abs(off), time), over: off > 0 });
    return [`bar ${barNumber(clip, index)}'s voice ${voice + 1} doesn't add up to ${time.beats}/${time.value}${amount}`];
  });
}

function amountText(by: { words: string; over: boolean } | null): string {
  return by ? `: ${by.words} ${by.over ? 'over' : 'short'}` : '';
}

/**
 * Each bar with something wrong (it doesn't add up, a tuplet in it isn't whole) and what, in
 * sentences: the tip on the warning drawn under the bar's start.
 */
export function barErrors(clip: Pick<Part, 'time' | 'bars'>): Map<number, string> {
  const errors = new Map<number, string>();
  clip.bars.forEach((bar, b) => {
    const time = timeAt(clip, b);
    const lines = [
      ...(isUneven(clip, b) ? [`Bar ${barNumber(clip, b)} doesn't add up to ${time.beats}/${time.value}${amountText(unevenBy(clip, b))}.`] : []),
      ...tupletProblems(bar, barNumber(clip, b) - 1),
      ...otherVoicesUneven(clip, b).map(clause => `${clause[0].toUpperCase()}${clause.slice(1)}.`),
    ];
    if (lines.length > 0) errors.set(b, lines.join(' '));
  });
  return errors;
}

