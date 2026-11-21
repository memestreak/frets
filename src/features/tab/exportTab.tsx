'use client';

import { createElement, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FONT_FAMILY } from '@/components/chords/export/exportImage';
import { BACKDROP } from '@/components/chords/export/exportStyle';
import type { Clip, Column, Part, Tempo } from './clip';
import { creditsOf, HEAD, shownTuning, tuningBlock, withCapo, type TuningBlock } from './credits';
import { layoutClip, type LeftOut, type Parts } from './layout';
import { tempoParts } from './layoutText';
import { without } from './editing';
import { TabClip } from './TabClip';
import { CHART_GAP, chartDrawing } from './ChordChart';
import { chartChords, layoutChart } from './chordDiagrams';
import { TempoNote } from './TempoNote';
import { type TabLook } from './tabLook';
import { DEFAULT_VIEW, laidOut, paletteOf, shownColours, type TabView } from './viewOptions';

export const TAB_EXPORT_KEY = 'frets.tab.export';

/** The Export dialog's choices, saved; the menu's Copy as PNG uses them too. */
export interface TabExportStyle {
  /** How wide the image is, in pixels; the tab wraps onto more lines to fit. */
  width: TabExportWidth;
  /** Background: Transparent, nothing behind the tab; otherwise White, as the preview shows it. */
  transparent: boolean;
  /** The clip's name above the tab. */
  name: boolean;
  /**
   * The images' bar numbers: as the arrangement numbers them (an image of bars 9–12 reads 9 to 12), from 1,
   * or none. Shown as the View options draw them unless None here.
   */
  barNumbers: ExportBarNumbers;
  /**
   * An image of the tab alone draws its time signatures, "TAB" at each line's start, and its rhythm (stems,
   * beams, flags, dots, tuplet numbers and rests) under the strings; the staff always has all three.
   */
  timeSignatures: boolean;
  tabLetters: boolean;
  rhythm: boolean;
  /** The images draw a chord diagram under each chord name over the notes; off, the names alone. */
  chordDiagrams: boolean;
  /** Text annotations, in every format. */
  texts: boolean;
  /** Selected bars start with the key, time signature (with its Beat groups) and tempo in force there; off, only what their first bar sets itself. */
  startKey: boolean;
  startTime: boolean;
  startTempo: boolean;
}

export const EXPORT_BAR_NUMBERS = ['arrangement', 'one', 'none'] as const;
export type ExportBarNumbers = (typeof EXPORT_BAR_NUMBERS)[number];
export const EXPORT_BAR_NUMBER_NAMES: Record<ExportBarNumbers, string> = { arrangement: 'From arrangement', one: 'From 1', none: 'None' };

export const TAB_EXPORT_WIDTHS = [480, 640, 800, 1000, 1200] as const;
export type TabExportWidth = (typeof TAB_EXPORT_WIDTHS)[number];

export const DEFAULT_TAB_EXPORT: TabExportStyle = {
  width: 800, transparent: false, name: true, barNumbers: 'arrangement', timeSignatures: true, tabLetters: true, rhythm: true, chordDiagrams: false, texts: true,
  startKey: true, startTime: true, startTempo: true,
};

/** Saved choices, with a default for any field missing or invalid. */
export function parseTabExportStyle(raw: unknown): TabExportStyle {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_TAB_EXPORT;
  return {
    width: TAB_EXPORT_WIDTHS.find(w => w === o.width) ?? d.width,
    transparent: typeof o.transparent === 'boolean' ? o.transparent : d.transparent,
    name: typeof o.name === 'boolean' ? o.name : d.name,
    barNumbers: EXPORT_BAR_NUMBERS.find(b => b === o.barNumbers) ?? d.barNumbers,
    timeSignatures: typeof o.timeSignatures === 'boolean' ? o.timeSignatures : d.timeSignatures,
    tabLetters: typeof o.tabLetters === 'boolean' ? o.tabLetters : d.tabLetters,
    rhythm: typeof o.rhythm === 'boolean' ? o.rhythm : d.rhythm,
    chordDiagrams: typeof o.chordDiagrams === 'boolean' ? o.chordDiagrams : d.chordDiagrams,
    texts: typeof o.texts === 'boolean' ? o.texts : d.texts,
    startKey: typeof o.startKey === 'boolean' ? o.startKey : d.startKey,
    startTime: typeof o.startTime === 'boolean' ? o.startTime : d.startTime,
    startTempo: typeof o.startTempo === 'boolean' ? o.startTempo : d.startTempo,
  };
}

/**
 * The View options an image is drawn with: the page's, with no bar numbers when the Export choices say
 * None, and chord diagrams over the notes as the Export choices say, whatever the page shows.
 */
export function exportView(view: TabView, style: TabExportStyle): TabView {
  return { ...view, barNumbers: style.barNumbers === 'none' ? 'none' : view.barNumbers, chordDiagrams: style.chordDiagrams };
}

/** What an image of the tab alone leaves out by the Export choices; the layout ignores it with the staff. */
const leftOutOf = (style: TabExportStyle): LeftOut => ({
  timeSignatures: !style.timeSignatures, tabLetters: !style.tabLetters, rhythm: !style.rhythm,
});

/** The columns with no text annotation. */
const untexted = <T extends { columns: Column[] }>(bar: T): T =>
  bar.columns.some(c => c.text !== undefined) ? { ...bar, columns: bar.columns.map(c => (c.text === undefined ? c : without(c, 'text'))) } : bar;

