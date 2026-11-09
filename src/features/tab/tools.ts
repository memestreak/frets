/**
 * The palette's tools: what each one is called, its key, what it does to
 * the clip and whether the cursor's column or note already has it. The
 * palette (`TabPalette.tsx`) and the keyboard both go through this table,
 * so a tip always names the key that does the same thing. Pure; no React.
 */
import { isRest, type BendQuarters, type Part, type Duration, type NoteValue, type Ottava, type TremoloValue } from './clip';
import { whammyShape, type WhammyShape } from './whammy';
import { columnAt, indexOf, noteAt, placeOf, setDead, type Target } from './editing';
import { chainDuration, chainPlaces, lengthAnchor, tieForward } from './ties';
import { cycleEnding, cycleRepeatEnd, toggleDoubleBar, toggleRepeatStart } from './barEdits';
import { cycleBend, cycleBendShape, cycleDots, cycleMark, cycleSlide, cycleTremolo, cycleWah, setBeam, setMark, setSlide, setTremolo, setValue, toggleBendPart, toggleLegato, toggleStroke, type MarkKind } from './noteEdits';

export type ToolId =
  | 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtySecond' | 'sixtyFourth' | 'dot' | 'rest'
  | 'tuplet' | 'grace' | 'tremolo8' | 'tremolo16' | 'tremolo32' | 'beamBreak' | 'beamJoin' | 'tie'
  | 'legato' | 'slide' | 'shiftSlide' | 'slideBelow' | 'slideAbove' | 'slideOutDown' | 'slideOutUp'
  | 'bend' | 'release' | 'preBend'
  | 'vibrato' | 'mordent' | 'lowerMordent' | 'palmMute' | 'letRing' | 'dead' | 'ghost' | 'harmonic' | 'pinchHarmonic' | 'tap'
  | 'strokeDown' | 'strokeUp' | 'wah' | 'whammy' | 'accent' | 'heavyAccent' | 'staccato' | 'ottava' | 'dynamic'
  | 'insertBarBefore' | 'insertBar' | 'barTime' | 'barKey' | 'repeatStart' | 'repeatEnd' | 'doubleBar' | 'ending'
  | 'chordName' | 'beatText' | 'section' | 'tempo' | 'capo';

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
      { id: 'whole', label: 'Whole note', key: '7, or Shift+7 on a tab note; = − or W Q to step' },
      { id: 'half', label: 'Half note', key: '6, or Shift+6 on a tab note; = − or W Q to step' },
      { id: 'quarter', label: 'Quarter note', key: '5, or Shift+5 on a tab note; = − or W Q to step' },
      { id: 'eighth', label: 'Eighth note', key: '4, or Shift+4 on a tab note; = − or W Q to step' },
      { id: 'sixteenth', label: 'Sixteenth note', key: '3, or Shift+3 on a tab note; = − or W Q to step' },
      { id: 'thirtySecond', label: 'Thirty-second note', key: '2, or Shift+2 on a tab note; = − or W Q to step' },
      { id: 'sixtyFourth', label: 'Sixty-fourth note', key: '1, or Shift+1 on a tab note; = − or W Q to step' },
      { id: 'dot', label: 'Dotted, then double dotted', key: '.' },
      { id: 'rest', label: 'Rest', key: ',' },
    ],
  },
  {
    label: 'Rhythm',
    tools: [
      { id: 'tuplet', label: 'Tuplet', key: ';' },
      { id: 'grace', label: 'Grace note, just before the beat', key: '/' },
      { id: 'tremolo8', label: 'Tremolo picking in eighths', key: 'Shift+T' },
      { id: 'tremolo16', label: 'Tremolo picking in sixteenths', key: 'Shift+T' },
      { id: 'tremolo32', label: 'Tremolo picking in thirty-seconds', key: 'Shift+T' },
      { id: 'beamBreak', label: 'Break the beam before this note', key: '' },
      { id: 'beamJoin', label: 'Join the beam to the note before', key: '' },
    ],
  },
  {
    label: 'Joins',
    tools: [
      { id: 'tie', label: 'Tie to the next note', key: 'T' },
      { id: 'legato', label: 'Hammer-on or pull-off from the note before', key: 'H' },
      { id: 'slide', label: 'Slide from the note before', key: 'Alt+/' },
      { id: 'shiftSlide', label: 'Shift slide from the note before', key: 'Alt+/' },
      { id: 'slideBelow', label: 'Slide in from below', key: 'Alt+/' },
      { id: 'slideAbove', label: 'Slide in from above', key: 'Alt+/' },
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
      { id: 'mordent', label: 'Mordent: the note, the one above it, and back', key: '' },
      { id: 'lowerMordent', label: 'Lower mordent: the note, the one below it, and back', key: '' },
      { id: 'palmMute', label: 'Palm mute', key: 'M' },
      { id: 'letRing', label: 'Let ring', key: 'I' },
      { id: 'dead', label: 'Dead note', key: 'X' },
      { id: 'ghost', label: 'Ghost note', key: 'G' },
      { id: 'harmonic', label: 'Natural harmonic', key: 'Shift+N' },
      { id: 'pinchHarmonic', label: 'Pinch harmonic', key: 'Shift+N' },
      { id: 'tap', label: 'Tap', key: 'Alt+T' },
      { id: 'strokeDown', label: 'Down stroke', key: 'D' },
      { id: 'strokeUp', label: 'Up stroke', key: 'U' },
      { id: 'wah', label: 'Wah: closed (+), open (o), then off', key: '' },
      { id: 'whammy', label: 'Whammy bar', key: '' },
    ],
  },
  {
    label: 'Accents',
    tools: [
      { id: 'accent', label: 'Accent', key: 'A' },
      { id: 'heavyAccent', label: 'Heavy accent', key: 'A' },
      { id: 'staccato', label: 'Staccato', key: 'S' },
      { id: 'ottava', label: 'Octave line over the staff (8va, 8vb, 15ma, 15mb)', key: '' },
      { id: 'dynamic', label: 'Dynamic from this column on (p, mf, ff…)', key: 'Shift+D' },
    ],
  },
  {
    label: 'Bars',
    tools: [
      { id: 'insertBarBefore', label: 'Insert a bar of rests before this bar', key: 'Ctrl+Shift+Enter' },
      { id: 'insertBar', label: 'Insert a bar of rests after this bar', key: 'Ctrl+Enter' },
      { id: 'barTime', label: 'Time signature from this bar', key: '' },
      { id: 'barKey', label: 'Key signature from this bar', key: '' },
      { id: 'repeatStart', label: 'Repeat starts at this bar', key: '[' },
      { id: 'repeatEnd', label: 'Repeat ends at this bar (again: ×3, ×4)', key: ']' },
      { id: 'doubleBar', label: 'Double bar line at the end of this bar', key: '' },
      { id: 'ending', label: 'Ending 1., then 2.', key: 'E' },
    ],
  },
  {
    label: 'Text',
    tools: [
      { id: 'chordName', label: 'Chord name over this column', key: 'C' },
      { id: 'beatText', label: 'Text over this column', key: '' },
      { id: 'section', label: 'Section starting at this bar', key: '' },
      { id: 'tempo', label: 'Tempo from this bar on', key: '' },
      { id: 'capo', label: 'Capo', key: '' },
    ],
  },
];

