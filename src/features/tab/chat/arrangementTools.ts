/**
 * What a model in the Chat panel can do to the open arrangement (`docs/specs/2026-11-08-tab-chat-design.md`):
 * read it as alphaTex with numbered bars, and replace a run of one track's bars or the whole of it.
 * Every change is read back by the same alphaTex reader as the AlphaTex view; text it can't read
 * changes nothing, and its errors go back to the model to fix.
 */
import { alphaTexTracks, writeAlphaTex } from '../alphatex';
import { barErrors, partOf, type Clip } from '../clip';
import type { ReadResult } from '../ascii';

/** Where the viewer is on the page, for the model to know what "here" and "these bars" mean. */
export interface PageSpot {
  /** The track shown, from 0. */
  track: number;
  /** The bar the cursor is in, from 0. */
  cursorBar: number;
  /** The first and last selected bar, from 0, or null with nothing selected. */
  selectedBars: readonly [number, number] | null;
}

/** A tool as OpenAI-style chat completions declare it. */
export interface ToolDef {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'read_arrangement',
      description:
        'Read the arrangement open on the Tab page as alphaTex. Each bar is on its own line ending in a comment giving its track and bar number, '
        + 'as "// track 1, bar 3". Also says which track is shown, which bar the cursor is in and which bars are selected, '
        + 'and lists the problems Frets marks on it (bars that don\'t add up, tuplets that don\'t fit, marks it keeps but doesn\'t draw). '
        + 'Each message from the viewer comes with the arrangement as it was then; read it again after a change to see the result.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_bars',
      description:
        'Replace bars first_bar to last_bar (inclusive, counted from 1) of one track with new alphaTex bars, each ending in "|". '
        + 'You may give more or fewer bars than you replace; an empty alphatex deletes them. To insert bars before bar N without '
        + 'replacing any, give first_bar N and last_bar N-1. Marks every track shares (time and key signatures, tempo, sections, '
        + 'repeats) are written in track 1\'s bars only. The change is checked; if it is not valid alphaTex, nothing changes and you get the errors.',
      parameters: {
        type: 'object',
        properties: {
          track: { type: 'integer', minimum: 1, description: 'The track, counted from 1.' },
          first_bar: { type: 'integer', minimum: 1 },
          last_bar: { type: 'integer', minimum: 0 },
          alphatex: { type: 'string', description: 'The new bars, without any header lines.' },
        },
        required: ['track', 'first_bar', 'last_bar', 'alphatex'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_arrangement',
      description:
        'Replace the whole arrangement with new alphaTex, header lines included. Use it for changes that are not a run of bars: '
        + 'the title, the tuning, adding or removing tracks. The change is checked; if it is not valid alphaTex, nothing changes and you get the errors.',
      parameters: {
        type: 'object',
        properties: { alphatex: { type: 'string' } },
        required: ['alphatex'],
        additionalProperties: false,
      },
    },
  },
];

/** The clip as `read_arrangement` answers: alphaTex with each bar on a numbered line, where the viewer is, then its problems. */
export function describeArrangement(clip: Clip, spot: PageSpot, problems: readonly string[] = []): string {
  const tracks = alphaTexTracks(clip);
  const lines = tracks.flatMap((track, t) => [
    ...track.head,
    ...track.bars.map((tokens, b) => `${tokens.join(' ')} // track ${t + 1}, bar ${b + 1}`),
  ]);
  const where = [
    `Tracks: ${tracks.length}. Shown: track ${spot.track + 1}.`,
    `The cursor is in bar ${spot.cursorBar + 1}.`,
    spot.selectedBars
      ? `Selected: bars ${spot.selectedBars[0] + 1} to ${spot.selectedBars[1] + 1} of track ${spot.track + 1}.`
      : 'Nothing is selected.',
  ];
  return `${lines.join('\n')}\n\n${where.join('\n')}\n\n${problemsText(problems)}`;
}

/** What `read_arrangement` answers for `clip` now: `describeArrangement` with its problems. */
export async function arrangementNow(clip: Clip, spot: PageSpot, read: ToolContext['read']): Promise<string> {
  return describeArrangement(clip, spot, await arrangementProblems(clip, read));
}

/** The problems list as the model reads it. */
function problemsText(problems: readonly string[]): string {
  return problems.length > 0 ? `Problems Frets marks:\n${problems.map(p => `- ${p}`).join('\n')}` : 'Frets marks no problems.';
}

/** The reader's warning for an uneven bar; the bar's own ⚠ (`barErrors`) says it already. */
const UNEVEN_WARNING = /doesn't add up to/;

/**
 * What Frets marks wrong in `clip`: each bar's red ⚠ (`barErrors`, by track and bar from 1, as `read_arrangement`
 * numbers them), then what the alphaTex reader says when it reads the clip back, as "Kept but not drawn yet: …".
 */
