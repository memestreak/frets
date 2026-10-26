'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { ExportDialog } from './ExportDialog';
import { copyPng, fillDragData, prepareDrag, type ExportShape } from './exportImage';
import { EXPORT_STORAGE_KEY, parseExportStyle } from './exportStyle';
import { ShapeMenu, type MenuItem } from './ShapeMenu';
import { menuSpot, useMenuTrigger, type MenuTriggerProps } from './useMenuTrigger';

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
export interface ShapeExportTriggerProps extends MenuTriggerProps {
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
  const trigger = useMenuTrigger();
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

  const openMenu = (
    shape: ExportShape, items: MenuItem[], trigger: HTMLElement, x: number, y: number,
  ) => {
    const focused = document.activeElement;
    const returnTo = focused instanceof HTMLElement && trigger.contains(focused) ? focused : trigger;
    setMenu({ shape, items, returnTo, ...menuSpot(trigger, x, y) });
  };

  const dragProps = (shape: ExportShape): Partial<ShapeExportTriggerProps> => ({
    draggable: true,
    onPointerEnter: e => {
      if (e.pointerType === 'mouse') void prepareDrag(shape, style);
    },
    onDragStart: e => {
      trigger.cancel();
      fillDragData(e.dataTransfer, shape, style);
    },
  });

  const triggerProps = (
    shape: ExportShape,
    { drag = false, items = [] }: { drag?: boolean; items?: MenuItem[] } = {},
  ): ShapeExportTriggerProps => ({
    ...(drag && canDrag ? dragProps(shape) : {}),
    ...trigger.props((el, x, y) => openMenu(shape, items, el, x, y)),
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
