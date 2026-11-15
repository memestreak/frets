/**
 * The technique popover's words (issue #501, `docs/specs/2026-11-15-tab-technique-popover-design.md`): Shift+P
 * opens a field where a mark on notes is typed by name ("let ring", "pm", "wide vib"), as Dorico's Shift+P
 * playing techniques popover takes them. Each word is one of the palette's tools (`tools.ts`), or for the
 * kinds the palette steps through (vibrato, then wide; a bend's amount) one kind of it, so the popover writes
 * only what the palette can. Pure; no React.
 */
import type { Note, Part } from './clip';
import { columnAt, noteAt, placeOf, selectedRange, type Target } from './editing';
import { setBend, setMark } from './noteEdits';
import { isOn, type ToolId } from './tools';

/** One thing the popover can add: what its list shows, the palette group it is in, and the words that name it. */
export interface Technique {
  /** Its name in the list, as the palette's tip says it, short. */
  name: string;
  /** The palette group it is drawn in, shown beside it in the list. */
  group: 'Rhythm' | 'Joins' | 'Bends' | 'Techniques' | 'Accents';
  /** What can be typed for it, besides its name: Dorico's and Guitar Pro 8's short forms. */
  words: readonly string[];
  /** What it does: a palette tool, pressed as its button is … */
  tool?: ToolId;
  /** … or one kind of a mark the palette steps through, and whether a note already has that kind. */
  edit?: (clip: Part, target: Target) => Part;
  has?: (note: Note) => boolean;
}

/** The popover's techniques, in the palette's order (Rhythm, Joins, Bends, Techniques, Accents). */
export const TECHNIQUES: readonly Technique[] = [
  { name: 'Tremolo picking in eighths', group: 'Rhythm', words: ['trem 8', 'tremolo 8'], tool: 'tremolo8' },
  { name: 'Tremolo picking in sixteenths', group: 'Rhythm', words: ['trem', 'trem 16', 'tremolo', 'tremolo 16', 'tremolo picking'], tool: 'tremolo16' },
  { name: 'Tremolo picking in thirty-seconds', group: 'Rhythm', words: ['trem 32', 'tremolo 32'], tool: 'tremolo32' },
  { name: 'Grace note', group: 'Rhythm', words: ['grace', 'gr'], tool: 'grace' },
  { name: 'Tie', group: 'Joins', words: ['tie'], tool: 'tie' },
  { name: 'Hammer-on or pull-off', group: 'Joins', words: ['ho', 'po', 'hp', 'hopo', 'hammer', 'hammer-on', 'pull', 'pull-off', 'legato'], tool: 'legato' },
  { name: 'Slide', group: 'Joins', words: ['sl', 'gliss', 'glissando'], tool: 'slide' },
  { name: 'Shift slide', group: 'Joins', words: ['ss'], tool: 'shiftSlide' },
  { name: 'Slide in from below', group: 'Joins', words: ['slide from below', 'scoop'], tool: 'slideBelow' },
  { name: 'Slide in from above', group: 'Joins', words: ['slide from above'], tool: 'slideAbove' },
  { name: 'Slide out downward', group: 'Joins', words: ['slide out', 'slide out down', 'fall'], tool: 'slideOutDown' },
  { name: 'Slide out upward', group: 'Joins', words: ['slide out up', 'doit'], tool: 'slideOutUp' },
  {
    name: 'Bend', group: 'Bends', words: ['full bend'],
    edit: (clip, target) => setBend(clip, target, 4), has: note => !!note.bend,
  },
  { name: 'Release the bend', group: 'Bends', words: ['release', 'rel', 'bend release'], tool: 'release' },
  { name: 'Pre-bend', group: 'Bends', words: ['prebend', 'pb'], tool: 'preBend' },
  {
    name: 'Vibrato', group: 'Techniques', words: ['vib', 'vibrato'],
    edit: (clip, target) => setMark(clip, target, ['vibrato', 'slight']), has: note => note.vibrato === 'slight',
  },
  {
    name: 'Wide vibrato', group: 'Techniques', words: ['wide vib', 'wv'],
    edit: (clip, target) => setMark(clip, target, ['vibrato', 'wide']), has: note => note.vibrato === 'wide',
  },
  { name: 'Mordent', group: 'Techniques', words: ['mor', 'upper mordent'], tool: 'mordent' },
  { name: 'Lower mordent', group: 'Techniques', words: ['lower mor', 'inverted mordent'], tool: 'lowerMordent' },
  { name: 'Palm mute', group: 'Techniques', words: ['pm', 'p.m.'], tool: 'palmMute' },
  { name: 'Let ring', group: 'Techniques', words: ['lr', 'lv', 'l.v.', 'laissez vibrer'], tool: 'letRing' },
  { name: 'Dead note', group: 'Techniques', words: ['dead', 'x', 'muted note'], tool: 'dead' },
  { name: 'Ghost note', group: 'Techniques', words: ['ghost'], tool: 'ghost' },
  { name: 'Natural harmonic', group: 'Techniques', words: ['harmonic', 'harm', 'nh', 'o'], tool: 'harmonic' },
  { name: 'Pinch harmonic', group: 'Techniques', words: ['pinch', 'ph'], tool: 'pinchHarmonic' },
  { name: 'Tap', group: 'Techniques', words: ['tapping', 'right-hand tap'], tool: 'tap' },
  { name: 'Down stroke', group: 'Techniques', words: ['downstroke', 'down pick'], tool: 'strokeDown' },
  { name: 'Up stroke', group: 'Techniques', words: ['upstroke', 'up pick'], tool: 'strokeUp' },
  { name: 'Strum down', group: 'Techniques', words: ['strum'], tool: 'strumDown' },
  { name: 'Strum up', group: 'Techniques', words: [], tool: 'strumUp' },
  { name: 'Rolled chord down', group: 'Techniques', words: ['arp', 'arpeggio', 'roll', 'rolled'], tool: 'rolledDown' },
  { name: 'Rolled chord up', group: 'Techniques', words: ['roll up'], tool: 'rolledUp' },
  { name: 'Wah', group: 'Techniques', words: ['wah closed'], tool: 'wah' },
  { name: 'Accent', group: 'Accents', words: ['acc', '>'], tool: 'accent' },
  { name: 'Heavy accent', group: 'Accents', words: ['marcato', '^'], tool: 'heavyAccent' },
  { name: 'Staccato', group: 'Accents', words: ['stacc', 'stac'], tool: 'staccato' },
];

