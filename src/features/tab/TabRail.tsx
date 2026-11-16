'use client';

/**
 * The Tab page's palettes, in a column on either side of the clip (`docs/specs/2026-11-09-tab-palettes-design.md`,
 * issue #454; `docs/specs/2026-11-15-tab-palette-sides-design.md`, issue #490; before them, a rail of
 * one-at-a-time panels, issues #301 and #431). Every palette is listed by its header, its icon before its name:
 * Notes, Articulations, Bars and Chords on the left, Chat on the right, until moved. A press on a header opens
 * or folds that palette, and several may be open at once; dragging a header moves the palette, up or down its
 * column or across to the other side, and the line under an open palette sets its height. Each side has one
 * button at its top that collapses it to a strip and expands it again, and its own width, set by dragging the
 * line between it and the clip. All of it is kept across visits (`frets.tab.layout`), but it is how the window
 * is laid out, not a preference, so Settings doesn't list it.
 */
import {
  useEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject,
} from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ICONS } from './TabPalette';
import type { ChatStatus } from './chat/useChatSession';

/** Draws the palette with only `groups`; `className` sets its look; the note input mode pencil first when `input`. */
export type DrawPalette = (groups: readonly string[], className?: string, input?: boolean) => ReactNode;

export type PanelId = 'notes' | 'articulations' | 'bars' | 'chords' | 'chat';

/** The side of the clip a column of palettes is on. */
export type Side = 'left' | 'right';
const SIDES: readonly Side[] = ['left', 'right'];

/**
 * The Articulations palette's icon: a vibrato's wavy line, drawn as the other palettes' icons are (the accent's
 * wedge read as an expand chevron).
 */
const ARTICULATIONS_ICON = <path d="M4 12 q2 -5 4 0 t4 0 t4 0 t4 0" strokeLinecap="round" strokeLinejoin="round" />;

/** The tool palettes, in their first order, and the Tool groups each holds; Chords and Chat come after them. */
export const PANELS: readonly { id: Exclude<PanelId, 'chords' | 'chat'>; name: string; icon: ReactNode; groups: readonly string[]; input?: boolean }[] = [
  { id: 'notes', name: 'Notes', icon: ICONS.quarter, groups: ['Duration', 'Rhythm'], input: true },
  { id: 'articulations', name: 'Articulations', icon: ARTICULATIONS_ICON, groups: ['Joins', 'Bends', 'Techniques', 'Accents'] },
  { id: 'bars', name: 'Bars', icon: ICONS.repeatStart, groups: ['Bars', 'Text'] },
];

export const LAYOUT_KEY = 'frets.tab.layout';

/** A column's width in px: 17rem until its divider is dragged, and never narrower or wider than these. */
const PANEL_WIDTH = { start: 272, min: 224, max: 560 } as const;
/** A collapsed column's strip, in px. */
const STRIP_WIDTH = 40;
/** The clip keeps at least this much width beside a column being widened. */
const CLIP_MIN = 400;
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

/** The Chords palette's icon: a chord diagram's grid with one dot. */
const CHORDS_ICON = (
  <>
    <rect x="5" y="4" width="14" height="16" rx="1" />
    <path d="M5 9h14M5 14h14M9.7 4v16M14.3 4v16" />
    <circle cx="12" cy="11.5" r="1.6" fill="currentColor" stroke="none" />
  </>
);

/** The Chat palette's icon: a speech bubble. */
const CHAT_ICON = (
  <path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5v-3.5H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" strokeLinejoin="round" />
);

/**
 * The Chat icon while a reply runs (issue #442): the bubble with three dots that pulse one after another, as a
 * messenger shows someone typing; still dots when the viewer asks for less motion.
 */
const CHAT_WORKING_ICON = (
  <>
    {CHAT_ICON}
    <g className="tab-rail-typing" fill="currentColor" stroke="none">
      <circle cx="8.5" cy="11" r="1.1" />
      <circle cx="12" cy="11" r="1.1" />
      <circle cx="15.5" cy="11" r="1.1" />
    </g>
  </>
);

