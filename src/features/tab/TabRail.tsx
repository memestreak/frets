'use client';

/**
 * The Tab page's palettes, in one column on the clip's left (`docs/specs/2026-11-09-tab-palettes-design.md`,
 * issue #454; before it, a rail of one-at-a-time panels, issues #301 and #431). Every palette is listed by its
 * header, its icon before its name: Notes, Articulations, Bars, Chords, Chat. A press on a header opens or folds
 * that palette, and several may be open at once; dragging a header moves the palette, and the line under an
 * open palette sets its height. One button at the column's top collapses it to a strip and expands it again.
 * Dragging the line between the column and the clip sets its width. All of it is kept across visits
 * (`frets.tab.layout`), but it is how the window is laid out, not a preference, so Settings doesn't list it.
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

/** The tool palettes, in their first order, and the Tool groups each holds; Chords and Chat come after them. */
export const PANELS: readonly { id: Exclude<PanelId, 'chords' | 'chat'>; name: string; icon: ReactNode; groups: readonly string[]; input?: boolean }[] = [
  { id: 'notes', name: 'Notes', icon: ICONS.quarter, groups: ['Duration', 'Rhythm'], input: true },
  { id: 'articulations', name: 'Articulations', icon: ICONS.accent, groups: ['Joins', 'Bends', 'Techniques', 'Accents'] },
  { id: 'bars', name: 'Bars', icon: ICONS.repeatStart, groups: ['Bars', 'Text'] },
];

export const LAYOUT_KEY = 'frets.tab.layout';

/** The column's width in px: 17rem until the divider is dragged, and never narrower or wider than these. */
export const PANEL_WIDTH = { start: 272, min: 224, max: 560 } as const;
/** The clip keeps at least this much width beside a column being widened. */
const CLIP_MIN = 400;
/** A palette's least height, below its header, when dragged shorter: about one row of tools. */
export const PALETTE_MIN = 48;

/** What `frets.tab.layout` keeps. */
export interface PaletteLayout {
  /** The open palettes. */
  open: readonly PanelId[];
  /** Every palette, top to bottom. */
  order: readonly PanelId[];
  /** The heights dragged, in px, below each header; a palette not listed is as tall as its tools. */
  heights: Partial<Record<PanelId, number>>;
  /** Whether the column is collapsed to its strip. */
  collapsed: boolean;
  width: number;
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

/** A width kept within the column's limits, in whole px. */
export const clampWidth = (px: number, max: number = PANEL_WIDTH.max) =>
  Math.round(Math.min(Math.max(px, PANEL_WIDTH.min), Math.max(PANEL_WIDTH.min, max)));

/** A first visit: Notes open, every palette in its first order, the column expanded. */
const FIRST_LAYOUT: PaletteLayout = { open: ['notes'], order: FIRST_ORDER, heights: {}, collapsed: false, width: PANEL_WIDTH.start };

/** Reads `frets.tab.layout`; a field missing or unreadable is as on a first visit. */
export function parseLayout(text: string | null): PaletteLayout {
  const layout: PaletteLayout = { ...FIRST_LAYOUT, heights: {} };
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
  if (s.heights && typeof s.heights === 'object' && !Array.isArray(s.heights)) {
    for (const [id, px] of Object.entries(s.heights)) {
      if (isPanel(id) && typeof px === 'number' && Number.isFinite(px)) layout.heights[id] = Math.max(PALETTE_MIN, Math.round(px));
    }
  }
  if (typeof s.collapsed === 'boolean') layout.collapsed = s.collapsed;
  if (typeof s.width === 'number' && Number.isFinite(s.width)) layout.width = clampWidth(s.width);
  return layout;
}

/** The page's hold on the palettes: their layout, and opening one from elsewhere (a chord's Edit opens Chords). */
export interface Palettes {
  layout: PaletteLayout;
  /** Changes the layout; kept across visits unless `keep` is false (a drag's moves, before it ends). */
  change: (change: Partial<PaletteLayout>, keep?: boolean) => void;
  /** Expands the column, opens `id` and brings it into view. */
  show: (id: PanelId) => void;
  /** Whether `id` is open and the column expanded, so it can be seen. */
  shown: (id: PanelId) => boolean;
  /** A new value each time `show` asks for a palette, which the column then scrolls to. */
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
    change({ collapsed: false, open: layout.open.includes(id) ? layout.open : [...layout.open, id] });
    setAsk({ id });
  };
  return { layout, change, show, shown: id => !layout.collapsed && layout.open.includes(id), ask };
}

