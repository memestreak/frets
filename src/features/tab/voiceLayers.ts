/**
 * Every Voice drawn (`docs/specs/2026-11-04-tab-voices-drawn-edited-design.md`, step 9): the layout
 * places the other Voices beside the part's own on one time line (`PlacedBar.voices`); here each is
 * made into a layout and a part of its own, so the drawing draws it as it draws the part's Voice, and
 * the part's own Voice is hidden from the bars it is absent from.
 */
import { hasNotes, voiceColumns, type Part } from './clip';
import { isWholeBarRest, type Layout, type PlacedBar } from './layout';

const drawnCache = new WeakMap<Layout, Layout>();

/** The layout as drawn: a bar the part's own Voice is absent from draws none of its stand-in rests. */
export function drawnLayout(layout: Layout): Layout {
  if (!layout.systems.some(s => s.bars.some(b => b.hidden))) return layout;
  const cached = drawnCache.get(layout);
  if (cached) return cached;
  const drawn: Layout = {
    ...layout,
    systems: layout.systems.map(system => ({
      ...system,
      bars: system.bars.map(bar => (bar.hidden ? { ...bar, columns: [], bar: { ...bar.bar, columns: [] }, wholeRest: false } : bar)),
    })),
  };
  drawnCache.set(layout, drawn);
  return drawn;
}

/** The Voices other than the part's own that the layout carries anywhere, in order. */
export function otherVoices(layout: Layout): number[] {
  const voices = new Set<number>();
  for (const system of layout.systems) for (const bar of system.bars) for (const v of bar.voices ?? []) voices.add(v.voice);
  return [...voices].sort((a, b) => a - b);
}

/** Voice `voice` of the part, as its own part: its Columns where present, none where absent, nothing carried. */
export function voicePart(clip: Part, voice: number): Part {
  const bars = clip.bars.map((bar, b) => {
    const present = bar.otherVoices?.some(o => o.voice === voice) ?? false;
    const own = { ...bar, columns: present ? voiceColumns(clip, b, voice) : [] };
    delete own.otherVoices;
    return own;
  });
  const part: Part = { ...clip, bars };
  delete part.alongside;
  if (voice > 0) part.voice = voice;
  else delete part.voice;
  return part;
}

const voiceCache = new WeakMap<Layout, Map<number, Layout>>();

/**
 * Voice `voice`'s layout: the same lines, bars and rows, each bar holding that Voice's placed columns,
 * or none where it is absent. Bar lines, words over bars and multi-bar rests are the part's own layout's.
 */
export function voiceLayout(layout: Layout, part: Part, voice: number): Layout {
  const forLayout = voiceCache.get(layout) ?? new Map<number, Layout>();
  voiceCache.set(layout, forLayout);
  const cached = forLayout.get(voice);
  if (cached) return cached;
  const own = voicePart(part, voice);
  const made: Layout = {
    ...layout,
    systems: layout.systems.map(system => ({
      ...system,
      bars: system.bars.map((bar): PlacedBar => {
        const placed = bar.voices?.find(v => v.voice === voice)?.columns ?? [];
        const columns = placed.map(p => p.column);
        return {
          ...bar, columns: placed, bar: { ...own.bars[bar.index], columns }, voices: undefined, hidden: false, restRun: null,
          wholeRest: placed.length > 0 && !hasNotes(columns) && isWholeBarRest(own, bar.index),
        };
      }),
    })),
  };
  forLayout.set(voice, made);
  return made;
}