/** The part as an image draws it: laid out as the view has it, and without its text annotations when the Export choices leave them out. */
function imageClip(clip: Part, style: TabExportStyle, view: TabView): Part {
  const shown = laidOut(clip, view);
  if (style.texts) return shown;
  return { ...shown, bars: shown.bars.map(bar => untexted({ ...bar, otherVoices: bar.otherVoices?.map(untexted) })) };
}

/** The whole clip without its text annotations when the Export choices leave them out: what the files hold. */
export function exportedClip(clip: Clip, style: Pick<TabExportStyle, 'texts'>): Clip {
  if (style.texts) return clip;
  const strip = (columns: Column[]) => untexted({ columns }).columns;
  return { ...clip, tracks: clip.tracks.map(track => ({ ...track, bars: track.bars.map(bar => ({ ...bar, voices: bar.voices.map(strip) })) })) };
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
 * the name is shown), then the tuning (its name only, its details collapsed) with the capo, and the first bar's tempo. Standard tuning and an unset tempo
 * go unsaid, as printed scores leave them.
 */
interface Head {
  title: string;
  artist: string | null;
  credits: string[];
  tuning: TuningBlock | null;
  tempo: Tempo | null;
}

function headOf(clip: Part, style: TabExportStyle, title: string, view: TabView, excerpt: boolean): Head {
  const shown = style.name && title.trim() !== '' ? title.trim() : '';
  // Some bars: the name alone, if shown; never the credits, tuning or tempo (Jeremy, 2026-11-21).
  if (excerpt) return { title: shown, artist: null, credits: [], tuning: null, tempo: null };
  const { artist, lines } = creditsOf(clip);
  // The tuning as the page shows it: its name only when its details are collapsed (issue #296).
  // The capo after the tuning's name; in standard tuning, which goes unsaid, "Capo 4th fret" alone (issue #463).
  const tuning = withCapo(shownTuning(tuningBlock(clip.tuning), view.tuningDetails), clip.capo);
  return { title: shown, artist: shown ? artist : null, credits: shown ? lines : [], tuning, tempo: clip.bars[0]?.tempo ?? null };
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
export function tabImageSize(clip: Part, style: TabExportStyle, title: string, parts: Parts = 'tab', view: TabView = DEFAULT_VIEW, excerpt = false): { width: number; height: number } {
  const zoom = view.size / 100;
  const inner = (style.width - 2 * PAD) / zoom;
  const tab = layoutClip(imageClip(clip, style, view), inner, parts, view.chordDiagrams, false, leftOutOf(style));
  return { width: style.width, height: Math.ceil(tab.height * zoom) + 2 * PAD + headTop(headOf(clip, style, title, view, excerpt), zoom) + chartRoom(clip, inner, view, zoom, excerpt) };
}

/** The Chord chart's chords, as the page shows it under the head (issue #242); none when off, or for some bars. */
const chartOf = (clip: Part, view: TabView, excerpt: boolean) => (view.chordChart && !excerpt ? chartChords(clip) : []);

/** The room the Chord chart takes under the head, in pixels: none without one. */
function chartRoom(clip: Part, inner: number, view: TabView, zoom: number, excerpt: boolean): number {
  const chords = chartOf(clip, view, excerpt);
  return chords.length > 0 ? Math.ceil((layoutChart(chords, inner).height + CHART_GAP) * zoom) : 0;
}

/**
 * The clip as an image: the page's own `TabClip` in black, under the score's head as the page draws
 * it (the title only if the style shows the name), on white unless transparent; the staff, the tab or
 * both, as the page shows them, at the page's Size. The Export dialog's preview draws the same.
 * An `excerpt` (some bars) has no head but the name, and no Chord chart.
 */
export function TabImage({ clip, style, title, parts = 'tab', view = DEFAULT_VIEW, excerpt = false }: {
  clip: Part; style: TabExportStyle; title: string; parts?: Parts; view?: TabView; excerpt?: boolean;
}) {
  const { width, height } = tabImageSize(clip, style, title, parts, view, excerpt);
  // At a Size other than 100% the tab and its head are drawn bigger or smaller, so as many bars fit a line as on the page.
  const zoom = view.size / 100;
  const head = headOf(clip, style, title, view, excerpt);
  const inner = (width - 2 * PAD) / zoom;
  const look = exportLook(view);
  const top = headTop(head, zoom);
  const chords = chartOf(clip, view, excerpt);
  const chart = chords.length > 0 ? chartDrawing(chords, inner, look) : null;
  // Under a head the chart starts where the tab would; with none, at the top.
  const chartTop = Math.max(0, top);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      fontFamily={FONT_FAMILY} className="tab-image"
    >
      {!style.transparent && <rect width={width} height={height} fill={look.paper} />}
      <g transform={`translate(${PAD} ${PAD}) scale(${zoom})`}>
        <HeadDrawing head={head} width={inner} ink={look.ink} />
      </g>
      {chart && <g transform={`translate(${PAD} ${PAD + chartTop}) scale(${zoom})`}>{chart.drawing}</g>}
      <TabClip
        clip={imageClip(clip, style, view)} leftOut={leftOutOf(style)} width={inner} zoom={zoom} parts={parts} barNumbers={view.barNumbers} look={look} title={head.title || 'Tab'}
        x={PAD} y={PAD + top + chartRoom(clip, inner, view, zoom, excerpt)} chordDiagrams={view.chordDiagrams}
      />
    </svg>
  );
}

/** The image as standalone SVG code. */
export function tabSvg(clip: Part, style: TabExportStyle, title: string, parts: Parts = 'tab', view: TabView = DEFAULT_VIEW, excerpt = false): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(TabImage, { clip, style, title, parts, view, excerpt })));
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
