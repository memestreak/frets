/**
 * The palette's tools: what each one is called, its key, what it does to
 * the clip and whether the cursor's column or note already has it. The
 * palette (`TabPalette.tsx`) and the keyboard both go through this table,
 * so a tip always names the key that does the same thing. Pure; no React.
 */
import { type BendQuarters, type Clip, type Duration, type NoteValue, type TremoloValue } from './clip';
import {
  columnAt, cycleBend, indexOf, cycleBendShape, cycleDots, cycleEnding, cycleMark, cycleRepeatEnd, cycleSlide, cycleTremolo,
  makeRest, noteAt, setDead, setMark, setSlide, setTremolo, setValue, toggleBendPart, toggleGrace, toggleLegato,
  toggleRepeatStart, toggleStroke, toggleTie, toggleTuplet, type MarkKind, type Target,
} from './editing';

export type ToolId =
  | 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtySecond' | 'sixtyFourth' | 'dot' | 'rest'
  | 'tuplet' | 'grace' | 'tremolo8' | 'tremolo16' | 'tremolo32' | 'tie'
  | 'legato' | 'slide' | 'shiftSlide' | 'slideBelow' | 'slideAbove' | 'slideOutDown' | 'slideOutUp'
  | 'bend' | 'release' | 'preBend'
  | 'vibrato' | 'palmMute' | 'letRing' | 'dead' | 'ghost' | 'harmonic' | 'pinchHarmonic' | 'tap'
  | 'strokeDown' | 'strokeUp' | 'accent' | 'heavyAccent' | 'staccato'
  | 'insertBarBefore' | 'insertBar' | 'barTime' | 'repeatStart' | 'repeatEnd' | 'ending'
  | 'chordName' | 'section' | 'tempo' | 'capo';

export interface Tool {
  id: ToolId;
  /** The tip's words, and the button's name for screen readers. */
  label: string;
  /** The key, as the tip shows it; empty for none. */
  key: string;
}

/** The palette's groups, in order; each group is drawn together. */
export const TOOL_GROUPS: { label: string; tools: Tool[] }[] = [
  {
    label: 'Duration',
    tools: [
      { id: 'whole', label: 'Whole note', key: '+ −' },
      { id: 'half', label: 'Half note', key: '+ −' },
      { id: 'quarter', label: 'Quarter note', key: '+ −' },
      { id: 'eighth', label: 'Eighth note', key: '+ −' },
      { id: 'sixteenth', label: 'Sixteenth note', key: '+ −' },
      { id: 'thirtySecond', label: 'Thirty-second note', key: '+ −' },
      { id: 'sixtyFourth', label: 'Sixty-fourth note', key: '+ −' },
      { id: 'dot', label: 'Dotted, then double dotted', key: '.' },
      { id: 'rest', label: 'Rest', key: 'R' },
    ],
  },
  {
    label: 'Rhythm',
    tools: [
      { id: 'tuplet', label: 'Tuplet', key: 'Alt+3, 5, 6 or 7' },
      { id: 'grace', label: 'Grace note, just before the beat', key: 'Shift+G' },
      { id: 'tremolo8', label: 'Tremolo picking in eighths', key: 'Shift+T' },
      { id: 'tremolo16', label: 'Tremolo picking in sixteenths', key: 'Shift+T' },
      { id: 'tremolo32', label: 'Tremolo picking in thirty-seconds', key: 'Shift+T' },
    ],
  },
  {
    label: 'Joins',
    tools: [
      { id: 'tie', label: 'Tie to the note before', key: '=' },
      { id: 'legato', label: 'Hammer-on or pull-off from the note before', key: 'H' },
      { id: 'slide', label: 'Slide from the note before', key: '/' },
      { id: 'shiftSlide', label: 'Shift slide from the note before', key: '/' },
      { id: 'slideBelow', label: 'Slide in from below', key: '/' },
      { id: 'slideAbove', label: 'Slide in from above', key: '/' },
      { id: 'slideOutDown', label: 'Slide out downward', key: '\\' },
      { id: 'slideOutUp', label: 'Slide out upward', key: '\\' },
    ],
  },
  {
    label: 'Bends',
    tools: [
      { id: 'bend', label: 'Bend', key: 'B' },
      { id: 'release', label: 'Release the bend', key: 'Shift+B' },
      { id: 'preBend', label: 'Pre-bend', key: 'Shift+B' },
    ],
  },
  {
    label: 'Techniques',
    tools: [
      { id: 'vibrato', label: 'Vibrato: normal, wide, then off', key: 'V' },
      { id: 'palmMute', label: 'Palm mute', key: 'M' },
      { id: 'letRing', label: 'Let ring', key: 'L' },
      { id: 'dead', label: 'Dead note', key: 'X' },
      { id: 'ghost', label: 'Ghost note', key: 'G' },
      { id: 'harmonic', label: 'Natural harmonic', key: 'N' },
      { id: 'pinchHarmonic', label: 'Pinch harmonic', key: 'N' },
      { id: 'tap', label: 'Tap', key: 'T' },
      { id: 'strokeDown', label: 'Down stroke', key: 'D' },
      { id: 'strokeUp', label: 'Up stroke', key: 'U' },
    ],
  },
  {
    label: 'Accents',
    tools: [
      { id: 'accent', label: 'Accent', key: 'A' },
      { id: 'heavyAccent', label: 'Heavy accent', key: 'A' },
      { id: 'staccato', label: 'Staccato', key: 'S' },
    ],
  },
  {
    label: 'Bars',
    tools: [
      { id: 'insertBarBefore', label: 'Insert a bar of rests before this bar', key: 'Ctrl+Shift+Enter' },
      { id: 'insertBar', label: 'Insert a bar of rests after this bar', key: 'Ctrl+Enter' },
      { id: 'barTime', label: 'Time signature from this bar', key: '' },
      { id: 'repeatStart', label: 'Repeat starts at this bar', key: '[' },
      { id: 'repeatEnd', label: 'Repeat ends at this bar (again: ×3, ×4)', key: ']' },
      { id: 'ending', label: 'Ending 1., then 2.', key: 'E' },
    ],
  },
  {
    label: 'Text',
    tools: [
      { id: 'chordName', label: 'Chord name over this column', key: 'C' },
      { id: 'section', label: 'Section starting at this bar', key: '' },
      { id: 'tempo', label: 'Tempo from this bar on', key: '' },
      { id: 'capo', label: 'Capo', key: '' },
    ],
  },
];

