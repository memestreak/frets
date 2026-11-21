'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { ExportDialog } from './ExportDialog';
import { copyPng, fillDragData, prepareDrag, type ExportShape } from './exportImage';
import { EXPORT_STORAGE_KEY, parseExportStyle } from './exportStyle';
import { ShapeMenu, type MenuItem } from './ShapeMenu';
import { menuSpot, useMenuTrigger, type MenuTriggerProps } from './useMenuTrigger';

/** The export items' labels, shared by every menu that exports (the Tab page's bars too), so they read the same. */
export const COPY_AS_PNG = 'Copy as PNG';
export const EXPORT_OPTIONS = 'Export options…';

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

/** What `useShapeExport` gives a page. */
export interface ShapeExport {
  /** Props for a diagram that opens the export menu itself, with the page's `items` above the export ones. */
  triggerProps: (
    shape: ExportShape, opts?: { drag?: boolean; items?: MenuItem[] },
  ) => ShapeExportTriggerProps;
  /** Copy as PNG and Export options…, for a menu the page opens itself (the Tab page's chords). */
  exportItems: (shape: ExportShape) => MenuItem[];
  /** The menu, the Export dialog and the notice, to render once. */
  ui: ReactNode;
}

/**
 * Exporting shapes: right-click, a long press or Shift+F10 on anything
 * given `triggerProps` (a shape diagram, the Chord lab's neck) opens a menu
 * with Copy as PNG (the saved choices, the deduced name) and Export
 * options… (the dialog), below any `items` the page adds for that shape
 * (the Scale lab's Open in Chords). Opening it selects nothing and taps nothing.
 * With `drag`, and a mouse or trackpad, the diagram can also be dragged
 * into another app or page, or onto the desktop, as a PNG with the saved
 * choices. A page whose diagrams have their own menu (the Tab page's Chord
 * set, Chord chart and chord names) adds `exportItems` to it instead. One
 * per page, so every diagram on it shares the saved choices.
 */
export function useShapeExport(): ShapeExport {
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

  const exportItems = (shape: ExportShape): MenuItem[] => [
    {
      label: COPY_AS_PNG,
      onSelect: () => {
        copyPng(shape, style).then(setNotice, (e: unknown) => {
          setNotice(`Couldn't copy: ${e instanceof Error ? e.message : String(e)}`);
        });
      },
    },
    { label: EXPORT_OPTIONS, onSelect: () => setDialogFor(shape) },
  ];

  const closeMenu = (refocus: boolean) => {
    if (refocus) menu?.returnTo.focus();
    setMenu(null);
  };

  const ui = (
    <>
      {menu && (
        <ShapeMenu
          key={`${menu.x},${menu.y}`} x={menu.x} y={menu.y} label="Shape" onClose={closeMenu}
          items={[...menu.items, ...exportItems(menu.shape)]}
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

  return { triggerProps, exportItems, ui };
}