/** Chat's tip for each status, also read out by screen readers. */
const CHAT_STATUS: Record<ChatStatus, string | undefined> = { idle: undefined, working: 'Replying…', unread: 'New reply' };

/** Every palette, in its first order: the tools', then Chords, then Chat. */
const PALETTES: readonly { id: PanelId; name: string; icon: ReactNode }[] = [
  ...PANELS, { id: 'chords', name: 'Chords', icon: CHORDS_ICON }, { id: 'chat', name: 'Chat', icon: CHAT_ICON },
];
const FIRST_ORDER: readonly PanelId[] = PALETTES.map(p => p.id);

const isPanel = (id: unknown): id is PanelId => FIRST_ORDER.includes(id as PanelId);

/** `px` kept between `least` and `most` (`least` winning), in whole px. */
const clampTo = (px: number, least: number, most: number) => Math.round(Math.min(Math.max(px, least), Math.max(least, most)));

/** A width kept within the column's limits, in whole px. */
const clampWidth = (px: number, max: number = PANEL_WIDTH.max) => clampTo(px, PANEL_WIDTH.min, max);

/** A first visit: Notes open, every palette in its first order, Chat on the right, both sides expanded. */
const FIRST_LAYOUT: PaletteLayout = {
  open: ['notes'], order: FIRST_ORDER, right: ['chat'], heights: {},
  collapsed: { left: false, right: false }, width: { left: PANEL_WIDTH.start, right: PANEL_WIDTH.start },
  reach: { left: PANEL_WIDTH.start, right: PANEL_WIDTH.start },
};

/** The side `id` is on. */
const sideOf = (layout: Pick<PaletteLayout, 'right'>, id: PanelId): Side => (layout.right.includes(id) ? 'right' : 'left');

/** The palettes on `side`, top to bottom. */
const paletteList = (layout: Pick<PaletteLayout, 'order' | 'right'>, side: Side) =>
  layout.order.filter(id => sideOf(layout, id) === side);

/** What `side` shows: an open column, its strip, or nothing when it has no palettes. */
const sideState = (layout: PaletteLayout, side: Side): 'open' | 'strip' | undefined =>
  (!paletteList(layout, side).length ? undefined : layout.collapsed[side] ? 'strip' : 'open');

/** How wide `side`'s column is, in px: its width, its strip, or 0 when it has no palettes. */
const sideRoom = (layout: PaletteLayout, side: Side) =>
  ({ open: layout.width[side], strip: STRIP_WIDTH, none: 0 })[sideState(layout, side) ?? 'none'];

/**
 * How far, in px, `side`'s column sits out past the clip's widest edge before the window's margin is counted
 * (CSS takes the least of this and `--rail-reach`): an open column's reach, but never more than its width; a
 * strip all of its width; nothing with no palettes.
 */
const sideOut = (layout: PaletteLayout, side: Side) =>
  sideState(layout, side) === 'open' ? Math.min(layout.reach[side], layout.width[side]) : sideRoom(layout, side);