/**
 * The line between the column and the clip, as a handle: drag it, or tab to it and press ← →
 * (Shift for bigger steps), to set the column's width. A press doesn't take the focus from the tab.
 */
function WidthHandle({ width, onWidth }: { width: number; onWidth: (px: number, keep?: boolean) => void }) {
  const drag = useRef<{ x: number; width: number; max: number; now: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The widest the column may be now: the clip keeps `CLIP_MIN` of the layout's width. */
  const widest = (el: HTMLElement) => {
    const layout = el.closest('.tab-rail-layout');
    // Not laid out (as in tests): no limit but the column's own.
    if (!layout?.clientWidth) return PANEL_WIDTH.max;
    return Math.min(PANEL_WIDTH.max, layout.clientWidth - CLIP_MIN);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, width, max: widest(e.currentTarget), now: width };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.now = clampWidth(d.width + e.clientX - d.x, d.max);
    onWidth(d.now, false);
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    onWidth(d.now);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const by = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    onWidth(clampWidth(width + by, widest(e.currentTarget)));
  };
  // A focusable separator is ARIA's window splitter, an interactive widget, which jsx-a11y doesn't know.
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      className="tab-rail-divider" role="separator" aria-orientation="vertical" aria-label="Palette width"
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

/** The collapse button's icon: a sidebar with a chevron pointing the way it will go. */
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M9.5 5v14" />
      <path d={collapsed ? 'M13 10l2 2-2 2' : 'M15 10l-2 2 2 2'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One palette in the column: its header opens and folds it, and moves it when dragged; the line under it sets its height. */
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
  /** Alt+↑ ↓ on the header: move the palette up or down one. */
  onMoveKey: (by: -1 | 1) => void;
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
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
            e.preventDefault();
            e.stopPropagation();
            onMoveKey(e.key === 'ArrowUp' ? -1 : 1);
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

/** How near the column's top or bottom edge, in px, a dragged header scrolls it. */
const SCROLL_EDGE = 32;
/** How far the column scrolls each frame while a header is dragged at its edge. */
const SCROLL_STEP = 8;

/** Moves `id` to land before the palette now at `to` in `order` (`order.length`: last). */
export function moveTo(order: readonly PanelId[], id: PanelId, to: number): PanelId[] {
  const from = order.indexOf(id);
  const rest = order.filter(x => x !== id);
  const at = to > from ? to - 1 : to;
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/**
 * Dragging a header to move its palette: a press that moves 5px becomes a drag, a line shows where it would
 * land, and letting go moves it there. Near the column's top or bottom edge the column scrolls.
 */
function useReorder(column: RefObject<HTMLDivElement | null>, order: readonly PanelId[], onOrder: (order: PanelId[]) => void) {
  const [drag, setDrag] = useState<{ id: PanelId; to: number } | null>(null);
  /** A drag ends in a click on its header; that click must not open or fold it. */
  const dragged = useRef(false);
  /** Where a pointer at `y` would drop a palette: before the first palette whose middle is below it. */
  const dropIndex = (y: number) => {
    const sections = [...(column.current?.querySelectorAll<HTMLElement>(':scope > .tab-stack-panel') ?? [])];
    const i = sections.findIndex(el => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return i < 0 ? sections.length : i;
  };
  const grab = (id: PanelId) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const startY = e.clientY;
    let y = startY;
    let moving = false;
    let to = -1;
    let frame = 0;
    dragged.current = false;
    // While the pointer rests at the column's edge, scroll a step a frame.
    const scroll = () => {
      const box = column.current;
      if (box) {
        const r = box.getBoundingClientRect();
        const by = y < r.top + SCROLL_EDGE ? -SCROLL_STEP : y > r.bottom - SCROLL_EDGE ? SCROLL_STEP : 0;
        if (by) {
          box.scrollTop += by;
          to = dropIndex(y);
          setDrag({ id, to });
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    const move = (ev: globalThis.PointerEvent) => {
      y = ev.clientY;
      if (!moving && Math.abs(y - startY) < 5) return;
      if (!moving) frame = requestAnimationFrame(scroll);
      moving = true;
      dragged.current = true;
      to = dropIndex(y);
      setDrag({ id, to });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cancelAnimationFrame(frame);
      if (moving && to >= 0) onOrder(moveTo(order, id, to));
      setDrag(null);
    };
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

/** The clip's card with the palettes' column, or its collapsed strip, on its left. */
export function TabRail({ palette, palettes, chords, chordsHead, chat, chatStatus = 'idle', children }: TabRailProps) {
  const { layout, change, ask } = palettes;
  const column = useRef<HTMLDivElement>(null);
  const { drag, grab, endsDrag } = useReorder(column, layout.order, order => change({ order }));
  const listed = layout.order.map(id => PALETTES.find(p => p.id === id)!);
  const isOpen = (id: PanelId) => layout.open.includes(id);

  // A palette the page asked for (a chord's Edit opens Chords): scroll the column, never the page, to its header.
  useEffect(() => {
    if (!ask) return;
    const frame = requestAnimationFrame(() => {
      const box = column.current;
      const el = box?.querySelector<HTMLElement>(`[data-panel="${ask.id}"]`);
      if (!box || !el) return;
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      if (top < box.scrollTop || top + 40 > box.scrollTop + box.clientHeight) box.scrollTop = top;
    });
    return () => cancelAnimationFrame(frame);
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
  const moveBy = (id: PanelId, by: -1 | 1) => {
    const at = layout.order.indexOf(id);
    if (at + by < 0 || at + by >= layout.order.length) return;
    change({ order: moveTo(layout.order, id, by < 0 ? at - 1 : at + 2) });
  };
  const setHeight = (id: PanelId, px: number | undefined, keep = true) => {
    const heights = { ...layout.heights };
    if (px === undefined) delete heights[id];
    else heights[id] = px;
    change({ heights }, keep);
  };
  const dropAt = (i: number): 'before' | 'after' | undefined => {
    if (!drag || drag.id === listed[i].id) return undefined;
    if (drag.to === i) return 'before';
    return drag.to === listed.length && i === listed.length - 1 ? 'after' : undefined;
  };

  const collapsed = layout.collapsed;
  const collapseButton = (
    <button
      type="button" className="tab-stack-collapse" aria-label={collapsed ? 'Expand palettes' : 'Collapse palettes'}
      aria-expanded={!collapsed} data-tip={collapsed ? 'Expand palettes' : 'Collapse palettes'}
      // Collapsed, the strip still says a Chat reply is running or new.
      data-status={collapsed && chatStatus !== 'idle' ? chatStatus : undefined}
      onMouseDown={e => e.preventDefault()} onClick={() => change({ collapsed: !collapsed })}
    >
      <CollapseIcon collapsed={collapsed} />
    </button>
  );

  return (
    <div
      className="tab-rail-layout" data-open={collapsed ? undefined : ''}
      style={layout.width === PANEL_WIDTH.start ? undefined : { '--rail-panel-width': `${layout.width}px` } as CSSProperties}
    >
      <HoverTips className="tab-rail-column">
        {collapsed ? (
          <div className="tab-stack-strip">{collapseButton}</div>
        ) : (
          <aside className="tab-rail-panel tab-stack-frame" aria-label="Palettes">
            <div className="tab-stack-top">{collapseButton}</div>
            <div ref={column} className="tab-stack">
              {listed.map((p, i) => (
                <Palette
                  key={p.id} id={p.id} name={p.name} icon={p.icon} status={p.id === 'chat' ? chatStatus : undefined}
                  open={isOpen(p.id)} height={layout.heights[p.id]} drop={dropAt(i)} dragging={drag?.id === p.id}
                  onToggle={() => toggle(p.id)} onGrab={grab(p.id)} onMoveKey={by => moveBy(p.id, by)}
                  onHeight={(px, keep) => setHeight(p.id, px, keep)}
                  head={p.id === 'chords' ? chordsHead : undefined}
                >
                  {contents(p.id)}
                </Palette>
              ))}
            </div>
            <WidthHandle width={layout.width} onWidth={(width, keep) => change({ width }, keep)} />
          </aside>
        )}
        {/* Says a reply started or ended though Chat can't be seen, and its own live list with it. */}
        <span className="sr-only" role="status">
          {palettes.shown('chat') ? '' : CHAT_STATUS[chatStatus] && `Chat: ${CHAT_STATUS[chatStatus]}`}
        </span>
      </HoverTips>
      <div className="tab-rail-clip">{children}</div>
    </div>
  );
}
