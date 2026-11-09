'use client';

/**
 * The Tab page's tools in a rail of panels on the left, as Dorico has them
 * (`docs/specs/2026-11-02-tab-rail-design.md`, issue #301). Each rail button opens its panel beside the
 * clip, and pressing it again closes it. The rail and panel grow into the page's left margin, so the clip
 * keeps its right edge. Its panel Chords is the track's chords (`ChordPanel`, issue #251), and Chat asks a model about the arrangement (`ChatPanel`, issue #424). Dragging the line
 * between the panel and the clip sets every panel's width (`docs/specs/2026-11-08-tab-rail-width-design.md`,
 * issue #431). Which panel is open, and the panels' width, are kept across visits (`frets.tab.layout`), but
 * they are not preferences, so Settings doesn't list them.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { useMock, type Mock } from '@/components/mocks/useMock';
import { ICONS } from './TabPalette';
import type { ChatStatus } from './chat/useChatSession';

/** Draws the palette with only `groups`; `className` sets its look; the note input mode pencil first when `input`. */
export type DrawPalette = (groups: readonly string[], className?: string, input?: boolean) => ReactNode;

export type PanelId = 'notes' | 'articulations' | 'bars' | 'chords' | 'chat';

/** The rail's tool panels, in order, and the palette groups each holds; Chords comes after them. */
export const PANELS: readonly { id: Exclude<PanelId, 'chords' | 'chat'>; name: string; icon: ReactNode; groups: readonly string[]; input?: boolean }[] = [
  { id: 'notes', name: 'Notes', icon: ICONS.quarter, groups: ['Duration', 'Rhythm'], input: true },
  { id: 'articulations', name: 'Articulations', icon: ICONS.accent, groups: ['Joins', 'Bends', 'Techniques', 'Accents'] },
  { id: 'bars', name: 'Bars', icon: ICONS.repeatStart, groups: ['Bars', 'Text'] },
];

export const LAYOUT_KEY = 'frets.tab.layout';
/** A first visit opens Notes. */
const FIRST_PANEL: PanelId = 'notes';

/** Every panel's width in px: 17rem until the divider is dragged, and never narrower or wider than these. */
export const PANEL_WIDTH = { start: 272, min: 224, max: 560 } as const;
/** The clip keeps at least this much width beside a panel being widened. */
const CLIP_MIN = 400;

/** What `frets.tab.layout` keeps: the open panel (null when all are closed) and every panel's width. */
export interface RailLayout {
  panel: PanelId | null;
  width: number;
}

const isPanel = (panel: unknown): panel is PanelId =>
  panel === 'chords' || panel === 'chat' || PANELS.some(p => p.id === panel);

/** A width kept within the panels' limits, in whole px. */
export const clampWidth = (px: number, max: number = PANEL_WIDTH.max) =>
  Math.round(Math.min(Math.max(px, PANEL_WIDTH.min), Math.max(PANEL_WIDTH.min, max)));

/** Reads `frets.tab.layout`; a field missing or unreadable is as on a first visit. */
export function parseLayout(text: string | null): RailLayout {
  const layout: RailLayout = { panel: FIRST_PANEL, width: PANEL_WIDTH.start };
  try {
    const saved: unknown = JSON.parse(text ?? 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      if ('panel' in saved && (saved.panel === null || isPanel(saved.panel))) layout.panel = saved.panel;
      if ('width' in saved && typeof saved.width === 'number' && Number.isFinite(saved.width)) layout.width = clampWidth(saved.width);
    }
  } catch {
    // Unreadable: as on a first visit.
  }
  return layout;
}

/** Writes one field of `frets.tab.layout`, keeping the other. */
function keepLayout(change: Partial<RailLayout>) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ ...parseLayout(localStorage.getItem(LAYOUT_KEY)), ...change }));
  } catch {
    // Not kept: it still applies now.
  }
}

/** The Chords panel's rail icon: a chord diagram's grid with one dot. */
const CHORDS_ICON = (
  <>
    <rect x="5" y="4" width="14" height="16" rx="1" />
    <path d="M5 9h14M5 14h14M9.7 4v16M14.3 4v16" />
    <circle cx="12" cy="11.5" r="1.6" fill="currentColor" stroke="none" />
  </>
);

