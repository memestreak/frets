/**
 * The palettes' layout on the Tab page (`docs/specs/2026-11-09-tab-palettes-design.md`, issue #454;
 * `docs/specs/2026-11-15-tab-palette-sides-design.md`, issue #490): which are open, their order and side,
 * their heights, each side's width and whether it is collapsed, kept across visits in `frets.tab.layout`
 * (`parseLayout`, `usePalettes`), and moving a palette (`placeOn`). It draws nothing: `TabRail.tsx` does.
 */
import { useEffect, useState } from 'react';

export type PanelId = 'notes' | 'articulations' | 'bars' | 'chords' | 'chat';

/** The side of the clip a column of palettes is on. */
export type Side = 'left' | 'right';
export const SIDES: readonly Side[] = ['left', 'right'];

export const LAYOUT_KEY = 'frets.tab.layout';

/** A column's width in px: 17rem until its divider is dragged, and never narrower or wider than these. */
export const PANEL_WIDTH = { start: 272, min: 224, max: 560 } as const;
/** A collapsed column's strip, in px. */
const STRIP_WIDTH = 40;
/** A palette's least height, below its header, when dragged shorter: about one row of tools. */
export const PALETTE_MIN = 48;

/** What `frets.tab.layout` keeps. */
export interface PaletteLayout {
  /** The open palettes. */
  open: readonly PanelId[];
  /** Every palette, top to bottom; each side lists its own in this order. */
  order: readonly PanelId[];
  /** The palettes on the clip's right; every other one is on its left (issue #490). */
  right: readonly PanelId[];
  /** The heights dragged, in px, below each header; a palette not listed is as tall as its tools. */
  heights: Partial<Record<PanelId, number>>;
  /** Whether each side is collapsed to its strip. */
  collapsed: Record<Side, boolean>;
  /** Each side's width, in px, while expanded. */
  width: Record<Side, number>;
  /**
   * How far each side's open column may reach out past the clip's widest edge into the page's margin, in px
   * (issue #521); the rest of its width is taken from the clip. Set by dragging the column's outer edge.
   */
  reach: Record<Side, number>;
}

/** Every palette, in its first order: the tools', then Chords, then Chat. */
export const FIRST_ORDER: readonly PanelId[] = ['notes', 'articulations', 'bars', 'chords', 'chat'];

const isPanel = (id: unknown): id is PanelId => FIRST_ORDER.includes(id as PanelId);

/** `px` kept between `least` and `most` (`least` winning), in whole px. */
export const clampTo = (px: number, least: number, most: number) => Math.round(Math.min(Math.max(px, least), Math.max(least, most)));

/** A width kept within the column's limits, in whole px. */
const clampWidth = (px: number, max: number = PANEL_WIDTH.max) => clampTo(px, PANEL_WIDTH.min, max);

/** A first visit: Notes open, every palette in its first order, Chat on the right, both sides expanded. */
const FIRST_LAYOUT: PaletteLayout = {
  open: ['notes'], order: FIRST_ORDER, right: ['chat'], heights: {},
  collapsed: { left: false, right: false }, width: { left: PANEL_WIDTH.start, right: PANEL_WIDTH.start },
  reach: { left: PANEL_WIDTH.start, right: PANEL_WIDTH.start },
};

/** The side `id` is on. */
export const sideOf = (layout: Pick<PaletteLayout, 'right'>, id: PanelId): Side => (layout.right.includes(id) ? 'right' : 'left');

/** The palettes on `side`, top to bottom. */
export const paletteList = (layout: Pick<PaletteLayout, 'order' | 'right'>, side: Side) =>
  layout.order.filter(id => sideOf(layout, id) === side);

/** What `side` shows: an open column, its strip, or nothing when it has no palettes. */
export const sideState = (layout: PaletteLayout, side: Side): 'open' | 'strip' | undefined =>
  (!paletteList(layout, side).length ? undefined : layout.collapsed[side] ? 'strip' : 'open');

/** How wide `side`'s column is, in px: its width, its strip, or 0 when it has no palettes. */
export const sideRoom = (layout: PaletteLayout, side: Side) =>
  ({ open: layout.width[side], strip: STRIP_WIDTH, none: 0 })[sideState(layout, side) ?? 'none'];

/**
 * How far, in px, `side`'s column sits out past the clip's widest edge before the window's margin is counted
 * (CSS takes the least of this and `--rail-reach`): an open column's reach, but never more than its width; a
 * strip all of its width; nothing with no palettes.
 */
export const sideOut = (layout: PaletteLayout, side: Side) =>
  sideState(layout, side) === 'open' ? Math.min(layout.reach[side], layout.width[side]) : sideRoom(layout, side);

/** The page's margin beside the clip that a column may use, in px, up to 16px from the window's edge: as `--rail-reach`. */
export const marginRoom = () => (typeof window === 'undefined' ? 0 : Math.max(0, (window.innerWidth - 1240) / 2) + 4);

