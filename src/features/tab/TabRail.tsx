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
import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ICONS } from './TabPalette';
import type { ChatStatus } from './chat/useChatSession';
import { FIRST_ORDER, paletteList, placeOn, SIDES, sideOf, sideOut, sideRoom, sideState, type Palettes, type PanelId, type Side } from './paletteLayout';
import { HeightHandle, useReorder, WidthHandle, type DragAt } from './paletteDrag';

/** Draws the palette with only `groups`; `className` sets its look; the note input mode pencil first when `input`. */
export type DrawPalette = (groups: readonly string[], className?: string, input?: boolean) => ReactNode;

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
const PALETTES: readonly { id: PanelId; name: string; icon: ReactNode }[] = FIRST_ORDER.map(id =>
  id === 'chords' ? { id, name: 'Chords', icon: CHORDS_ICON }
    : id === 'chat' ? { id, name: 'Chat', icon: CHAT_ICON }
      : PANELS.find(p => p.id === id)!);
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