const VALUE: Partial<Record<ToolId, NoteValue>> = {
  whole: 1, half: 2, quarter: 4, eighth: 8, sixteenth: 16, thirtySecond: 32, sixtyFourth: 64,
};
const TREMOLO: Partial<Record<ToolId, TremoloValue>> = { tremolo8: 8, tremolo16: 16, tremolo32: 32 };

/** The vibrato kinds the V key and the Vibrato button step through, then off. */
const VIBRATOS: ('slight' | 'wide')[] = ['slight', 'wide'];

/** Tools that set one note mark to one kind (or on). */
const MARK: Partial<Record<ToolId, MarkKind>> = {
  harmonic: ['harmonic', 'natural'], pinchHarmonic: ['harmonic', 'pinch'],
  accent: ['accent', 'normal'], heavyAccent: ['accent', 'heavy'],
  slideOutDown: ['slideOut', 'down'], slideOutUp: ['slideOut', 'up'],
  palmMute: ['palmMute', true], letRing: ['letRing', true], ghost: ['ghost', true],
  staccato: ['staccato', true], tap: ['tap', true],
};

/**
 * Marks drawn once over a column (the P.M. and let ring lines, accents, staccato) apply to every note
 * in the column, wherever the cursor is in it: a mark half the column had would look all on.
 */
const COLUMN_MARKS = new Set<MarkKind[0]>(['palmMute', 'letRing', 'accent', 'staccato']);

/** The target as whole columns: the selection, else the cursor's column. */
function wholeColumns(clip: Clip, target: Target): Target {
  if (target.selection || !columnAt(clip, target.cursor)) return target;
  const i = indexOf(clip, target.cursor.bar, target.cursor.column);
  return { ...target, selection: { anchor: i, focus: i } };
}

/** Tools that open a field over the tab for words (`TabPage` handles them); they don't change the clip themselves. */
export const WORD_TOOLS = { chordName: 'chord', section: 'section', tempo: 'tempo', capo: 'capo' } as const;
export type WordKind = (typeof WORD_TOOLS)[keyof typeof WORD_TOOLS];

/** The clip after a palette press. */
export function applyTool(clip: Clip, target: Target, id: ToolId): Clip {
  const value = VALUE[id];
  if (value) return setValue(clip, target, value);
  const tremolo = TREMOLO[id];
  if (tremolo) return setTremolo(clip, target, tremolo);
  const mark = MARK[id];
  if (mark) return setMark(clip, COLUMN_MARKS.has(mark[0]) ? wholeColumns(clip, target) : target, mark);
  switch (id) {
    case 'dot': return cycleDots(clip, target);
    case 'vibrato': return cycleMark(clip, target, 'vibrato', VIBRATOS);
    case 'grace': return toggleGrace(clip, target);
    case 'rest': return makeRest(clip, target);
    case 'tie': return toggleTie(clip, target);
    case 'legato': return toggleLegato(clip, target);
    case 'slide': return setSlide(clip, target, 'legato');
    case 'shiftSlide': return setSlide(clip, target, 'shift');
    case 'slideBelow': return setSlide(clip, target, 'below');
    case 'slideAbove': return setSlide(clip, target, 'above');
    case 'release': return toggleBendPart(clip, target, 'release');
    case 'preBend': return toggleBendPart(clip, target, 'pre');
    case 'dead': return setDead(clip, target.cursor);
    case 'strokeDown': return toggleStroke(clip, target, 'down');
    case 'strokeUp': return toggleStroke(clip, target, 'up');
    case 'repeatStart': return toggleRepeatStart(clip, target.cursor);
    case 'repeatEnd': return cycleRepeatEnd(clip, target.cursor);
    case 'ending': return cycleEnding(clip, target.cursor);
    default: return clip;
  }
}