const VALUE: Partial<Record<ToolId, NoteValue>> = {
  whole: 1, half: 2, quarter: 4, eighth: 8, sixteenth: 16, thirtySecond: 32, sixtyFourth: 64,
};
/** The note value a Duration button sets, or undefined for any other tool. */
export function toolValue(id: ToolId): NoteValue | undefined {
  return VALUE[id];
}

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
  mordent: ['mordent', 'upper'], lowerMordent: ['mordent', 'lower'],
};

/**
 * Marks drawn once over a column (the P.M. and let ring lines, accents, staccato) apply to every note
 * in the column, wherever the cursor is in it: a mark half the column had would look all on.
 */
const COLUMN_MARKS = new Set<MarkKind[0]>(['palmMute', 'letRing', 'accent', 'staccato', 'mordent']);
/** Column marks that last the note: on a Tie chain they go over its whole time. */
const HELD_MARKS = new Set<MarkKind[0]>(['palmMute', 'letRing']);

/** The target as whole columns: the selection, else the cursor's column. */
function wholeColumns(clip: Part, target: Target): Target {
  if (target.selection || !columnAt(clip, target.cursor)) return target;
  const i = indexOf(clip, target.cursor.bar, target.cursor.column);
  return { ...target, selection: { anchor: i, focus: i } };
}

/**
 * The target over a Tie chain's whole time, for marks drawn over Columns (tremolo picking, palm mute,
 * let ring; spec Q5): the Columns of the cursor note's chain, from whichever of its notes; with no string
 * picked, from the Column to the end of the longest chain starting there. One Tied note picked alone
 * keeps its own Column.
 */
