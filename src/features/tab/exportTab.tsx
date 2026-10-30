'use client';

import { createElement, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FONT_FAMILY } from '@/components/chords/export/exportImage';
import { BACKDROP } from '@/components/chords/export/exportStyle';
import type { Part, Tempo } from './clip';
import { creditsOf, HEAD, tuningBlock, type TuningBlock } from './credits';
import { layoutClip, type Parts } from './layout';
import { tempoParts } from './layoutText';
import { TabClip } from './TabClip';
import { TempoNote } from './TempoNote';
import { type TabLook } from './tabLook';
import { DEFAULT_VIEW, laidOut, paletteOf, shownColours, type TabView } from './viewOptions';

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
const EXPORT_LOOK: TabLook = { ink: '#000000', line: '#000000', paper: BACKDROP };

/** The image's colours: the View options' scheme (Jeremy, 2026-10-28), else black on white, not the theme's. */
function exportLook(view: TabView): TabLook {
  const colours = shownColours(view);
  if (!colours) return EXPORT_LOOK;
  const p = paletteOf(colours);
  return { ink: p.ink, line: p.lineStrong, paper: p.paper };
}
/** Room round the tab, so it doesn't touch the image's edges. */
const PAD = 16;

/**
 * What the image prints over the tab, as the page's head (`ScoreHead.tsx`): the title and credits (if
 * the name is shown), then the tuning and the first bar's tempo. Standard tuning and an unset tempo
 * go unsaid, as printed scores leave them.
 */
interface Head {
  title: string;
  artist: string | null;
  credits: string[];
  tuning: TuningBlock | null;
  tempo: Tempo | null;
}

function headOf(clip: Part, style: TabExportStyle, title: string): Head {
  const shown = style.name && title.trim() !== '' ? title.trim() : '';
  const { artist, lines } = creditsOf(clip);
  return { title: shown, artist: shown ? artist : null, credits: shown ? lines : [], tuning: tuningBlock(clip.tuning), tempo: clip.bars[0]?.tempo ?? null };
}

/** The head's height in the drawing's units, as the page's head takes it (its room after included); 0 for none. */
function headHeight(head: Head): number {
  const top = (head.title ? HEAD.titleLine : 0) + (head.artist ? HEAD.artistLine : 0) + head.credits.length * HEAD.creditLine;
  // On the left: the tuning's lines, then the tempo's.
  const left = tuningLines(head.tuning) * HEAD.creditLine + (head.tempo ? HEAD.tempoLine : 0);
  if (top === 0 && left === 0) return 0;
  return 4 + top + (left > 0 ? (top > 0 ? HEAD.gap : 0) + left : 0) + HEAD.gap;
}

/** How many lines the tuning takes: its heading, then up to three rows of strings. */
function tuningLines(tuning: TuningBlock | null): number {
  return tuning ? (tuning.heading ? 1 : 0) + Math.min(3, tuning.strings.length) : 0;
}

/** Where the tab starts under the head, in pixels: the tab's own room over its top line is trimmed when there is no head. */
function headTop(head: Head, zoom: number): number {
  const h = headHeight(head);
  return h > 0 ? Math.ceil(h * zoom) : -8;
}