/** A side's own field of a kept `{ left, right }`, or undefined when it isn't of `type`. */
const sideField = (value: unknown, side: Side, type: 'boolean' | 'number') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[side];
  return typeof field === type && (type === 'boolean' || Number.isFinite(field)) ? field : undefined;
};

/** Reads `frets.tab.layout`; a field missing or unreadable is as on a first visit. */
export function parseLayout(text: string | null): PaletteLayout {
  const layout: PaletteLayout = {
    ...FIRST_LAYOUT, heights: {}, collapsed: { ...FIRST_LAYOUT.collapsed }, width: { ...FIRST_LAYOUT.width },
    reach: { ...FIRST_LAYOUT.reach },
  };
  let saved: unknown;
  try {
    saved = JSON.parse(text ?? 'null');
  } catch {
    return layout;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return layout;
  const s = saved as Record<string, unknown>;
  if (Array.isArray(s.open)) layout.open = FIRST_ORDER.filter(id => (s.open as unknown[]).includes(id));
  if (Array.isArray(s.order)) {
    // Each palette once; one missing goes at the end, so a new palette still shows.
    const known = (s.order as unknown[]).filter(isPanel).filter((id, i, all) => all.indexOf(id) === i);
    layout.order = [...known, ...FIRST_ORDER.filter(id => !known.includes(id))];
  }
  if (Array.isArray(s.right)) layout.right = FIRST_ORDER.filter(id => (s.right as unknown[]).includes(id));
  if (s.heights && typeof s.heights === 'object' && !Array.isArray(s.heights)) {
    for (const [id, px] of Object.entries(s.heights)) {
      if (isPanel(id) && typeof px === 'number' && Number.isFinite(px)) layout.heights[id] = Math.max(PALETTE_MIN, Math.round(px));
    }
  }
  for (const side of SIDES) {
    const collapsed = sideField(s.collapsed, side, 'boolean');
    if (collapsed !== undefined) layout.collapsed[side] = collapsed as boolean;
    const width = sideField(s.width, side, 'number');
    if (width !== undefined) layout.width[side] = clampWidth(width as number);
    // A missing reach is the column's width: all of it in the margin, as before issue #521.
    const reach = sideField(s.reach, side, 'number');
    layout.reach[side] = reach === undefined ? layout.width[side] : clampTo(reach as number, 0, PANEL_WIDTH.max);
  }
  return layout;
}

/** The page's hold on the palettes: their layout, and opening one from elsewhere (a chord's Edit opens Chords). */
export interface Palettes {
  layout: PaletteLayout;
  /** Changes the layout; kept across visits unless `keep` is false (a drag's moves, before it ends). */
  change: (change: Partial<PaletteLayout>, keep?: boolean) => void;
  /** Expands the side `id` is on, opens `id` and brings it into view. */
  show: (id: PanelId) => void;
  /** Whether `id` is open and its side expanded, so it can be seen. */
  shown: (id: PanelId) => boolean;
  /** A new value each time `show` asks for a palette, which its column then scrolls to. */
  ask: { id: PanelId } | null;
}

/** The palettes' layout, kept across visits; read after the first render, since the server has no storage. */
export function usePalettes(): Palettes {
  const [layout, setLayout] = useState<PaletteLayout>(FIRST_LAYOUT);
  const [ask, setAsk] = useState<{ id: PanelId } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the kept layout exists only in the browser.
  useEffect(() => setLayout(parseLayout(localStorage.getItem(LAYOUT_KEY))), []);
  const change = (part: Partial<PaletteLayout>, keep = true) => {
    setLayout(now => {
      const next = { ...now, ...part };
      if (keep) {
        try {
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
        } catch {
          // Not kept: it still applies now.
        }
      }
      return next;
    });
  };
  const show = (id: PanelId) => {
    change({
      collapsed: { ...layout.collapsed, [sideOf(layout, id)]: false },
      open: layout.open.includes(id) ? layout.open : [...layout.open, id],
    });
    setAsk({ id });
  };
  const shown = (id: PanelId) => !layout.collapsed[sideOf(layout, id)] && layout.open.includes(id);
  return { layout, change, show, shown, ask };
}

/**
 * Moves `id` to `side`, landing before the palette now at `to` in that side's list (its length: last). The
 * order of the palettes on the other side doesn't change.
 */
export function placeOn(layout: Pick<PaletteLayout, 'order' | 'right'>, id: PanelId, side: Side, to: number): Pick<PaletteLayout, 'order' | 'right'> {
  const list = paletteList(layout, side);
  // Landing before itself is staying put: before the one after it.
  const before = list[to] === id ? list[to + 1] : list[to];
  const rest = layout.order.filter(x => x !== id);
  const others = list.filter(x => x !== id);
  const at = before !== undefined ? rest.indexOf(before) : others.length ? rest.indexOf(others[others.length - 1]) + 1 : rest.length;
  const right = layout.right.filter(x => x !== id);
  return { order: [...rest.slice(0, at), id, ...rest.slice(at)], right: side === 'right' ? [...right, id] : right };
}
