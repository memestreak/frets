'use client';

import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FONT_FAMILY } from '@/components/chords/export/exportImage';
import { BACKDROP } from '@/components/chords/export/exportStyle';
import type { Clip } from './clip';
import { layoutClip } from './layout';
import { TabClip, type TabLook } from './TabClip';

export const TAB_EXPORT_KEY = 'frets.tab.export';

/** The Export dialog's choices, saved; the menu's Copy as PNG uses them too. */
export interface TabExportStyle {
  /** How wide the image is, in pixels; the tab wraps onto more lines to fit. */
  width: TabExportWidth;
  /** Nothing behind the tab; otherwise white, as the preview shows it. */
  transparent: boolean;
  /** The clip's name above the tab. */
  name: boolean;
}

export const TAB_EXPORT_WIDTHS = [480, 640, 800, 1000, 1200] as const;
export type TabExportWidth = (typeof TAB_EXPORT_WIDTHS)[number];

export const DEFAULT_TAB_EXPORT: TabExportStyle = { width: 800, transparent: true, name: true };

/** Saved choices, with a default for any field missing or invalid. */
export function parseTabExportStyle(raw: unknown): TabExportStyle {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_TAB_EXPORT;
  return {
    width: TAB_EXPORT_WIDTHS.find(w => w === o.width) ?? d.width,
    transparent: typeof o.transparent === 'boolean' ? o.transparent : d.transparent,
    name: typeof o.name === 'boolean' ? o.name : d.name,
  };
}

/** Black ink, as the chord export's black and white: an image is printed or pasted anywhere. */
const EXPORT_LOOK: TabLook = { ink: '#000000', line: '#000000' };
/** Room round the tab, so it doesn't touch the image's edges. */
const PAD = 16;
const TITLE_SIZE = 20;
const TITLE_HEIGHT = 34;

/** The image's size in pixels. */
export function tabImageSize(clip: Clip, style: TabExportStyle, title: string): { width: number; height: number } {
  const tab = layoutClip(clip, style.width - 2 * PAD);
  const shown = style.name && title.trim() !== '';
  return { width: style.width, height: tab.height + 2 * PAD + (shown ? TITLE_HEIGHT : 0) - 8 };
}

/**
 * The clip as an image: the page's own `TabClip` in black, with the name
 * above it if the style shows it, on white unless transparent. The Export
 * dialog's preview draws the same.
 */
export function TabImage({ clip, style, title }: { clip: Clip; style: TabExportStyle; title: string }) {
  const { width, height } = tabImageSize(clip, style, title);
  const shown = style.name && title.trim() !== '' ? title.trim() : '';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      fontFamily={FONT_FAMILY} className="tab-image"
    >
      {!style.transparent && <rect width={width} height={height} fill={BACKDROP} />}
      {shown && (
        <text x={PAD} y={PAD + TITLE_SIZE - 4} fontSize={TITLE_SIZE} fontWeight={700} fill={EXPORT_LOOK.ink}>{shown}</text>
      )}
      <TabClip
        clip={clip} width={width - 2 * PAD} look={EXPORT_LOOK} title={shown || 'Tab'}
        x={PAD} y={PAD + (shown ? TITLE_HEIGHT : 0) - 8}
      />
    </svg>
  );
}

/** The image as standalone SVG code. */
export function tabSvg(clip: Clip, style: TabExportStyle, title: string): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(TabImage, { clip, style, title })));
  const svg = host.querySelector('svg')!;
  root.unmount();
  svg.removeAttribute('class');
  // The tab inside reads the page's font variable; the image names the font itself.
  svg.querySelectorAll('svg svg').forEach(inner => {
    inner.removeAttribute('font-family');
    inner.removeAttribute('class');
  });
  return new XMLSerializer().serializeToString(svg);
}

/** "Riff", safe as a file name, with no spaces. */
export function tabFileName(title: string): string {
  return (title.trim() || 'Tab').replace(/[\\/:*?"<>|\s]/g, '_');
}
