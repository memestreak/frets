/**
 * `show_tab`, the Tab page's tool on Frets' MCP server (#340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`):
 * its name, what the model is told, and its input. The input is the clip model (`clip.ts`) as JSON,
 * under its own field names, with one change: a Column's notes are a list of the notes that sound,
 * each on a `string` numbered as guitarists number them, or at a `pitch` Frets places. The whole schema
 * is in the definition (Q16), so keep its descriptions short: every chat with the connector pays for them.
 */
import { z } from 'zod';
import { MAX_BPM, MAX_CAPO, MIN_BPM } from '../clip';
import { MAX_FRET } from '../editing';

export const TOOL_NAME = 'show_tab';
export const APP_URI = 'ui://tab/app.html';

export const TOOL_DESCRIPTION = [
  'Show a line of guitar music in the chat as standard notation over tab, with Play, Loop (whose ends the user can drag), a bpm field and Open in Frets.',
  'Use it for a riff, a phrase or an exercise you write note by note. Standard tuning.',
  'Each bar must add up to its time signature. A failed check says which bar and column to fix.',
].join(' ');

const note = z.object({
  string: z.number().int().min(1).max(6).optional().describe('1 the high e to 6 the low E. With fret, instead of pitch.'),
  fret: z.number().int().min(0).max(MAX_FRET).nullable().optional().describe('0–24, or null for a muted note (x).'),
  pitch: z.string().optional().describe('Instead of string and fret: a sounding note such as "E4" or "F#3"; Frets picks where to play it.'),
  legato: z.enum(['h', 'p']).optional().describe('Hammer-on or pull-off from the previous note on its string.'),
  slide: z.enum(['legato', 'shift', 'below', 'above']).optional()
    .describe('Slid into: legato or shift from the previous note on its string, below or above from no fret.'),
  bend: z.object({
    quarters: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6), z.literal(8)])
      .describe('Height in quarter steps: 2 half, 4 full, 8 two.'),
    pre: z.boolean().optional().describe('Bent before it is picked.'),
    release: z.boolean().optional().describe('Let back down afterwards.'),
  }).optional(),
  vibrato: z.enum(['slight', 'wide']).optional(),
  tie: z.boolean().optional().describe('Held on from the previous note on its string, same fret; not picked again.'),
});

const column = z.object({
  duration: z.object({
    value: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)])
      .describe('1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 32 thirty-second.'),
    dots: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    tuplet: z.literal(3).optional().describe('3 for a triplet, three in the time of two.'),
  }),
  notes: z.array(note).describe('The notes that sound together; empty for a rest.'),
  chord: z.string().optional().describe('A chord name over the column, such as "Am7".'),
});

/** One end of the loop: a bar, and a column in it, counted from 1. */
const loopEnd = z.object({
  bar: z.number().int().min(1),
  column: z.number().int().min(1).optional(),
});

export const toolInput = {
  bpm: z.number().int().min(MIN_BPM).max(MAX_BPM).optional().describe('Tempo in bpm; 120 when left out.'),
  time: z.tuple([z.number().int(), z.number().int()]).optional().describe('Time signature as [beats, note value]: [4, 4] (the default), [3, 4], [6, 8].'),
  capo: z.number().int().min(1).max(MAX_CAPO).optional().describe('Capo fret; frets count from it.'),
  view: z.enum(['both', 'staff', 'tab']).optional().describe('What to draw: both (the default), staff only or tab only.'),
  loop: z.object({
    start: loopEnd.optional().describe('Where the loop starts; the bar\'s first column when column is left out, the line\'s start when left out.'),
    end: loopEnd.optional().describe('Where it ends, included; the bar\'s last column when column is left out, the line\'s end when left out.'),
  }).optional().describe('Loop points, set but not played: Play is the user\'s. {} loops the whole line.'),
  bars: z.array(z.object({ columns: z.array(column) })).min(1),
};

export const inputSchema = z.object(toolInput);
export type LineInput = z.infer<typeof inputSchema>;
export type NoteInput = z.infer<typeof note>;
export type ColumnInput = z.infer<typeof column>;
export type View = NonNullable<LineInput['view']>;
export type LoopInput = NonNullable<LineInput['loop']>;
export type LoopEnd = z.infer<typeof loopEnd>;