function chainColumns(clip: Part, target: Target): Target {
  const { cursor, selection, alone } = target;
  if (alone || (selection && selection.anchor !== selection.focus)) return target;
  const place = selection ? placeOf(clip, selection.anchor) : cursor;
  const column = columnAt(clip, { ...cursor, ...place });
  if (!column) return target;
  const strings = column.notes[cursor.string] ? [cursor.string] : column.notes.flatMap((n, s) => (n && !n.tie ? [s] : []));
  let from = indexOf(clip, place.bar, place.column);
  let to = from;
  for (const string of strings) {
    const places = chainPlaces(clip, { ...cursor, ...place, string });
    const first = places[0];
    const last = places[places.length - 1];
    from = Math.min(from, indexOf(clip, first.bar, first.column));
    to = Math.max(to, indexOf(clip, last.bar, last.column));
  }
  return from === to ? target : { ...target, selection: { anchor: from, focus: to } };
}

/** Tools that open a field over the tab for words (`TabPage` handles them); they don't change the clip themselves. */
export const WORD_TOOLS = { chordName: 'chord', beatText: 'text', section: 'section', tempo: 'tempo', capo: 'capo', dynamic: 'dynamic' } as const;
export type WordKind = (typeof WORD_TOOLS)[keyof typeof WORD_TOOLS];

/** The palette tool that sets each kind of word: `WORD_TOOLS` the other way round. */
export const WORD_TOOL: Record<WordKind, keyof typeof WORD_TOOLS> = {
  chord: 'chordName', text: 'beatText', section: 'section', tempo: 'tempo', capo: 'capo', dynamic: 'dynamic',
};

/** The clip after a palette press. */
export function applyTool(clip: Part, target: Target, id: ToolId): Part {
  const value = VALUE[id];
  if (value) return setValue(clip, target, value);
  const tremolo = TREMOLO[id];
  if (tremolo) return setTremolo(clip, chainColumns(clip, target), tremolo);
  const mark = MARK[id];
  if (mark && HELD_MARKS.has(mark[0])) return setMark(clip, chainColumns(clip, wholeColumns(clip, target)), mark);
  if (mark) return setMark(clip, COLUMN_MARKS.has(mark[0]) ? wholeColumns(clip, target) : target, mark);
  switch (id) {
    case 'dot': return cycleDots(clip, target);
    case 'vibrato': return cycleMark(clip, target, 'vibrato', VIBRATOS);
    case 'tie': return tieForward(clip, target);
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
    case 'wah': return cycleWah(clip, target);
    case 'repeatStart': return toggleRepeatStart(clip, target.cursor);
    case 'repeatEnd': return cycleRepeatEnd(clip, target.cursor);
    case 'doubleBar': return toggleDoubleBar(clip, target.cursor);
    case 'ending': return cycleEnding(clip, target.cursor);
    case 'beamBreak': return setBeam(clip, target, 'break');
    case 'beamJoin': return setBeam(clip, target, 'join');
    default: return clip;
  }
}

/**
 * The clip after a key press that steps through a tool's choices (b, Shift+B, Alt+/, \\, V, N, A, Shift+T), or null
 * when the key isn't one of them; those keys cycle rather than set one choice as the palette's buttons do. Alt+/
 * comes as `/`: the editor reads it by the key's place, as Alt types another character on a Mac.
 */
export function applyCyclingKey(clip: Part, target: Target, key: string): Part | null {
  const { cursor } = target;
  if (key === 'b') return cycleBend(clip, target);
  if (key === 'B') return cycleBendShape(clip, cursor);
  if (key === '/') return cycleSlide(clip, cursor);
  if (key === '\\') return cycleMark(clip, target, 'slideOut', ['down', 'up']);
  if (key === 'v') return cycleMark(clip, target, 'vibrato', VIBRATOS);
  if (key === 'N') return cycleMark(clip, target, 'harmonic', ['natural', 'pinch', 'artificial']);
  if (key === 'a') return cycleMark(clip, wholeColumns(clip, target), 'accent', ['normal', 'heavy']);
  if (key === 'T') return cycleTremolo(clip, chainColumns(clip, target));
  return null;
}

/** The last written note of the cursor's Tie chain. */
function chainEnd(clip: Part, cursor: Target['cursor']) {
  const places = chainPlaces(clip, cursor);
  const last = places[places.length - 1];
  return last ? noteAt(clip, { ...last, string: cursor.string }) : null;
}