/** The Chat panel's rail icon: a speech bubble. */
const CHAT_ICON = (
  <path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5v-3.5H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" strokeLinejoin="round" />
);

/**
 * The Chat button while a reply runs (issue #442): the bubble with three dots that pulse one after another, as a
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

/** The Chat button's tip for each status, also read out by screen readers. */
const CHAT_STATUS: Record<ChatStatus, string | undefined> = { idle: undefined, working: 'Replying…', unread: 'New reply' };

/** Every panel the rail opens, in order: the tools', then Chords, then Chat. */
const RAIL: readonly { id: PanelId; name: string; icon: ReactNode }[] = [
  ...PANELS, { id: 'chords', name: 'Chords', icon: CHORDS_ICON }, { id: 'chat', name: 'Chat', icon: CHAT_ICON },
];

/**
 * The open panel, kept across visits; read after the first render, since the server has no storage.
 * The page holds it, since a chord name's Edit opens Chords.
 */
export function useOpenPanel(): [PanelId | null, (id: PanelId | null) => void] {
  const [open, setOpen] = useState<PanelId | null>(FIRST_PANEL);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the kept panel exists only in the browser.
  useEffect(() => setOpen(parseLayout(localStorage.getItem(LAYOUT_KEY)).panel), []);
  const choose = (id: PanelId | null) => {
    setOpen(id);
    keepLayout({ panel: id });
  };
  return [open, choose];
}

/** Every panel's width, kept across visits; read after the first render, as the open panel is. */
function usePanelWidth(): [number, (px: number, keep?: boolean) => void] {
  const [width, setWidth] = useState<number>(PANEL_WIDTH.start);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the kept width exists only in the browser.
  useEffect(() => setWidth(parseLayout(localStorage.getItem(LAYOUT_KEY)).width), []);
  const set = (px: number, keep = true) => {
    setWidth(px);
    if (keep) keepLayout({ width: px });
  };
  return [width, set];
}

/**
 * The line between the open panel and the clip, as a handle: drag it, or tab to it and press ← →
 * (Shift for bigger steps), to set every panel's width. A press doesn't take the focus from the tab.
 */
