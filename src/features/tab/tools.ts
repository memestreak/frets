/**
 * The palette's tools: what each one is called, its key, what it does to
 * the clip and whether the cursor's column or note already has it. The
 * palette (`TabPalette.tsx`) and the keyboard both go through this table,
 * so a tip always names the key that does the same thing. Pure; no React.
 */
import type { Clip, NoteValue } from './clip';
import {
  columnAt, cycleBend, indexOf, cycleBendShape, cycleDots, cycleEnding, cycleMark, cycleRepeatEnd, cycleSlide,
  makeRest, noteAt, setBend, setDead, setMark, setSlide, setValue, toggleBendPart, toggleLegato,
  toggleRepeatStart, toggleStroke, toggleTie, toggleTriplet, type MarkKind, type Target,
} from './editing';

export type ToolId =
  | 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtySecond' | 'sixtyFourth' | 'dot' | 'triplet' | 'rest' | 'tie'
  | 'legato' | 'slide' | 'shiftSlide' | 'slideBelow' | 'slideAbove' | 'slideOutDown' | 'slideOutUp'
  | 'bend1' | 'bend2' | 'bend4' | 'bend6' | 'bend8' | 'release' | 'preBend'
  | 'vibrato' | 'wideVibrato' | 'palmMute' | 'letRing' | 'dead' | 'ghost' | 'harmonic' | 'pinchHarmonic' | 'tap'
  | 'strokeDown' | 'strokeUp' | 'accent' | 'heavyAccent' | 'staccato'
  | 'repeatStart' | 'repeatEnd' | 'ending'
  | 'chordName' | 'section' | 'tempo';

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
      { id: 'triplet', label: 'Triplet', key: 'Alt+3' },
      { id: 'rest', label: 'Rest', key: 'R' },
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
      { id: 'bend1', label: 'Bend ¼', key: 'B' },
      { id: 'bend2', label: 'Bend ½', key: 'B' },
      { id: 'bend4', label: 'Bend full', key: 'B' },
      { id: 'bend6', label: 'Bend 1½', key: 'B' },
      { id: 'bend8', label: 'Bend 2', key: 'B' },
      { id: 'release', label: 'Release the bend', key: 'Shift+B' },
      { id: 'preBend', label: 'Pre-bend', key: 'Shift+B' },
    ],
  },
  {
    label: 'Techniques',
    tools: [
      { id: 'vibrato', label: 'Vibrato', key: 'V' },
      { id: 'wideVibrato', label: 'Wide vibrato', key: 'V' },
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
    label: 'Repeats',
    tools: [
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
    ],
  },
];

const VALUE: Partial<Record<ToolId, NoteValue>> = {
  whole: 1, half: 2, quarter: 4, eighth: 8, sixteenth: 16, thirtySecond: 32, sixtyFourth: 64,
};
const BEND: Partial<Record<ToolId, 1 | 2 | 4 | 6 | 8>> = { bend1: 1, bend2: 2, bend4: 4, bend6: 6, bend8: 8 };

/** Tools that set one note mark to one kind (or on). */
const MARK: Partial<Record<ToolId, MarkKind>> = {
  vibrato: ['vibrato', 'slight'], wideVibrato: ['vibrato', 'wide'],
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
export const WORD_TOOLS = { chordName: 'chord', section: 'section', tempo: 'tempo' } as const;
export type WordKind = (typeof WORD_TOOLS)[keyof typeof WORD_TOOLS];

/** The clip after a palette press. */
export function applyTool(clip: Clip, target: Target, id: ToolId): Clip {
  const value = VALUE[id];
  if (value) return setValue(clip, target, value);
  const bend = BEND[id];
  if (bend) return setBend(clip, target, bend);
  const mark = MARK[id];
  if (mark) return setMark(clip, COLUMN_MARKS.has(mark[0]) ? wholeColumns(clip, target) : target, mark);
  switch (id) {
    case 'dot': return cycleDots(clip, target);
    case 'triplet': return toggleTriplet(clip, target);
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
 * The clip after a key press that steps through a tool's choices (b, Shift+B, /, \\, V, N, A), or null
 * when the key isn't one of them; those keys cycle rather than set one choice as the palette's buttons do.
 */
export function applyCyclingKey(clip: Clip, target: Target, key: string): Clip | null {
  const { cursor } = target;
  if (key === 'b') return cycleBend(clip, cursor);
  if (key === 'B') return cycleBendShape(clip, cursor);
  if (key === '/') return cycleSlide(clip, cursor);
  if (key === '\\') return cycleMark(clip, target, 'slideOut', ['down', 'up']);
  if (key === 'v') return cycleMark(clip, target, 'vibrato', ['slight', 'wide']);
  if (key === 'n') return cycleMark(clip, target, 'harmonic', ['natural', 'pinch']);
  if (key === 'a') return cycleMark(clip, wholeColumns(clip, target), 'accent', ['normal', 'heavy']);
  return null;
}

/** The tool a key press does, for the keys that do exactly what one button does. */
export function toolForKey(key: string, alt: boolean, code: string): ToolId | null {
  if (alt) return code === 'Digit3' ? 'triplet' : null;
  const keys: Record<string, ToolId> = {
    '.': 'dot', r: 'rest', '=': 'tie', h: 'legato', p: 'legato', m: 'palmMute', l: 'letRing',
    x: 'dead', g: 'ghost', t: 'tap', d: 'strokeDown', u: 'strokeUp', s: 'staccato',
    '[': 'repeatStart', ']': 'repeatEnd', e: 'ending', c: 'chordName',
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
  const bend = BEND[id];
  if (bend) return note?.bend?.quarters === bend;
  const mark = MARK[id];
  if (mark && COLUMN_MARKS.has(mark[0])) {
    const notes = column?.notes.filter(n => n !== null) ?? [];
    return notes.length > 0 && notes.every(n => n[mark[0]] === mark[1]);
  }
  if (mark) return note?.[mark[0]] === mark[1];
  switch (id) {
    case 'dot': return (column?.duration.dots ?? 0) > 0;
    case 'triplet': return !!column?.duration.triplet;
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
    default: return false;
  }
}