/** The page's margin beside the clip that a column may use, in px, up to 16px from the window's edge: as `--rail-reach`. */
const marginRoom = () => (typeof window === 'undefined' ? 0 : Math.max(0, (window.innerWidth - 1240) / 2) + 4);

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
 * An edge of an open column, as a handle that follows the pointer while the column's other edge stays put
 * (issue #521): drag it, or tab to it and press ← → (Shift for bigger steps). The inner edge is the line
 * between the column and the clip: moving it gives the clip's width to the column or takes it back, never
 * making the clip wider than its widest. The outer edge, where the page has a margin beside the clip, gives the
 * margin's width to the column or takes it back, up to 16px from the window's edge, and the clip stays put. A
 * press doesn't take the focus from the tab.
 */
function WidthHandle({ side, edge, width, reach, other, onWidth }: {
  side: Side;
  edge: 'inner' | 'outer';
  width: number;
  /** The column's kept reach into the margin. */
  reach: number;
  /** How wide the other side's column is now, in px (0 when there is none). */
  other: number;
  onWidth: (px: number, reach: number, keep?: boolean) => void;
}) {
  const drag = useRef<{ x: number; width: number; reach: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** +1 when moving right widens the column, -1 when it narrows it. */
  const grows = (side === 'left') === (edge === 'inner') ? 1 : -1;
  /** The column's width and reach after moving this edge `by` px, the room around it measured now. */
  const moved = (el: HTMLElement, from: { width: number; reach: number }, by: number) => {
    const margin = marginRoom();
    const out = Math.min(margin, from.reach, from.width);
    if (edge === 'outer') {
      // The part over the clip stays; the part in the margin grows or shrinks, within the margin.
      const over = from.width - out;
      const px = clampTo(from.width + grows * by, Math.max(PANEL_WIDTH.min, over), Math.min(PANEL_WIDTH.max, over + margin));
      return { width: px, reach: px - over };
    }
    // The part in the margin stays; the part over the clip grows or shrinks, the clip keeping `CLIP_MIN`.
    const layout = el.closest('.tab-rail-layout');
    // Not laid out (as in tests): no limit but the column's own.
    const widest = layout?.clientWidth ? Math.min(PANEL_WIDTH.max, layout.clientWidth - CLIP_MIN - other) : PANEL_WIDTH.max;
    return { width: clampTo(from.width + grows * by, Math.max(PANEL_WIDTH.min, out), widest), reach: from.reach };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, width, reach };
    setDragging(true);
  };
  const now = useRef<{ width: number; reach: number } | null>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    now.current = moved(e.currentTarget, d, e.clientX - d.x);
    onWidth(now.current.width, now.current.reach, false);
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (now.current) onWidth(now.current.width, now.current.reach);
    now.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const by = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    const next = moved(e.currentTarget, { width, reach }, by);
    onWidth(next.width, next.reach);
  };
  const name = side === 'left' ? 'Left' : 'Right';
  // A focusable separator is ARIA's window splitter, an interactive widget, which jsx-a11y doesn't know.
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      className="tab-rail-divider" data-side={side} data-edge={edge} role="separator" aria-orientation="vertical"
      aria-label={edge === 'inner' ? `${name} palette width` : `${name} palette outer edge`}
      aria-valuenow={width} aria-valuemin={PANEL_WIDTH.min} aria-valuemax={PANEL_WIDTH.max} tabIndex={0}
      data-dragging={dragging ? '' : undefined}
      // Keep the focus, and so the cursor, on the tab; no text is selected while dragging.
      onMouseDown={e => e.preventDefault()}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onKeyDown={key}
    />
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}

/**
 * The line under an open palette, as a handle: drag it up or down, or tab to it and press ↑ ↓ (Shift for bigger
 * steps), to set how tall the palette is. It is never taller than its tools, so no empty room shows; a
 * double-click gives it back its full height.
 */
function HeightHandle({ name, body, height, onHeight }: {
  name: string;
  body: RefObject<HTMLDivElement | null>;
  height: number | undefined;
  /** The new height, or undefined for full height; kept unless `keep` is false (a drag's moves). */
  onHeight: (px: number | undefined, keep?: boolean) => void;
}) {
  const drag = useRef<{ y: number; start: number; max: number; now: number | undefined } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The tallest it may be: as tall as its tools. Not laid out (as in tests): no limit. */
  const tallest = () => (body.current?.scrollHeight ? Math.max(PALETTE_MIN, body.current.scrollHeight) : Infinity);
  /** A height within the limits; full height reads as undefined. */
  const fit = (px: number, max: number) => {
    const h = Math.round(Math.min(Math.max(px, PALETTE_MIN), max));
    return h >= max ? undefined : h;
  };
  const shown = () => body.current?.getBoundingClientRect().height || height || PALETTE_MIN;
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, start: shown(), max: tallest(), now: height };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.now = fit(d.start + e.clientY - d.y, d.max);
    onHeight(d.now, false);
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    onHeight(d.now);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const by = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    onHeight(fit(shown() + by, tallest()));
  };
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      className="tab-stack-handle" role="separator" aria-orientation="horizontal" aria-label={`${name} height`}
      aria-valuenow={height} tabIndex={0} data-dragging={dragging ? '' : undefined}
      onMouseDown={e => e.preventDefault()}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onDoubleClick={() => onHeight(undefined)} onKeyDown={key}
    />
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}

