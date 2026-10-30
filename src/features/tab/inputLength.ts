/**
 * Note input's length (issue #238, as MuseScore's): the length the next note entered takes, set before
 * it is entered. The length keys and the palette's Duration buttons set it in note input, and the
 * shadow note shows it; notes already entered keep theirs. Pure.
 */
import { NOTE_VALUES, SHORTEST_DOTTED, type Duration, type NoteValue, type Part } from './clip';
import { columnAt, lastNoteLength, type Cursor } from './editing';
import { toolValue, type ToolId } from './tools';

/** The length note input starts with: the cursor's note's, else the last note's before it (a quarter with none). */
export function startLength(clip: Part, cursor: Cursor): Duration {
  const column = columnAt(clip, cursor);
  if (column && !column.grace && column.notes.some(Boolean)) return { value: column.duration.value, dots: column.duration.dots };
  return lastNoteLength(clip, cursor);
}

/** A length of one value, with no dots (a digit, a Duration button). */
export function lengthOf(value: NoteValue): Duration {
  return { value, dots: 0 };
}

/** One value longer (+1) or shorter (−1), as + − and W Q; a sixty-fourth takes no dots. */
export function stepLength(length: Duration, step: 1 | -1): Duration {
  const i = NOTE_VALUES.indexOf(length.value);
  const value = NOTE_VALUES[Math.min(NOTE_VALUES.length - 1, Math.max(0, i - step))];
  return { value, dots: value > SHORTEST_DOTTED ? 0 : length.dots };
}

/** None, one dot, two dots, as the . key and the Dotted button cycle them. */
export function cycleLengthDots(length: Duration): Duration {
  return { value: length.value, dots: length.value > SHORTEST_DOTTED ? 0 : ((length.dots + 1) % 3) as Duration['dots'] };
}

/** Whether a Duration button (or Dotted) shows note input's length, to light it. */
export function lengthIsOn(length: Duration, id: ToolId): boolean {
  if (id === 'dot') return length.dots > 0;
  return toolValue(id) === length.value;
}
