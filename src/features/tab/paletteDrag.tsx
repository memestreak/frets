'use client';

/**
 * Dragging on the Tab page's palettes: a header dragged to move its palette (`useReorder`), the line between a
 * column and the clip that sets its width (`WidthHandle`), and the line under an open palette that sets its
 * height (`HeightHandle`). The layout they change is in `paletteLayout.ts`.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { clampTo, marginRoom, PALETTE_MIN, paletteList, PANEL_WIDTH, sideOf, type PaletteLayout, type PanelId, type Side } from './paletteLayout';

/** The clip keeps at least this much width beside a column being widened. */
const CLIP_MIN = 400;
/**
 * An edge of an open column, as a handle that follows the pointer while the column's other edge stays put
 * (issue #521): drag it, or tab to it and press ← → (Shift for bigger steps). The inner edge is the line
 * between the column and the clip: moving it gives the clip's width to the column or takes it back, never
 * making the clip wider than its widest. The outer edge, where the page has a margin beside the clip, gives the
 * margin's width to the column or takes it back, up to 16px from the window's edge, and the clip stays put. A
 * press doesn't take the focus from the tab.
 */
export function WidthHandle({ side, edge, width, reach, other, onWidth }: {
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
export function HeightHandle({ name, body, height, onHeight }: {
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
/** How near a column's top or bottom edge, in px, a dragged header scrolls it. */
const SCROLL_EDGE = 32;
/** How far a column scrolls each frame while a header is dragged at its edge. */
const SCROLL_STEP = 8;

/** Under 900px both sides sit over the clip in one column, so a drag never changes a palette's side. */
const narrow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 899px)').matches;

/** Where a dragged palette would land: its side and the index in that side's list. */
export interface DragAt { id: PanelId; side: Side; to: number }

/**
 * Dragging a header to move its palette: a press that moves 5px becomes a drag, a line shows where it would
 * land, and letting go moves it there. Past the clip's middle, it lands on the other side: among that side's
 * palettes, or last when that side is collapsed or has none. Near a column's top or bottom edge, it scrolls.
 */
export function useReorder(frame: RefObject<HTMLDivElement | null>, layout: PaletteLayout, onPlace: (at: DragAt) => void) {
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
