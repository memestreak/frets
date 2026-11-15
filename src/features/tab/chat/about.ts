/**
 * What a Chat popover prompt is about, in words (`docs/specs/2026-11-15-tab-chat-popover-design.md`,
 * issue #488): the selected bars, a picked word or mark, the note the cursor is on, else the whole
 * arrangement. What is picked also goes with every Chat request, as the selection and the cursor's bar do.
 */
import type { Picked } from '../useEditorState';
import { directionName } from '../directions';

const WORDS: Record<Exclude<Picked['kind'], 'mark'>, string> = {
  chord: 'the chord name',
  text: 'the Text',
  lyric: 'a syllable of the Lyrics',
  section: 'the section name',
  tempo: 'the tempo',
  ending: 'the ending bracket',
  time: 'the time signature',
  key: 'the key signature',
  repeatStart: 'the repeat start',
  repeatEnd: 'the repeat end',
  repeatCount: 'the repeat count',
  doubleBar: 'the double bar line',
  direction: 'the direction',
};

/** `picked` in bar `bar` (from 0), as "the chord name in bar 3" or "the let ring mark in bar 2". */
export function pickedWords(picked: Picked, bar: number): string {
  const what = picked.kind === 'mark'
    ? `the ${picked.mark.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} mark`
    : picked.kind === 'direction' ? `the ${directionName(picked.name)} direction` : WORDS[picked.kind];
  return `${what} in bar ${bar + 1}`;
}

/** The note the cursor is on (all from 0; string 0 the highest), as "the note at fret 7 on string 3 in bar 2". */
export function noteWords(fret: number | null, string: number, bar: number, column: number): string {
  const what = fret === null ? 'the dead note (x)' : `the note at fret ${fret}`;
  return `${what} on string ${string + 1} (counted from the highest) in bar ${bar + 1}, its column ${column + 1}`;
}

/** What the popover's prompt is about: its chip, and the words the prompt is sent with (none: the whole arrangement). */
export interface About {
  label: string;
  words: string | null;
}

export const WHOLE: About = { label: 'Whole arrangement', words: null };

/** The selected bars (from 0). */
export function aboutBars([first, last]: readonly [number, number]): About {
  return first === last
    ? { label: `Bar ${first + 1}`, words: `the selected bar ${first + 1}` }
    : { label: `Bars ${first + 1}–${last + 1}`, words: `the selected bars ${first + 1} to ${last + 1}` };
}

/** A picked word or mark, or the cursor's note: its words, the chip their first letter raised, "the" dropped. */
export function aboutThing(words: string): About {
  const short = words.replace(/^the /, '').replace(/ \(counted from the highest\)/, '').replace(/, its column \d+$/, '');
  return { label: short.charAt(0).toUpperCase() + short.slice(1), words };
}

/** The prompt as sent: "About <words>: <text>", or as typed about the whole arrangement. */
export function scopedPrompt(text: string, about: About): string {
  return about.words ? `About ${about.words}: ${text}` : text;
}
