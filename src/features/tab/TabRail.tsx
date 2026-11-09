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
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ICONS } from './TabPalette';

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
  children: ReactNode;
}

/** The clip's card with the rail and its open panel on its left. */
export function TabRail({ palette, open, onOpen: setOpen, chords, chordsHead, chat, children }: TabRailProps) {
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
          {RAIL.map(p => (
            <button
              key={p.id} type="button" className="tab-rail-button" aria-label={p.name} aria-pressed={open === p.id}
              data-tip={p.name}
              // Keep the focus, and so the cursor, on the tab.
              onMouseDown={e => e.preventDefault()}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {p.icon}
              </svg>
            </button>
          ))}
        </nav>
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
