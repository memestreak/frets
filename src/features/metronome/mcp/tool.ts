/**
 * `show_metronome`, the MCP App's one tool (#269, `docs/specs/2026-10-31-metronome-mcp-app-design.md`):
 * its input, how the input becomes a rhythm, and the line of text that says what the rhythm is.
 * Pure, and shared by the server (which checks the input) and the app (which shows it at once).
 *
 * Claude can't change a metronome that's already showing, so each call shows a new one. To keep the
 * user's own changes, the model passes back the whole rhythm the app last reported, as `rhythm`,
 * with the fields it wants to change.
 */
import { z } from 'zod';
import {
  MAX_BEATS, MAX_BPM, MAX_STEPS, MAX_SWING, MIN_BPM, MIN_SWING, clampBpm, defaultRhythm, parseGroups, withAllSubs,
  withBeats, withGroups, withSwing, type Rhythm,
} from '../rhythm';
import { parseRhythm } from '../storage';

export const TOOL_NAME = 'show_metronome';
export const APP_URI = 'ui://metronome/app.html';

export const TOOL_DESCRIPTION = [
  'Show the Frets metronome in the chat with a rhythm loaded. It opens stopped; the user presses Start.',
  'A time signature is just its beats: 7/8 is beats 7, often grouped 2+2+3; 6/8 is beats 6 grouped 3+3.',
  'The metronome reports the user\'s changes (tap tempo, edits) as its latest rhythm. To change the tempo',
  'or anything else, call this tool again with that rhythm as `rhythm` and only the fields to change;',
  'a new metronome appears, and the old one keeps going until the user stops it.',
].join(' ');

export const toolInput = {
  rhythm: z.record(z.string(), z.unknown()).optional()
    .describe('The whole rhythm the metronome last reported, to start from. Leave out for a new one.'),
  bpm: z.number().int().min(MIN_BPM).max(MAX_BPM).optional().describe(`Tempo, ${MIN_BPM}–${MAX_BPM} bpm.`),
  beats: z.number().int().min(1).max(MAX_BEATS).optional().describe(`Beats in the bar, 1–${MAX_BEATS}.`),
  groups: z.string().regex(/^\s*\d+(\s*\+\s*\d+)+\s*$/).optional()
    .describe('How the beats group, such as "2+2+3". Must add up to beats; sets beats when beats is left out.'),
  subdivision: z.number().int().min(1).max(MAX_STEPS).optional()
    .describe(`Clicks per beat, every beat alike, 1–${MAX_STEPS}: 2 eighths, 3 triplets, 4 sixteenths.`),
  swing: z.number().int().min(MIN_SWING).max(MAX_SWING).optional()
    .describe(`${MIN_SWING} is straight, 67 a triplet shuffle, up to ${MAX_SWING}. Splits plain beats in two.`),
};

export type ToolInput = z.infer<z.ZodObject<typeof toolInput>>;

/** What the tool returns, and what the app reports back. */
export interface MetronomeState {
  rhythm: Rhythm;
}

/**
 * The rhythm a call asks for, or why it can't be. The fields apply in order on top of `rhythm` (or
 * the default): beats, groups, subdivision, swing, tempo. Every rhythm goes through `parseRhythm`,
 * the page's own check of a saved rhythm.
 */
export function rhythmFromInput(input: ToolInput): { ok: true; state: MetronomeState } | { ok: false; error: string } {
  let r = input.rhythm ? parseRhythm(input.rhythm) : defaultRhythm();
  if (input.beats !== undefined) r = withBeats(r, input.beats);
  if (input.groups !== undefined) {
    const groups = parseGroups(input.groups);
    const sum = groups.reduce((x, y) => x + y, 0);
    if (groups.length === 0) return { ok: false, error: `Groups "${input.groups}" need at least two parts, ${MAX_BEATS} beats at most.` };
    if (input.beats !== undefined && sum !== input.beats) {
      return { ok: false, error: `Groups ${groups.join('+')} add up to ${sum}, not ${input.beats} beats.` };
    }
    r = withGroups(r, groups);
  }
  if (input.subdivision !== undefined) r = withAllSubs(r, input.subdivision);
  if (input.swing !== undefined) r = withSwing(r, input.swing);
  if (input.bpm !== undefined) r = { ...r, bpm: clampBpm(input.bpm) };
  return { ok: true, state: { rhythm: parseRhythm(r) } };
}

/** One line for the model: "92 bpm, 7 beats grouped 2+2+3, 2 clicks a beat, swing 60". */
export function describeRhythm(r: Rhythm): string {
  const parts = [`${r.bpm} bpm`, `${r.beats} beat${r.beats === 1 ? '' : 's'}`];
  if (r.groups.length > 0) parts[1] += ` grouped ${r.groups.join('+')}`;
  const same = r.subs.every(n => n === r.subs[0]);
  parts.push(same ? `${r.subs[0]} click${r.subs[0] === 1 ? '' : 's'} a beat` : `clicks per beat ${r.subs.join(' ')}`);
  if (r.swing > MIN_SWING) parts.push(`swing ${r.swing}`);
  if (r.poly.on) parts.push(`polyrhythm ${r.poly.count} across the bar`);
  return parts.join(', ');
}