function PanelDivider({ width, onWidth }: { width: number; onWidth: (px: number, keep?: boolean) => void }) {
  const drag = useRef<{ x: number; width: number; max: number; now: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The widest the panel may be now: the clip keeps `CLIP_MIN` of the layout's width. */
  const widest = (el: HTMLElement) => {
    const layout = el.closest('.tab-rail-layout');
    // Not laid out (as in tests): no limit but the panels' own.
    if (!layout?.clientWidth) return PANEL_WIDTH.max;
    const rail = layout.querySelector('.tab-rail');
    return Math.min(PANEL_WIDTH.max, layout.clientWidth - (rail?.getBoundingClientRect().width ?? 0) - CLIP_MIN);
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
      className="tab-rail-divider" role="separator" aria-orientation="vertical" aria-label="Panel width"
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

interface TabRailProps {
  palette: DrawPalette;
  /** The open panel (`useOpenPanel`), or null. */
  open: PanelId | null;
  onOpen: (id: PanelId | null) => void;
  /** The Chords panel's contents. */
  chords: ReactNode;
  /** What the Chords panel's head shows right of its title (its Hear toggle). */
  chordsHead?: ReactNode;
  /** The Chat panel's contents (issue #424). */
  chat: ReactNode;
  /** Mocks only: a new value each time the page asks for Chords again (a chord's Edit), though `open` is already Chords. */
  openAsk?: unknown;
  /** Whether a Chat reply is running, or ended unseen, shown on the Chat button (issue #442). */
  chatStatus?: ChatStatus;
  children: ReactNode;
}

/**
 * Mocks for several palettes open at once (issue #454): a, the rail picks which palettes stack in the
 * column; b, every palette is listed and folds from its header, the column scrolls; c, every palette is
 * listed and the open ones share the window's height. Today's one-at-a-time rail is the default.
 */
const PALETTES_MOCK: Mock = {
  param: 'mock', label: 'Palettes', options: [
    { value: 'today', label: 'Today' },
    { value: 'a', label: 'a: Rail picks' },
    { value: 'b', label: 'b: All, scroll' },
    { value: 'c', label: 'c: All, fill' },
  ],
};

/** The clip's card with the rail and its open panel on its left. */
export function TabRail(props: TabRailProps) {
  const mock = useMock(PALETTES_MOCK);
  return mock === 'today' ? <OnePanelRail {...props} /> : <PaletteStack {...props} kind={mock as StackKind} />;
}

function OnePanelRail({ palette, open, onOpen: setOpen, chords, chordsHead, chat, chatStatus = 'idle', children }: TabRailProps) {
  const panel = RAIL.find(p => p.id === open);
  const tools = PANELS.find(p => p.id === open);
  const [width, setWidth] = usePanelWidth();
  return (
    <div
      className="tab-rail-layout" data-open={panel ? '' : undefined}
      style={width === PANEL_WIDTH.start ? undefined : { '--rail-panel-width': `${width}px` } as CSSProperties}
    >
      <HoverTips className="tab-rail-column">
        <nav className="tab-rail" aria-label="Panels">
          {RAIL.map(p => {
            const status = p.id === 'chat' ? CHAT_STATUS[chatStatus] : undefined;
            return (
              <button
                key={p.id} type="button" className="tab-rail-button" aria-label={p.name} aria-pressed={open === p.id}
                data-tip={status ? `${p.name}: ${status}` : p.name}
                data-status={p.id === 'chat' && chatStatus !== 'idle' ? chatStatus : undefined}
                // Keep the focus, and so the cursor, on the tab.
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(open === p.id ? null : p.id)}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  {p.id === 'chat' && chatStatus === 'working' ? CHAT_WORKING_ICON : p.icon}
                </svg>
              </button>
            );
          })}
        </nav>
        {/* Says a reply started or ended though the Chat panel, and its own live list, are closed. */}
        <span className="sr-only" role="status">{open === 'chat' ? '' : CHAT_STATUS[chatStatus] && `Chat: ${CHAT_STATUS[chatStatus]}`}</span>
      </HoverTips>
      {panel && (
        <HoverTips className="tab-rail-column">
          <aside className="tab-rail-panel" aria-label={panel.name}>
            <div className="tab-rail-panel-head">
              <span className="tab-rail-panel-name">
                <h2 className="tab-rail-panel-title">{panel.name}</h2>
                {panel.id === 'chords' && chordsHead}
              </span>
              <button
                type="button" className="tab-rail-close" aria-label={`Close ${panel.name}`} data-tip="Close"
                onMouseDown={e => e.preventDefault()} onClick={() => setOpen(null)}
              >
                {/* A chevron pointing back to the rail. */}
                <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M10 3.5L5.5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {tools ? palette(tools.groups, 'tab-rail-tools', tools.input) : panel.id === 'chat' ? chat : chords}
            <PanelDivider width={width} onWidth={setWidth} />
          </aside>
        </HoverTips>
      )}
      <div className="tab-rail-clip">{children}</div>
    </div>
  );
}

type StackKind = 'a' | 'b' | 'c';

/** A palette's least height, below its header, when dragged shorter. */
const BODY_MIN = 48;

/**
 * The line under a palette, as a handle: drag it up or down, or tab to it and press ↑ ↓ (Shift for bigger
 * steps), to set how tall the palette is; a double-click gives it back its own height.
 */
function HeightHandle({ name, body, height, onHeight }: {
  name: string;
  body: RefObject<HTMLDivElement | null>;
  height: number | undefined;
  onHeight: (px: number | undefined) => void;
}) {
  const drag = useRef<{ y: number; start: number; max: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The tallest it may be: as tall as its tools, so it never shows empty room. */
  const tallest = () => {
    const el = body.current;
    return el ? Math.max(BODY_MIN, el.scrollHeight) : 2000;
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !body.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, start: body.current.getBoundingClientRect().height, max: tallest() };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const px = Math.round(Math.min(Math.max(d.start + e.clientY - d.y, BODY_MIN), d.max));
    onHeight(px >= d.max ? undefined : px);
  };
  const up = () => {
    drag.current = null;
    setDragging(false);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const by = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!by || !body.current) return;
    e.preventDefault();
    e.stopPropagation();
    const max = tallest();
    const px = Math.min(Math.max(body.current.getBoundingClientRect().height + by, BODY_MIN), max);
    onHeight(px >= max ? undefined : px);
  };
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      className="tab-stack-handle" role="separator" aria-orientation="horizontal" aria-label={`${name} height`}
      aria-valuenow={height} tabIndex={0} data-dragging={dragging ? '' : undefined} data-tip="Drag to resize; double-click for full height"
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

/** One palette in the column: its header folds it, and the line under it sets its height. */
function StackPanel({ id, name, icon, status, expanded, height, onToggle, onHeight, head, children }: {
  id: PanelId;
  name: string;
  /** Mock b: the palette's icon, before its name, in place of the rail's button. */
  icon?: ReactNode;
  /** Mock b: Chat's reply status, shown on its icon as the rail's button showed it. */
  status?: ChatStatus;
  expanded: boolean;
  height: number | undefined;
  onToggle: () => void;
  onHeight: (px: number | undefined) => void;
  head?: ReactNode;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  return (
    <section className="tab-stack-panel" data-panel={id} data-expanded={expanded ? '' : undefined}
      data-sized={height === undefined ? undefined : ''} aria-label={name}>
      <div className="tab-stack-head">
        <button
          type="button" className="tab-stack-toggle" aria-expanded={expanded}
          onMouseDown={e => e.preventDefault()} onClick={onToggle}
        >
          <Chevron open={expanded} />
          {icon && (
            <span className="tab-stack-icon" data-status={status && status !== 'idle' ? status : undefined}
              data-tip={status && CHAT_STATUS[status] ? `${name}: ${CHAT_STATUS[status]}` : undefined}>
              <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {id === 'chat' && status === 'working' ? CHAT_WORKING_ICON : icon}
              </svg>
            </span>
          )}
          <h2 className="tab-rail-panel-title">{name}</h2>
        </button>
        {expanded && head}
      </div>
      {expanded && (
        <>
          <div ref={body} className="tab-stack-body" style={height === undefined ? undefined : { height }}>{children}</div>
          <HeightHandle name={name} body={body} height={height} onHeight={onHeight} />
        </>
      )}
    </section>
  );
}

/** The column's own button on the rail: hides every palette into the rail, and shows them again. */
function HideAllIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M9.5 5v14" />
      <path d={hidden ? 'M13 10l2 2-2 2' : 'M15 10l-2 2 2 2'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mocks a–c of issue #454: several palettes open at once in one column beside the rail (b: no rail). */
function PaletteStack({ kind, palette, open, openAsk, chords, chordsHead, chat, chatStatus = 'idle', children }: TabRailProps & { kind: StackKind }) {
  const [width, setWidth] = usePanelWidth();
  /** Mock a only: the palettes the rail has put in the column, in the rail's order. */
  const [shown, setShown] = useState<readonly PanelId[]>(['notes', 'chords']);
  const [expanded, setExpanded] = useState<readonly PanelId[]>(['notes', 'chords']);
  const [heights, setHeights] = useState<Partial<Record<PanelId, number>>>({});
  const [hidden, setHidden] = useState(false);
  const column = useRef<HTMLDivElement>(null);

  const listed = kind === 'a' ? RAIL.filter(p => shown.includes(p.id)) : RAIL;
  const isOpen = (id: PanelId) => expanded.includes(id);
  const expand = (id: PanelId) => setExpanded(e => (e.includes(id) ? e : [...e, id]));
  const fold = (id: PanelId) => setExpanded(e => e.filter(x => x !== id));
  /** Scrolls the column, never the page, to show a palette's header once it is drawn. */
  const reveal = (id: PanelId) => requestAnimationFrame(() => {
    const box = column.current;
    const panel = box?.querySelector<HTMLElement>(`[data-panel="${id}"]`);
    if (!box || !panel) return;
    const top = panel.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop || top + 40 > box.scrollTop + box.clientHeight) box.scrollTop = top;
  });

  // A chord name's Edit asks the page for Chords: show it, open.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- the page's ask arrives as a prop. */
    setHidden(false);
    setShown(s => (s.includes(open) ? s : [...s, open]));
    expand(open);
    /* eslint-enable react-hooks/set-state-in-effect */
    requestAnimationFrame(() => reveal(open));
  }, [open, openAsk]);

  const railPress = (id: PanelId) => {
    if (kind === 'a') {
      if (shown.includes(id) && !hidden) {
        setShown(s => s.filter(x => x !== id));
      } else {
        setShown(s => (s.includes(id) ? s : [...s, id]));
        expand(id);
        setHidden(false);
        reveal(id);
      }
      return;
    }
    if (hidden) {
      setHidden(false);
      expand(id);
      reveal(id);
    } else if (isOpen(id)) {
      fold(id);
    } else {
      expand(id);
      reveal(id);
    }
  };
  const pressed = (id: PanelId) => !hidden && (kind === 'a' ? shown.includes(id) : isOpen(id));
  const showColumn = !hidden && listed.length > 0;

  const contents = (id: PanelId) => {
    const tools = PANELS.find(p => p.id === id);
    if (tools) return palette(tools.groups, 'tab-rail-tools', tools.input);
    return id === 'chat' ? chat : chords;
  };

  /** Mock b has no rail (Jeremy, 2026-11-09): one button collapses the column to a strip and expands it again. */
  const railless = kind === 'b';
  const collapseButton = (
    <button
      type="button" className="tab-stack-collapse" aria-label={showColumn ? 'Collapse palettes' : 'Expand palettes'}
      aria-expanded={showColumn} data-tip={showColumn ? 'Collapse palettes' : 'Expand palettes'}
      data-status={!showColumn && chatStatus !== 'idle' ? chatStatus : undefined}
      onMouseDown={e => e.preventDefault()} onClick={() => setHidden(h => !h)}
    >
      <HideAllIcon hidden={!showColumn} />
    </button>
  );

  return (
    <div
      className="tab-rail-layout" data-open={showColumn ? '' : undefined} data-stack={kind}
      data-railless={railless ? '' : undefined}
      style={width === PANEL_WIDTH.start ? undefined : { '--rail-panel-width': `${width}px` } as CSSProperties}
    >
      {railless && !showColumn && (
        <HoverTips className="tab-rail-column">
          <div className="tab-stack-strip">{collapseButton}</div>
        </HoverTips>
      )}
      {!railless && <HoverTips className="tab-rail-column">
        <nav className="tab-rail" aria-label="Panels">
          <button
            type="button" className="tab-rail-button tab-rail-hide" aria-label={hidden ? 'Show palettes' : 'Hide palettes'}
            data-tip={hidden ? 'Show palettes' : 'Hide palettes'} disabled={listed.length === 0}
            onMouseDown={e => e.preventDefault()} onClick={() => setHidden(h => !h)}
          >
            <HideAllIcon hidden={!showColumn} />
          </button>
          {RAIL.map(p => {
            const status = p.id === 'chat' ? CHAT_STATUS[chatStatus] : undefined;
            return (
              <button
                key={p.id} type="button" className="tab-rail-button" aria-label={p.name} aria-pressed={pressed(p.id)}
                data-tip={status ? `${p.name}: ${status}` : p.name}
                data-status={p.id === 'chat' && chatStatus !== 'idle' ? chatStatus : undefined}
                onMouseDown={e => e.preventDefault()}
                onClick={() => railPress(p.id)}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  {p.id === 'chat' && chatStatus === 'working' ? CHAT_WORKING_ICON : p.icon}
                </svg>
              </button>
            );
          })}
        </nav>
      </HoverTips>}
      {showColumn && (
        <HoverTips className="tab-rail-column">
          <div className="tab-rail-panel tab-stack-frame" data-stack={kind}>
          {railless && <div className="tab-stack-top">{collapseButton}</div>}
          <div ref={column} className="tab-stack" data-stack={kind}>
            {listed.map(p => (
              <StackPanel
                icon={railless ? p.icon : undefined} status={railless && p.id === 'chat' ? chatStatus : undefined}
                key={p.id} id={p.id} name={p.name} expanded={isOpen(p.id)} height={heights[p.id]}
                onToggle={() => (isOpen(p.id) ? fold(p.id) : expand(p.id))}
                onHeight={px => setHeights(h => ({ ...h, [p.id]: px }))}
                head={p.id === 'chords' ? chordsHead : undefined}
              >
                {contents(p.id)}
              </StackPanel>
            ))}
          </div>
            <PanelDivider width={width} onWidth={setWidth} />
          </div>
        </HoverTips>
      )}
      <div className="tab-rail-clip">{children}</div>
    </div>
  );
}
