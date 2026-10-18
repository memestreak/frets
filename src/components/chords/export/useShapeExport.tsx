'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { ExportDialog } from './ExportDialog';
import { copyPng, fillDragData, prepareDrag, type ExportShape } from './exportImage';
import { EXPORT_STORAGE_KEY, parseExportStyle } from './exportStyle';
import { ShapeMenu, type MenuItem } from './ShapeMenu';

/** A touch held this long opens the menu (iPhone Safari sends no contextmenu). */
const LONG_PRESS_MS = 500;
/** A touch that moves further than this is a scroll, not a long press. */
const LONG_PRESS_SLOP = 10;
/** How long "Copied as PNG" stays up. */
const NOTICE_MS = 2500;
/**
 * A mouse or trackpad drives the page, so a diagram can be dragged out. On
 * a touchscreen a long press is the menu's, and a drag there would steal it.
 */
const DRAG_QUERY = '(hover: hover) and (pointer: fine)';

interface MenuState {
  shape: ExportShape;
  /** The page's own items for the shape, above the export ones. */
  items: MenuItem[];
  x: number;
  y: number;
  /** What gets focus back: the diagram, or the fret focused inside the neck. */
  returnTo: HTMLElement;
}

/** Props for a shape's diagram (or the neck), opening the menu on it. */
export interface ShapeExportTriggerProps {
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
  draggable?: boolean;
  onPointerEnter?: (e: React.PointerEvent<HTMLElement>) => void;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
}

/**
 * Exporting shapes: right-click, a long press or Shift+F10 on anything
 * given `triggerProps` (a shape diagram, the Chord lab's neck) opens a menu
 * with Copy as PNG (the saved choices, the deduced name) and Export
 * options… (the dialog), below any `items` the page adds for that shape
 * (the Scale lab's Open in Chords). Opening it selects nothing and taps nothing.
 * With `drag`, and a mouse or trackpad, the diagram can also be dragged
 * into another app or page, or onto the desktop, as a PNG with the saved
 * choices. One per page, so the shapes and the neck share the saved
 * choices. Returns those props and the menu, dialog and notice to render.
 */
export function useShapeExport(): {
  triggerProps: (
    shape: ExportShape, opts?: { drag?: boolean; items?: MenuItem[] },
  ) => ShapeExportTriggerProps;
  ui: ReactNode;
} {
  const [style, setStyle] = useState(() => parseExportStyle(loadJson(EXPORT_STORAGE_KEY)));
  usePersist(EXPORT_STORAGE_KEY, style);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dialogFor, setDialogFor] = useState<ExportShape | null>(null);
  const [notice, setNotice] = useState('');
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** A long press just opened the menu, so the click that ends it is swallowed. */
  const swallowClick = useRef(false);
  const [canDrag, setCanDrag] = useState(false);

  useEffect(() => {
    // jsdom has no matchMedia.
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DRAG_QUERY);
    const update = () => setCanDrag(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancelPress, []);

  const openMenu = (
    shape: ExportShape, items: MenuItem[], trigger: HTMLElement, x: number, y: number,
  ) => {
    const focused = document.activeElement;
    const returnTo = focused instanceof HTMLElement && trigger.contains(focused) ? focused : trigger;
    const r = trigger.getBoundingClientRect();
    // From the keyboard there's no pointer, so it opens under the diagram.
    const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    setMenu(inside
      ? { shape, items, returnTo, x, y }
      : { shape, items, returnTo, x: r.left, y: r.bottom + 4 });
  };

  const dragProps = (shape: ExportShape): Partial<ShapeExportTriggerProps> => ({
    draggable: true,
    onPointerEnter: e => {
      if (e.pointerType === 'mouse') void prepareDrag(shape, style);
    },
    onDragStart: e => {
      cancelPress();
      fillDragData(e.dataTransfer, shape, style);
    },
  });

  const triggerProps = (
    shape: ExportShape,
    { drag = false, items = [] }: { drag?: boolean; items?: MenuItem[] } = {},
  ): ShapeExportTriggerProps => ({
    ...(drag && canDrag ? dragProps(shape) : {}),
    onContextMenu: e => {
      e.preventDefault();
      cancelPress();
      openMenu(shape, items, e.currentTarget, e.clientX, e.clientY);
    },
    onPointerDown: e => {
      if (e.pointerType !== 'touch') return;
      const trigger = e.currentTarget;
      const { clientX: x, clientY: y } = e;
      cancelPress();
      press.current = {
        x, y,
        timer: window.setTimeout(() => {
          press.current = null;
          swallowClick.current = true;
          openMenu(shape, items, trigger, x, y);
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: e => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onClickCapture: e => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });

  const closeMenu = (refocus: boolean) => {
    if (refocus) menu?.returnTo.focus();
    setMenu(null);
  };

  const ui = (
    <>
      {menu && (
        <ShapeMenu
          key={`${menu.x},${menu.y}`} x={menu.x} y={menu.y} label="Shape" onClose={closeMenu}
          items={[
            ...menu.items,
            {
              label: 'Copy as PNG',
              onSelect: () => {
                copyPng(menu.shape, style).then(setNotice, (e: unknown) => {
                  setNotice(`Couldn't copy: ${e instanceof Error ? e.message : String(e)}`);
                });
              },
            },
            { label: 'Export options…', onSelect: () => setDialogFor(menu.shape) },
          ]}
        />
      )}
      <ExportDialog
        shape={dialogFor} style={style} onStyle={setStyle}
        onClose={() => setDialogFor(null)}
      />
      <div className="export-notice" role="status" data-shown={notice ? 'true' : undefined}>
        {notice}
      </div>
    </>
  );

  return { triggerProps, ui };
}
