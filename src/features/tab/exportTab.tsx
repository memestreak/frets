'use client';

import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FONT_FAMILY } from '@/components/chords/export/exportImage';
import { BACKDROP } from '@/components/chords/export/exportStyle';
import type { Clip } from './clip';
import { circled, creditsOf, tuningBlock } from './credits';
import { layoutClip, type Parts } from './layout';
import { TabClip, type TabLook } from './TabClip';
import type { BarNumbers } from './viewOptions';

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

export const DEFAULT_TAB_EXPORT: TabExportStyle = { width: 800, transparent: false, name: true };

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
const EXPORT_LOOK: TabLook = { ink: '#000000', line: '#000000', paper: '#ffffff' };
/** Room round the tab, so it doesn't touch the image's edges. */
const PAD = 16;
const TITLE_SIZE = 20;
const TITLE_HEIGHT = 34;
/** The credits' and tuning's lines under the title: their size and the room each takes. */
const CREDIT_SIZE = 12;
const CREDIT_LINE = 17;
/** The tuning's second column of strings, from its first. */
const TUNING_COLUMN = 64;

/** What the image prints over the tab, as a score does: the title and credits (if the name is shown), then the tuning. */
interface HeadLine {
  text: string;
  bold?: boolean;
  /** A second column on the line: the tuning's ④ to ⑥ beside ① to ③. */
  second?: string;
}

function headLines(clip: Clip, style: TabExportStyle, title: string): { title: string; lines: HeadLine[] } {
  const shown = style.name && title.trim() !== '' ? title.trim() : '';
  const lines: HeadLine[] = [];
  if (shown) {
    const { artist, lines: by } = creditsOf(clip);
    if (artist) lines.push({ text: artist, bold: true });
    lines.push(...by.map(text => ({ text })));
  }
  const tuning = tuningBlock(clip.tuning);
  if (tuning) {
    if (tuning.heading) lines.push({ text: tuning.heading });
    const rows = Math.min(3, tuning.strings.length);
    const said = tuning.strings.map(s => `${circled(s.number)} = ${s.name}`);
    for (let r = 0; r < rows; r++) lines.push({ text: said[r], second: said[r + rows] });
  }
  return { title: shown, lines };
}

/** How far down the tab starts: under the name and the lines under it, if any. The tab draws its own capo. */
function headHeight(head: { title: string; lines: HeadLine[] }): number {
  const lines = head.lines.length > 0 ? head.lines.length * CREDIT_LINE + 8 : 0;
  return (head.title ? TITLE_HEIGHT : 0) + lines;
}

/** The image's size in pixels. */
export function tabImageSize(clip: Clip, style: TabExportStyle, title: string, parts: Parts = 'tab'): { width: number; height: number } {
  const tab = layoutClip(clip, style.width - 2 * PAD, parts);
  return { width: style.width, height: tab.height + 2 * PAD + headHeight(headLines(clip, style, title)) - 8 };
}

/**
 * The clip as an image: the page's own `TabClip` in black, with the name
 * above it if the style shows it, on white unless transparent; the staff, the
 * tab or both, as the page shows them. The Export dialog's preview draws the same.
 */
export function TabImage({ clip, style, title, parts = 'tab', barNumbers = 'none' }: { clip: Clip; style: TabExportStyle; title: string; parts?: Parts; barNumbers?: BarNumbers }) {
  const { width, height } = tabImageSize(clip, style, title, parts);
  const head = headLines(clip, style, title);
  const linesTop = PAD + (head.title ? TITLE_HEIGHT : 0);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      fontFamily={FONT_FAMILY} className="tab-image"
    >
      {!style.transparent && <rect width={width} height={height} fill={BACKDROP} />}
      {head.title && (
        <text x={PAD} y={PAD + TITLE_SIZE - 4} fontSize={TITLE_SIZE} fontWeight={700} fill={EXPORT_LOOK.ink}>{head.title}</text>
      )}
      {head.lines.map((line, i) => (
        <text key={i} y={linesTop + i * CREDIT_LINE + CREDIT_SIZE - 2} fontSize={CREDIT_SIZE} fontWeight={line.bold ? 700 : 400} fill={EXPORT_LOOK.ink}>
          <tspan x={PAD}>{line.text}</tspan>
          {line.second && <tspan x={PAD + TUNING_COLUMN}>{line.second}</tspan>}
        </text>
      ))}
      <TabClip
        clip={clip} width={width - 2 * PAD} parts={parts} barNumbers={barNumbers} look={EXPORT_LOOK} title={head.title || 'Tab'}
        x={PAD} y={PAD + headHeight(head) - 8}
      />
    </svg>
  );
}

/** The image as standalone SVG code. */
export function tabSvg(clip: Clip, style: TabExportStyle, title: string, parts: Parts = 'tab', barNumbers: BarNumbers = 'none'): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(TabImage, { clip, style, title, parts, barNumbers })));
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