/** What is typed, as words are matched: any case, dots and hyphens left out, one space between words. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[.-]/g, '').replace(/\s+/g, ' ').trim();
}

/** Every name a technique answers to, plain. */
function namesOf(t: Technique): string[] {
  return [t.name, ...t.words].map(plain);
}

/**
 * The techniques the list offers for what is typed: every one for nothing typed, else those with a name or a
 * word one of whose words starts with it ("ring" finds Let ring, "pm" Palm mute), in the palette's order. One
 * named exactly comes first, so Enter adds it.
 */
export function techniquesFor(typed: string): readonly Technique[] {
  const start = plain(typed);
  if (!start) return TECHNIQUES;
  const exact = TECHNIQUES.filter(t => namesOf(t).includes(start));
  const starting = TECHNIQUES.filter(t => !exact.includes(t) && namesOf(t).some(name => name.startsWith(start) || name.includes(` ${start}`)));
  return [...exact, ...starting];
}

/**
 * Whether every note the technique would go on has it already, so the popover leaves them (it only adds, spec Q6):
 * each column of the selection, else the cursor's note, or with no string picked every note of its column.
 */
export function techniqueOn(clip: Part, target: Target, technique: Technique, columnOnly: boolean): boolean {
  const { cursor, selection } = target;
  const [from, to] = selection ? selectedRange(selection) : [-1, -1];
  const places = selection ? Array.from({ length: to - from + 1 }, (_, i) => ({ ...cursor, ...placeOf(clip, from + i) })) : [cursor];
  const whole = columnOnly || (selection !== null && from !== to);
  return places.every(place => {
    if (technique.tool) return isOn(clip, place, technique.tool, whole);
    const notes = whole ? columnAt(clip, place)?.notes.filter(n => n !== null) ?? [] : [noteAt(clip, place)].filter(n => n !== null);
    return notes.length > 0 && notes.every(n => technique.has!(n));
  });
}
