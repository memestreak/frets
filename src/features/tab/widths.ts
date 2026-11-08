/**
 * How wide each thing on a line is drawn, in SVG units: a bar's lead, a column's notes, a chord name, a
 * key signature, a note head and the accidentals left of it. `layout.ts` adds them up along the line.
 */
import { ticks, WHOLE, type Bar, type Column, type Note } from './clip';
import { accidentalLanes, type Head } from './notation';
import { SPACE } from './rows';

export const CLEF_WIDTH = 30;
export const TIME_WIDTH = 30;
/** The notation staff's room for the first line's time signature, after the key signature, and the margin before its lines. */
export const STAFF_TIME_WIDTH = 26;
export const STAFF_MARGIN = 2;
/** In Both, room before the lines for the bracket that joins the staff and the tab. */
export const BRACKET_WIDTH = 10;
export const BRACKET_MARGIN = BRACKET_WIDTH + 6;
/** Room for a time signature change, just inside the bar it starts. */
export const BAR_TIME_WIDTH = 24;
/** The room a free-time bar's brackets round its time signature take. */
export const TIME_BRACKETS_WIDTH = 14;
const BAR_PAD_START = 14;
export const BAR_PAD_END = 6;
export const REPEAT_PAD = 12;
export const EMPTY_BAR = 120;
const CHAR = 7.5;
/** A key signature's room per sharp or flat, and after the last. */
const KEY_SIGN_WIDTH = 8;
const KEY_PAD = 6;
/** Room left of a note head for one lane of sharps, flats and naturals. */
export const ACCIDENTAL_ROOM = 10;
/** A note head's width; a head a second from the one below it goes beside it, this far right. */
export const HEAD_WIDTH = 1.18 * SPACE;

/** How wide a key signature is drawn, with the room after it; none for C major. */
export function keyWidth(fifths: number): number {
  return fifths === 0 ? 0 : Math.abs(fifths) * KEY_SIGN_WIDTH + KEY_PAD;
}

/** A column's width: longer notes take more room, and its widest note must fit; a grace note takes little. */
export function columnWidth(column: Column): number {
  // Twice as long takes √2 as much room, as Guitar Pro spaces it (Jeremy, 2026-10-28).
  const byTime = column.grace ? 16 : QUARTER_ROOM * Math.sqrt(ticks(column.duration) / (WHOLE / 4));
  // A bend's arrow and label stand right of the number; a release needs more. A tied note carrying a
  // bend on (`bendCarries`) needs none: its line comes from the note before.
  const own = column.notes.filter(n => n?.bend && !(n.tie && n.bend.pre));
  const bend = own.some(n => n?.bend?.release) ? 30 : own.length > 0 ? 18 : 0;
  const slideOut = bend === 0 && column.notes.some(n => n?.slideOut) ? 12 : 0;
  return Math.max(byTime, minColumnWidth(column)) + bend + slideOut;
}

/** A quarter note's room along the line: a sixteenth keeps the room it had, 28, so its numbers stay apart. */
const QUARTER_ROOM = 56;

/** How far into its room a column's note stands: past half its widest number, so the number starts the room. */
export function noteInset(column: Column): number {
  return minColumnWidth(column) / 2;
}

/** The least room a column takes on a line squeezed to fit: its numbers, and on the staff its heads and accidentals. */
export function leastWidth(column: Column, heads: Head[], staff: boolean): number {
  if (!staff) return minColumnWidth(column);
  const seconds = heads.some((h, k) => k > 0 && h.step - heads[k - 1].step === 1) ? HEAD_WIDTH : 0;
  return Math.max(minColumnWidth(column), STAFF_LEAST) + signRoom(heads) + seconds;
}
/** A note head and a little room either side. */
const STAFF_LEAST = 20;

/** The least room a column's widest note needs. */
export function minColumnWidth(column: Column): number {
  const widest = Math.max(1, ...column.notes.map(n => (n ? noteLabel(n).length : 0)));
  return Math.max(widest * charWidth(column) + 6, column.chord ? chordWidth(column.chord) + 6 : 0);
}

/** A grace note's numbers are drawn smaller than the rest. */
export const GRACE_SIZE = 9;
/** How wide one character of a column's numbers is drawn. */
export function charWidth(column: Column): number {
  return column.grace ? 5.5 : CHAR;
}

export const CHORD_SIZE = 12;
/** A chord name as printed: the sharps and flats of its root and its bass as ♯ and ♭ ("Ab5" is drawn A♭5); the text stays as typed. */
export function prettyChord(chord: string): string {
  return chord.replace(/(^|\/)([A-G])(##|bb|#|b)/g, (_, before: string, letter: string, sign: string) =>
    before + letter + sign.replace('##', '𝄪').replace('bb', '𝄫').replace('#', '♯').replace('b', '♭'));
}
export function chordWidth(chord: string): number {
  return chord.length * 7;
}

/**
 * What is written on the string for a note: "5", "X" (a capital, as printed tab has it, issue #177), "<12>" for a natural harmonic, and in brackets
 * a tie, "(5)" with an arc from the note before, or a ghost note, "(5)" or "(X)" alone.
 */
export function noteLabel(note: Note): string {
  if (note.tie) return `(${note.fret})`;
  const label = note.fret === null ? 'X' : note.harmonic === 'natural' ? `<${note.fret}>` : String(note.fret);
  return note.ghost ? `(${label})` : label;
}

/** The room a bar takes before its first column: padding, a repeat's dots, and a time or key signature change. */
export function barLead(bar: Bar, timeChange: boolean, keyChange: number, brackets = false): number {
  return BAR_PAD_START + (bar.repeatStart ? REPEAT_PAD : 0) + (timeChange ? BAR_TIME_WIDTH : 0) + (brackets ? TIME_BRACKETS_WIDTH : 0) + keyChange;
}

/** A column's room on the staff too: its accidentals and a head set beside its neighbour a second away. */
export function staffWidth(column: Column, heads: Head[]): number {
  const signs = signRoom(heads);
  const seconds = heads.some((h, k) => k > 0 && h.step - heads[k - 1].step === 1) ? HEAD_WIDTH : 0;
  return columnWidth(column) + signs + seconds;
}

/** The room left of a column's heads: their accidentals, and a bent note's starting head before them. */
export function signRoom(heads: Head[]): number {
  return accidentalRoom(heads) + bendFromRoom(heads);
}

/** The room a column's accidentals take left of its heads. */
export function accidentalRoom(heads: Head[]): number {
  const lanes = accidentalLanes(heads).filter((l): l is number => l !== null);
  return lanes.length === 0 ? 0 : (Math.max(...lanes) + 1) * ACCIDENTAL_ROOM + 2;
}

/** A bent note's bracketed starting head and the line from it to the note (issue #176). */
export const BEND_FROM_ROOM = 34;

/** The room left of the accidentals for a bent note's starting head, and its own accidental. */
export function bendFromRoom(heads: Head[]): number {
  const from = heads.filter(h => h.bendFrom);
  if (from.length === 0) return 0;
  return BEND_FROM_ROOM + (from.some(h => h.bendFrom!.shows !== null) ? ACCIDENTAL_ROOM : 0);
}