/**
 * The clip after a key press that steps through a tool's choices (b, Shift+B, /, \\, V, N, A, Shift+T), or null
 * when the key isn't one of them; those keys cycle rather than set one choice as the palette's buttons do.
 */
export function applyCyclingKey(clip: Clip, target: Target, key: string): Clip | null {
  const { cursor } = target;
  if (key === 'b') return cycleBend(clip, target);
  if (key === 'B') return cycleBendShape(clip, cursor);
  if (key === '/') return cycleSlide(clip, cursor);
  if (key === '\\') return cycleMark(clip, target, 'slideOut', ['down', 'up']);
  if (key === 'v') return cycleMark(clip, target, 'vibrato', VIBRATOS);
  if (key === 'n') return cycleMark(clip, target, 'harmonic', ['natural', 'pinch']);
  if (key === 'a') return cycleMark(clip, wholeColumns(clip, target), 'accent', ['normal', 'heavy']);
  if (key === 'T') return cycleTremolo(clip, target);
  return null;
}

/**
 * The clip after Alt with 3, 5, 6 or 7 (a triplet … septuplet on the target, or plain again), or null
 * for any other key. Alt with a digit types other characters on some layouts, so the key's place is read.
 */
export function applyTupletKey(clip: Clip, target: Target, code: string): Clip | null {
  const n = ({ Digit3: 3, Digit5: 5, Digit6: 6, Digit7: 7 } as Record<string, number>)[code];
  return n ? toggleTuplet(clip, target, n) : null;
}

/** The tool a key press does, for the keys that do exactly what one button does. */
export function toolForKey(key: string, alt: boolean): ToolId | null {
  if (alt) return null;
  const keys: Record<string, ToolId> = {
    '.': 'dot', r: 'rest', '=': 'tie', h: 'legato', p: 'legato', m: 'palmMute', l: 'letRing',
    x: 'dead', g: 'ghost', t: 'tap', d: 'strokeDown', u: 'strokeUp', s: 'staccato',
    '[': 'repeatStart', ']': 'repeatEnd', e: 'ending', c: 'chordName', G: 'grace',
  };
  return keys[key] ?? null;
}

/** Whether the cursor's column, note or bar has what a tool sets, to show its button pressed. */
export function isOn(clip: Clip, cursor: Target['cursor'], id: ToolId): boolean {
  const column = columnAt(clip, cursor);
  const note = noteAt(clip, cursor);
  const bar = clip.bars[cursor.bar];
  const value = VALUE[id];
  if (value) return column?.duration.value === value;
  const tremolo = TREMOLO[id];
  if (tremolo) return column?.tremolo === tremolo;
  const mark = MARK[id];
  if (mark && COLUMN_MARKS.has(mark[0])) {
    const notes = column?.notes.filter(n => n !== null) ?? [];
    return notes.length > 0 && notes.every(n => n[mark[0]] === mark[1]);
  }
  if (mark) return note?.[mark[0]] === mark[1];
  switch (id) {
    case 'dot': return (column?.duration.dots ?? 0) > 0;
    case 'tuplet': return !!column?.duration.tuplet;
    case 'bend': return !!note?.bend;
    case 'vibrato': return !!note?.vibrato;
    case 'grace': return !!column?.grace;
    case 'rest': return !!column && column.notes.every(n => n === null);
    case 'tie': return !!note?.tie;
    case 'legato': return !!note?.legato;
    case 'slide': return note?.slide === 'legato';
    case 'shiftSlide': return note?.slide === 'shift';
    case 'slideBelow': return note?.slide === 'below';
    case 'slideAbove': return note?.slide === 'above';
    case 'release': return !!note?.bend?.release;
    case 'preBend': return !!note?.bend?.pre;
    case 'dead': return note?.fret === null;
    case 'strokeDown': return column?.stroke === 'down';
    case 'strokeUp': return column?.stroke === 'up';
    case 'repeatStart': return !!bar?.repeatStart;
    case 'repeatEnd': return !!bar?.repeatEnd;
    case 'ending': return !!bar?.ending;
    case 'chordName': return !!column?.chord;
    case 'section': return !!bar?.section;
    case 'tempo': return !!bar?.tempo;
    case 'capo': return !!clip.capo;
    default: return false;
  }
}

/** What the cursor has of the things whose buttons draw it (the Bend, Vibrato and Tuplet icons); none off the tab. */
export function noteKinds(clip: Clip, cursor: Target['cursor'] | null): {
  bend: BendQuarters | null;
  vibrato: 'slight' | 'wide' | null;
  /** The cursor column's duration while it is in a tuplet. */
  tuplet: Duration | null;
} {
  const note = cursor ? noteAt(clip, cursor) : null;
  const duration = cursor ? columnAt(clip, cursor)?.duration : undefined;
  return { bend: note?.bend?.quarters ?? null, vibrato: note?.vibrato ?? null, tuplet: duration?.tuplet ? duration : null };
}