/** The head as SVG, `width` wide, in the drawing's units. */
function HeadDrawing({ head, width, ink }: { head: Head; width: number; ink: string }) {
  const parts: ReactNode[] = [];
  let y = 4;
  // Each line's text sits on a baseline about four fifths down its line, as the page's lines do.
  const line = (key: string, text: string, size: number, room: number, weight = 400) => {
    parts.push(<text key={key} x={width / 2} y={y + room * 0.5 + size * 0.36} fontSize={size} fontWeight={weight} fill={ink} textAnchor="middle">{text}</text>);
    y += room;
  };
  if (head.title) line('title', head.title, HEAD.titleSize, HEAD.titleLine);
  if (head.artist) line('artist', head.artist, HEAD.artistSize, HEAD.artistLine, 700);
  head.credits.forEach((c, i) => line(`credit-${i}`, c, HEAD.creditSize, HEAD.creditLine));
  if ((head.tuning || head.tempo) && y > 4) y += HEAD.gap;
  if (head.tuning) {
    const { heading, strings } = head.tuning;
    const mid = (k: number) => y + k * HEAD.creditLine + HEAD.creditLine / 2;
    const baseline = (k: number) => mid(k) + HEAD.creditSize * 0.36;
    let k = 0;
    if (heading) parts.push(<text key="tuning-heading" x={HEAD.tuningIndent} y={baseline(k++)} fontSize={HEAD.creditSize} fill={ink}>{heading}</text>);
    const rows = Math.min(3, strings.length);
    strings.forEach((s, i) => {
      const x = HEAD.tuningIndent + Math.floor(i / rows) * HEAD.tuningColumn;
      const row = k + (i % rows);
      // A string's number in a small circle, as the page draws it.
      parts.push(
        <g key={`string-${s.number}`}>
          <circle cx={x + 7} cy={mid(row)} r={6.5} fill="none" stroke={ink} strokeWidth={1} />
          <text x={x + 7} y={mid(row) + 3.2} fontSize={9} fill={ink} textAnchor="middle">{s.number}</text>
          <text x={x + 18} y={baseline(row)} fontSize={HEAD.creditSize} fill={ink}>{`= ${s.name}`}</text>
        </g>,
      );
    });
    y += tuningLines(head.tuning) * HEAD.creditLine;
  }
  if (head.tempo) {
    // As the drawn tab's tempos: its word, the note, then " = 92", in bold; the text's baseline low in the line, under the stem.
    const { noteX, numberX } = tempoParts(head.tempo, HEAD.creditSize);
    const baseline = y + HEAD.tempoLine * 0.5 + HEAD.creditSize * 0.5;
    const x = HEAD.tuningIndent;
    parts.push(
      <g key="tempo" fontSize={HEAD.creditSize} fontWeight={700} fill={ink} data-testid="score-tempo-drawn">
        {head.tempo.label && <text x={x} y={baseline}>{head.tempo.label}</text>}
        <TempoNote x={x + noteX} y={baseline - HEAD.creditSize * 0.18} size={HEAD.creditSize} ink={ink} />
        <text x={x + numberX} y={baseline}>{` = ${head.tempo.bpm}`}</text>
      </g>,
    );
  }
  return <g data-testid="score-head-drawn">{parts}</g>;
}

/** The image's size in pixels. */
export function tabImageSize(clip: Part, style: TabExportStyle, title: string, parts: Parts = 'tab', view: TabView = DEFAULT_VIEW): { width: number; height: number } {
  const zoom = view.size / 100;
  const tab = layoutClip(laidOut(clip, view), (style.width - 2 * PAD) / zoom, parts);
  return { width: style.width, height: Math.ceil(tab.height * zoom) + 2 * PAD + headTop(headOf(clip, style, title), zoom) };
}

/**
 * The clip as an image: the page's own `TabClip` in black, under the score's head as the page draws
 * it (the title only if the style shows the name), on white unless transparent; the staff, the tab or
 * both, as the page shows them, at the View options' size. The Export dialog's preview draws the same.
 */
export function TabImage({ clip, style, title, parts = 'tab', view = DEFAULT_VIEW }: { clip: Part; style: TabExportStyle; title: string; parts?: Parts; view?: TabView }) {
  const { width, height } = tabImageSize(clip, style, title, parts, view);
  // At a View options size the tab and its head are drawn bigger or smaller, so as many bars fit a line as on the page.
  const zoom = view.size / 100;
  const head = headOf(clip, style, title);
  const inner = (width - 2 * PAD) / zoom;
  const look = exportLook(view);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      fontFamily={FONT_FAMILY} className="tab-image"
    >
      {!style.transparent && <rect width={width} height={height} fill={look.paper} />}
      <g transform={`translate(${PAD} ${PAD}) scale(${zoom})`}>
        <HeadDrawing head={head} width={inner} ink={look.ink} />
      </g>
      <TabClip
        clip={laidOut(clip, view)} width={inner} zoom={zoom} parts={parts} barNumbers={view.barNumbers} look={look} title={head.title || 'Tab'}
        x={PAD} y={PAD + headTop(head, zoom)}
      />
    </svg>
  );
}

/** The image as standalone SVG code. */
export function tabSvg(clip: Part, style: TabExportStyle, title: string, parts: Parts = 'tab', view: TabView = DEFAULT_VIEW): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(TabImage, { clip, style, title, parts, view })));
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