/** The tool a key press does, for the keys that do exactly what one button does. */
export function toolForKey(key: string, alt: boolean, code = ''): ToolId | null {
  // T ties, as Dorico's T does, so Tap is Alt+T (by its code: Alt types another letter on a Mac).
  if (alt) return code === 'KeyT' ? 'tap' : null;
  const keys: Record<string, ToolId> = {
    '.': 'dot', ',': 'rest', '/': 'grace', t: 'tie', h: 'legato', p: 'legato', m: 'palmMute', i: 'letRing',
    x: 'dead', g: 'ghost', d: 'strokeDown', u: 'strokeUp', s: 'staccato',
    '[': 'repeatStart', ']': 'repeatEnd', e: 'ending', c: 'chordName',
    // Shift+D opens the dynamic's field, as Dorico's Shift+D opens its dynamics popover.
    D: 'dynamic',
  };
  return keys[key] ?? null;
}

/** Whether the cursor's column, note or bar has what a tool sets, to show its button pressed. */
export function isOn(clip: Part, cursor: Target['cursor'], id: ToolId, columnOnly = false): boolean {
  // With no string picked, a note's mark is on when every note in the column has it.
  if (columnOnly) {
    const strings = columnAt(clip, cursor)?.notes.flatMap((n, s) => (n ? [s] : [])) ?? [];
    if (strings.length > 0) return strings.every(string => isOn(clip, { ...cursor, string }, id));
  }
  const column = columnAt(clip, cursor);
  const note = noteAt(clip, cursor);
  const bar = clip.bars[cursor.bar];
  const value = VALUE[id];
  // A rest is a Gap: its length can't be set, so no Duration lights for it (rests are Gaps, step 3).
  const rest = !!column && !column.grace && isRest(column);
  // A Tie chain lights its whole length when that is one written value (`q~e` a dotted quarter), else nothing (step 5).
  const anchor = column?.grace ? null : lengthAnchor(clip, cursor);
  const length = column?.grace ? column.duration : anchor ? chainDuration(clip, anchor) : null;
  // A grace note's value is written by its count, so no Duration lights for one either (step 6, Q9).
  if (value) return !rest && !column?.grace && length?.value === value;
  const tremolo = TREMOLO[id];
  if (tremolo) return column?.tremolo === tremolo;
  const mark = MARK[id];
  if (mark && COLUMN_MARKS.has(mark[0])) {
    const notes = column?.notes.filter(n => n !== null) ?? [];
    return notes.length > 0 && notes.every(n => n[mark[0]] === mark[1]);
  }
  // A slide out goes on a Tie chain's last note.
  if (mark?.[0] === 'slideOut') return chainEnd(clip, cursor)?.slideOut === mark[1];
  if (mark) return note?.[mark[0]] === mark[1];
  switch (id) {
    case 'dot': return !rest && !column?.grace && (length?.dots ?? 0) > 0;
    case 'tuplet': return !!column?.duration.tuplet;
    case 'bend': return !!note?.bend;
    case 'vibrato': return !!note?.vibrato;
    case 'grace': return !!column?.grace;
    // A rest can't be set, so the Rest tool never lights (step 6, Q13).
    case 'rest': return false;
    // A tie lights only when its arc is picked (`markLights`): `=` on a note always ties on.
    case 'tie': return false;
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
    case 'wah': return !!column?.wah;
    case 'whammy': return !!column?.whammy;
    case 'repeatStart': return !!bar?.repeatStart;
    case 'repeatEnd': return !!bar?.repeatEnd;
    case 'doubleBar': return !!bar?.doubleBar;
    case 'ending': return !!bar?.ending;
    case 'chordName': return !!column?.chord;
    case 'beatText': return !!column?.text;
    case 'dynamic': return !!column?.dynamic;
    case 'section': return !!bar?.section;
    case 'tempo': return !!bar?.tempo;
    case 'capo': return !!clip.capo;
    default: return false;
  }
}

/** What the cursor has of the things whose buttons draw it (the Bend, Vibrato and Tuplet icons); none off the tab. */
export function noteKinds(clip: Part, cursor: Target['cursor'] | null): {
  bend: BendQuarters | null;
  vibrato: 'slight' | 'wide' | null;
  /** The cursor column's duration while it is in a tuplet. */
  tuplet: Duration | null;
  ottava: Ottava | null;
  wah: 'open' | 'closed' | null;
  /** The cursor column's whammy bar, when it has one: its palette shape, or 'other'. */
  whammy: WhammyShape | 'other' | null;
} {
  const note = cursor ? noteAt(clip, cursor) : null;
  const duration = cursor ? columnAt(clip, cursor)?.duration : undefined;
  const column = cursor ? columnAt(clip, cursor) : undefined;
  return {
    bend: note?.bend?.quarters ?? null, vibrato: note?.vibrato ?? null, tuplet: duration?.tuplet ? duration : null,
    ottava: column?.ottava ?? null, wah: column?.wah ?? null,
    whammy: column?.whammy ? whammyShape(column.whammy) ?? 'other' : null,
  };
}