/** A chevron: down when open, right when folded. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}
      className="tab-stack-chevron" data-open={open ? '' : undefined}>
      <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The collapse button's icon: a sidebar on the button's side, with a chevron pointing the way it will go. */
function CollapseIcon({ side, collapsed }: { side: Side; collapsed: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}
      style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M9.5 5v14" />
      <path d={collapsed ? 'M13 10l2 2-2 2' : 'M15 10l-2 2 2 2'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The Alt+arrow keys on a focused header, and the way each moves its palette. */
const MOVE_KEYS: Record<string, 'up' | 'down' | Side> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/** One palette in a column: its header opens and folds it, and moves it when dragged; the line under it sets its height. */
function Palette({ id, name, icon, status, open, height, drop, dragging, onToggle, onGrab, onMoveKey, onHeight, head, children }: {
  id: PanelId;
  name: string;
  icon: ReactNode;
  /** Chat's reply status, shown on its icon. */
  status?: ChatStatus;
  open: boolean;
  height: number | undefined;
  /** Where a dragged palette would land: a line on this one's top or bottom edge. */
  drop?: 'before' | 'after';
  dragging: boolean;
  onToggle: () => void;
  onGrab: (e: PointerEvent<HTMLButtonElement>) => void;
  /** Alt+↑ ↓ on the header: move the palette up or down one; Alt+← →: to that side. */
  onMoveKey: (way: 'up' | 'down' | Side) => void;
  onHeight: (px: number | undefined, keep?: boolean) => void;
  /** What the header shows right of the name while open (Chords' Hear toggle). */
  head?: ReactNode;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const tip = status && CHAT_STATUS[status];
  return (
    <section
      className="tab-stack-panel" data-panel={id} data-expanded={open ? '' : undefined}
      data-sized={height === undefined ? undefined : ''} data-drop={drop} data-dragging={dragging ? '' : undefined}
      aria-label={name}
    >
      <div className="tab-stack-head">
        <button
          type="button" className="tab-stack-toggle" aria-expanded={open}
          // Keep the focus, and so the cursor, on the tab.
          onMouseDown={e => e.preventDefault()} onClick={onToggle} onPointerDown={onGrab}
          onKeyDown={e => {
            const way = MOVE_KEYS[e.key];
            if (!e.altKey || !way) return;
            e.preventDefault();
            e.stopPropagation();
            onMoveKey(way);
          }}
        >
          <Chevron open={open} />
          <span className="tab-stack-icon" data-status={status && status !== 'idle' ? status : undefined} data-tip={tip ? `${name}: ${tip}` : undefined}>
            <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
              {id === 'chat' && status === 'working' ? CHAT_WORKING_ICON : icon}
            </svg>
          </span>
          <h2 className="tab-rail-panel-title">{name}</h2>
        </button>
        {open && head}
      </div>
      {open && (
        <>
          <div ref={body} className="tab-stack-body" style={height === undefined ? undefined : { height }}>{children}</div>
          <HeightHandle name={name} body={body} height={height} onHeight={onHeight} />
        </>
      )}
    </section>
  );
}

/** How near a column's top or bottom edge, in px, a dragged header scrolls it. */
const SCROLL_EDGE = 32;
/** How far a column scrolls each frame while a header is dragged at its edge. */
const SCROLL_STEP = 8;

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

/** Under 900px both sides sit over the clip in one column, so a drag never changes a palette's side. */
const narrow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 899px)').matches;

/** Where a dragged palette would land: its side and the index in that side's list. */
interface DragAt { id: PanelId; side: Side; to: number }

/**
 * Dragging a header to move its palette: a press that moves 5px becomes a drag, a line shows where it would
 * land, and letting go moves it there. Past the clip's middle, it lands on the other side: among that side's
 * palettes, or last when that side is collapsed or has none. Near a column's top or bottom edge, it scrolls.
 */
function useReorder(frame: RefObject<HTMLDivElement | null>, layout: PaletteLayout, onPlace: (at: DragAt) => void) {
  const [drag, setDrag] = useState<DragAt | null>(null);
  /** A drag ends in a click on its header; that click must not open or fold it. */
  const dragged = useRef(false);
  const stackOf = (side: Side) => frame.current?.querySelector<HTMLElement>(`.tab-rail-column[data-side="${side}"] .tab-stack`) ?? null;
  /** Where a pointer at `y` would drop a palette on `side`: before the first palette whose middle is below it. */
  const dropIndex = (side: Side, y: number) => {
    const sections = [...(stackOf(side)?.querySelectorAll<HTMLElement>(':scope > .tab-stack-panel') ?? [])];
    if (!sections.length) return paletteList(layout, side).length;
    const i = sections.findIndex(el => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return i < 0 ? sections.length : i;
  };
  /** The side a pointer at `x` is over, for a palette dragged from `from`: the other once past the clip's middle. */
  const sideAt = (from: Side, x: number): Side => {
    const clip = frame.current?.querySelector('.tab-rail-clip')?.getBoundingClientRect();
    if (!clip || narrow()) return from;
    const middle = clip.left + clip.width / 2;
    if (from === 'left') return x > middle ? 'right' : 'left';
    return x < middle ? 'left' : 'right';
  };
  const grab = (id: PanelId) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const from = sideOf(layout, id);
    const startX = e.clientX;
    const startY = e.clientY;
    let x = startX;
    let y = startY;
    let moving = false;
    let at: DragAt | null = null;
    let tick = 0;
    const aim = () => {
      const side = sideAt(from, x);
      at = { id, side, to: dropIndex(side, y) };
      setDrag(at);
    };
    // While the pointer rests at the column's edge, scroll a step a frame.
    const scroll = () => {
      const box = at && stackOf(at.side);
      if (box) {
        const r = box.getBoundingClientRect();
        const by = y < r.top + SCROLL_EDGE ? -SCROLL_STEP : y > r.bottom - SCROLL_EDGE ? SCROLL_STEP : 0;
        if (by) {
          box.scrollTop += by;
          aim();
        }
      }
      tick = requestAnimationFrame(scroll);
    };
    const move = (ev: globalThis.PointerEvent) => {
      x = ev.clientX;
      y = ev.clientY;
      if (!moving && Math.hypot(x - startX, y - startY) < 5) return;
      if (!moving) tick = requestAnimationFrame(scroll);
      moving = true;
      dragged.current = true;
      aim();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cancelAnimationFrame(tick);
      if (moving && at) onPlace(at);
      setDrag(null);
    };
    dragged.current = false;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  /** Whether a click on a header ends a drag, and so does nothing; asking clears it. */
  const endsDrag = () => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  };
  return { drag, grab, endsDrag };
}

interface TabRailProps {
  palette: DrawPalette;
  /** The palettes' layout (`usePalettes`), held by the page. */
  palettes: Palettes;
  /** The Chords palette's contents. */
  chords: ReactNode;
  /** What the Chords header shows right of its name (its Hear toggle). */
  chordsHead?: ReactNode;
  /** The Chat palette's contents (issue #424). */
  chat: ReactNode;
  /** Whether a Chat reply is running, or ended unseen, shown on Chat's icon (issue #442). */
  chatStatus?: ChatStatus;
  children: ReactNode;
}

/** The clip's card with a column of palettes, or its collapsed strip, on each side that has any. */
export function TabRail({ palette, palettes, chords, chordsHead, chat, chatStatus = 'idle', children }: TabRailProps) {
  const { layout, change, ask, show } = palettes;
  const frame = useRef<HTMLDivElement>(null);
  const place = ({ id, side, to }: DragAt) => {
    // A palette dropped on a collapsed side expands it, so it can be seen where it went.
    change({ ...placeOn(layout, id, side, to), collapsed: { ...layout.collapsed, [side]: false } });
  };
  const { drag, grab, endsDrag } = useReorder(frame, layout, place);
  const isOpen = (id: PanelId) => layout.open.includes(id);
  const lists: Record<Side, PanelId[]> = { left: paletteList(layout, 'left'), right: paletteList(layout, 'right') };
  const room = (side: Side) => sideRoom(layout, side);

  // A palette the page asked for (a chord's Edit opens Chords): scroll its column, never the page, to its header.
  useEffect(() => {
    if (!ask) return;
    const tick = requestAnimationFrame(() => {
      const el = frame.current?.querySelector<HTMLElement>(`[data-panel="${ask.id}"]`);
      const box = el?.closest<HTMLElement>('.tab-stack');
      if (!box || !el) return;
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      if (top < box.scrollTop || top + 40 > box.scrollTop + box.clientHeight) box.scrollTop = top;
    });
    return () => cancelAnimationFrame(tick);
  }, [ask]);

  const contents = (id: PanelId) => {
    const tools = PANELS.find(p => p.id === id);
    if (tools) return palette(tools.groups, 'tab-rail-tools', tools.input);
    return id === 'chat' ? chat : chords;
  };
  const toggle = (id: PanelId) => {
    if (endsDrag()) return;
    change({ open: isOpen(id) ? layout.open.filter(x => x !== id) : [...layout.open, id] });
  };
  const moveKey = (id: PanelId, way: 'up' | 'down' | Side) => {
    const side = sideOf(layout, id);
    const list = lists[side];
    const at = list.indexOf(id);
    if (way === 'up' || way === 'down') {
      const by = way === 'up' ? -1 : 1;
      if (at + by < 0 || at + by >= list.length) return;
      change(placeOn(layout, id, side, by < 0 ? at - 1 : at + 2));
      return;
    }
    // Alt+← →: across to that side, last there.
    if (way !== side) place({ id, side: way, to: lists[way].length });
  };
  const setHeight = (id: PanelId, px: number | undefined, keep = true) => {
    const heights = { ...layout.heights };
    if (px === undefined) delete heights[id];
    else heights[id] = px;
    change({ heights }, keep);
  };
  /** The blue line on palette `i` of `side`, while a drag would land there. */
  const dropAt = (side: Side, i: number): 'before' | 'after' | undefined => {
    const list = lists[side];
    if (!drag || drag.side !== side || drag.id === list[i]) return undefined;
    if (drag.to === i) return 'before';
    return drag.to === list.length && i === list.length - 1 ? 'after' : undefined;
  };
  /** Whether a drag from the other side would land on `side`, so its strip lights up while collapsed. */
  const targeted = (side: Side) => !!drag && drag.side === side && sideOf(layout, drag.id) !== side;
  const column = (side: Side) => {
    const collapsed = layout.collapsed[side];
    const label = `${collapsed ? 'Expand' : 'Collapse'} ${side} palettes`;
    const collapseButton = (
      <button
        type="button" className="tab-stack-collapse" aria-label={label} aria-expanded={!collapsed} data-tip={label}
        onMouseDown={e => e.preventDefault()} onClick={() => change({ collapsed: { ...layout.collapsed, [side]: !collapsed } })}
      >
        <CollapseIcon side={side} collapsed={collapsed} />
      </button>
    );
    // Collapsed, the strip lists the side's palettes by their icons; a press expands the side with that one open.
    const stripIcons = lists[side].map(id => {
      const p = PALETTES.find(x => x.id === id)!;
      const status = id === 'chat' && chatStatus !== 'idle' ? chatStatus : undefined;
      const tip = status ? `${p.name}: ${CHAT_STATUS[status]}` : p.name;
      return (
        <button
          key={id} type="button" className="tab-stack-strip-icon" aria-label={`Show ${p.name}`} data-tip={tip}
          data-status={status} onMouseDown={e => e.preventDefault()} onClick={() => show(id)}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
            {id === 'chat' && status === 'working' ? CHAT_WORKING_ICON : p.icon}
          </svg>
        </button>
      );
    });
    return (
      <div className="tab-rail-column" data-side={side}>
        <HoverTips className="tab-rail-tips">
          {collapsed ? (
            <div className="tab-stack-strip" data-drop={targeted(side) ? '' : undefined}>{collapseButton}{stripIcons}</div>
          ) : (
            <aside className="tab-rail-panel tab-stack-frame" aria-label={`${side === 'left' ? 'Left' : 'Right'} palettes`}>
              <div className="tab-stack-top">{collapseButton}</div>
              <div className="tab-stack">
                {lists[side].map((id, i) => {
                  const p = PALETTES.find(x => x.id === id)!;
                  return (
                    <Palette
                      key={id} id={id} name={p.name} icon={p.icon} status={id === 'chat' ? chatStatus : undefined}
                      open={isOpen(id)} height={layout.heights[id]} drop={dropAt(side, i)} dragging={drag?.id === id}
                      onToggle={() => toggle(id)} onGrab={grab(id)} onMoveKey={way => moveKey(id, way)}
                      onHeight={(px, keep) => setHeight(id, px, keep)}
                      head={id === 'chords' ? chordsHead : undefined}
                    >
                      {contents(id)}
                    </Palette>
                  );
                })}
              </div>
              {(['inner', 'outer'] as const).map(edge => (
                <WidthHandle
                  key={edge} side={side} edge={edge} width={layout.width[side]} reach={layout.reach[side]}
                  other={room(side === 'left' ? 'right' : 'left')}
                  onWidth={(px, reach, keep) => change(
                    { width: { ...layout.width, [side]: px }, reach: { ...layout.reach, [side]: reach } }, keep,
                  )}
                />
              ))}
            </aside>
          )}
        </HoverTips>
      </div>
    );
  };
  return (
    <div
      ref={frame} className="tab-rail-layout" data-left={sideState(layout, 'left')} data-right={sideState(layout, 'right')}
      style={{
        '--rail-left': `${room('left')}px`, '--rail-right': `${room('right')}px`,
        '--rail-left-out': `${sideOut(layout, 'left')}px`, '--rail-right-out': `${sideOut(layout, 'right')}px`,
      } as CSSProperties}
    >
      {lists.left.length > 0 && column('left')}
      <div className="tab-rail-clip">{children}</div>
      {lists.right.length > 0 && column('right')}
      {/* While a header is dragged, a side with no palettes shows where it can be dropped (issue #490). */}
      {drag && SIDES.filter(side => !lists[side].length).map(side => (
        <div key={side} className="tab-rail-drop" data-side={side} data-target={drag.side === side ? '' : undefined} aria-hidden="true" />
      ))}
      {/* Says a reply started or ended though Chat can't be seen, and its own live list with it. */}
      <span className="sr-only" role="status">
        {palettes.shown('chat') ? '' : CHAT_STATUS[chatStatus] && `Chat: ${CHAT_STATUS[chatStatus]}`}
      </span>
    </div>
  );
}