export async function arrangementProblems(clip: Clip, read: ToolContext['read']): Promise<string[]> {
  const result = await read(writeAlphaTex(clip));
  return problemsOf(clip, result.ok ? result.warnings : result.errors);
}

/** `clip`'s bar marks, then the reader's `warnings` but for the uneven bars the marks already name. */
function problemsOf(clip: Clip, warnings: readonly string[]): string[] {
  const marks = clip.tracks.flatMap((_, t) => [...barErrors(partOf(clip, t))].map(([b, text]) => `Track ${t + 1}, bar ${b + 1}: ${text}`));
  return [...marks, ...warnings.filter(w => !UNEVEN_WARNING.test(w))];
}

/** The text of the whole clip with bars `first` to `last` (from 1) of track `track` (from 1) replaced, or why not. */
export function spliceBars(clip: Clip, track: number, first: number, last: number, bars: string): { text: string } | { error: string } {
  const tracks = alphaTexTracks(clip);
  const t = track - 1;
  if (!Number.isInteger(track) || t < 0 || t >= tracks.length) return { error: `There is no track ${track}; the arrangement has ${tracks.length}.` };
  const count = tracks[t].bars.length;
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || first > count + 1 || last < first - 1 || last > count) {
    return { error: `Bars ${first} to ${last} aren't in track ${track}, which has ${count} bars (insert after the last with first_bar ${count + 1} and last_bar ${count}).` };
  }
  const lines = tracks.flatMap((each, i) => {
    const barLines = each.bars.map(tokens => tokens.join(' '));
    if (i === t) barLines.splice(first - 1, last - first + 1, ...(bars.trim() ? [bars.trim()] : []));
    return [...each.head, ...barLines];
  });
  return { text: `${lines.join('\n')}\n` };
}

/** What a tool call did: its answer for the model, the clip after it when it changed the clip, and a line for the viewer. */
export interface ToolOutcome {
  answer: string;
  clip?: Clip;
  /** What the panel shows under the reply, as "Changed bars 3 to 4 of track 1". */
  note: string;
  failed?: boolean;
}

/** Everything a tool needs from the page: the clip now, where the viewer is, and the alphaTex reader. */
export interface ToolContext {
  clip: Clip;
  spot: PageSpot;
  read: (text: string) => Promise<ReadResult>;
}

/** Runs one tool call; its arguments arrive as the model wrote them, as JSON text. */
export async function runTool(name: string, args: string, { clip, spot, read }: ToolContext): Promise<ToolOutcome> {
  let input: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(args || '{}');
    input = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { answer: 'Your arguments were not valid JSON; nothing changed.', note: `${name}: unreadable arguments`, failed: true };
  }
  if (name === 'read_arrangement') return { answer: await arrangementNow(clip, spot, read), note: 'Read the arrangement' };
  if (name === 'replace_bars') {
    const { track, first_bar: first, last_bar: last, alphatex } = input;
    if (typeof track !== 'number' || typeof first !== 'number' || typeof last !== 'number' || typeof alphatex !== 'string') {
      return { answer: 'replace_bars needs track, first_bar, last_bar (numbers) and alphatex (text); nothing changed.', note: 'Couldn\'t change bars', failed: true };
    }
    const spliced = spliceBars(clip, track, first, last, alphatex);
    if ('error' in spliced) return { answer: `${spliced.error} Nothing changed.`, note: 'Couldn\'t change bars', failed: true };
    const what = last < first ? `Inserted bars before bar ${first}` : first === last ? `Changed bar ${first}` : `Changed bars ${first} to ${last}`;
    return apply(spliced.text, `${what} of track ${track}`, clip, read);
  }
  if (name === 'replace_arrangement') {
    if (typeof input.alphatex !== 'string') return { answer: 'replace_arrangement needs alphatex (text); nothing changed.', note: 'Couldn\'t replace the arrangement', failed: true };
    return apply(input.alphatex, 'Replaced the whole arrangement', clip, read);
  }
  return { answer: `There is no tool called ${name}.`, note: `Unknown tool ${name}`, failed: true };
}

/** Reads `text` as the new clip; a text with no \title keeps the clip's title, as the AlphaTex view does (issue #281). */
async function apply(text: string, did: string, clip: Clip, read: ToolContext['read']): Promise<ToolOutcome> {
  const result = await read(text);
  if (!result.ok) {
    return {
      answer: `Not valid alphaTex, so nothing changed. Errors:\n${result.errors.map(e => `- ${e}`).join('\n')}`,
      note: `${did.replace(/^(Changed|Inserted|Replaced)/, m => `Tried: ${m.toLowerCase()}`)}, but the alphaTex had errors`,
      failed: true,
    };
  }
  const next = result.clip.name.trim() ? result.clip : { ...result.clip, name: clip.name };
  const bars = next.tracks.map((track, t) => `track ${t + 1}: ${track.bars.length} bars`).join(', ');
  return { answer: `Done. The arrangement now has ${bars}.\n${problemsText(problemsOf(next, result.warnings))}`, clip: next, note: did };
}
