import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import type { ChordInfo } from '@/lib/chords/chordTypes';
import { voicingKey, type Voicing } from '@/lib/chords/voicings';
import { exportLook, type ExportStyle } from './exportStyle';

/** The PNG is this many times the diagram's size in SVG units. */
export const PNG_SCALE = 4;

const FONT_FAMILY = 'Figtree, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
/** The app's own Figtree, embedded in the PNG so its text looks the same everywhere. */
const FIGTREE_URL = new URL('../../../app/fonts/figtree-latin.woff2', import.meta.url);

/**
 * One shape as a standalone SVG: the page's `ChordDiagram`, drawn with
 * concrete colours, sized in its own units, transparent behind.
 */
export function diagramSvg(chord: ChordInfo, voicing: Voicing, style: ExportStyle): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => {
    root.render(createElement(ChordDiagram, { chord, voicing, look: exportLook(style, chord) }));
  });
  const svg = host.querySelector('svg')!;
  root.unmount();
  const [, , width, height] = svg.getAttribute('viewBox')!.split(' ');
  for (const attr of ['class', 'aria-hidden', 'focusable']) svg.removeAttribute(attr);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('font-family', FONT_FAMILY);
  // The serializer adds the SVG namespace itself.
  return new XMLSerializer().serializeToString(svg);
}

let fontCss: Promise<string> | null = null;

/** An @font-face rule carrying Figtree as a data URL; empty if it can't be fetched. */
function embeddedFont(): Promise<string> {
  fontCss ??= fetch(FIGTREE_URL)
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(
        `@font-face{font-family:Figtree;font-weight:400 700;src:url(${String(reader.result)}) format("woff2")}`,
      );
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))
    .catch(() => '');
  return fontCss;
}

/** The SVG drawn at `PNG_SCALE`×, transparent wherever nothing is drawn. */
export async function svgToPng(svg: string): Promise<Blob> {
  const css = await embeddedFont();
  const withFont = css ? svg.replace(/^<svg[^>]*>/, open => `${open}<style>${css}</style>`) : svg;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withFont)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth * PNG_SCALE;
  canvas.height = img.naturalHeight * PNG_SCALE;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => (blob ? resolve(blob) : reject(new Error('the image could not be drawn'))),
    'image/png',
  ));
}

/** "Am7 x-0-2-0-1-0", safe as a file name. */
export function exportFileName(chord: ChordInfo, voicing: Voicing): string {
  return `${chord.symbol || 'Chord'} ${voicingKey(voicing)}`.replace(/[\\/:*?"<>|]/g, '_');
}

/** Copies the shape as a PNG; resolves to the line the page shows. */
export async function copyPng(chord: ChordInfo, voicing: Voicing, style: ExportStyle): Promise<string> {
  // The PNG goes in as a promise, so Safari still counts the click as the gesture.
  const png = svgToPng(diagramSvg(chord, voicing, style));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  return 'Copied as PNG';
}

/**
 * Copies the shape as an SVG image where the browser takes one (Chrome,
 * Edge), and otherwise as SVG code, which design tools paste as vectors.
 */
export async function copySvg(chord: ChordInfo, voicing: Voicing, style: ExportStyle): Promise<string> {
  const svg = diagramSvg(chord, voicing, style);
  if (typeof ClipboardItem !== 'undefined' && ClipboardItem.supports?.('image/svg+xml')) {
    await navigator.clipboard.write([new ClipboardItem({
      'image/svg+xml': new Blob([svg], { type: 'image/svg+xml' }),
      'text/plain': new Blob([svg], { type: 'text/plain' }),
    })]);
    return 'Copied as SVG';
  }
  await navigator.clipboard.writeText(svg);
  return 'Copied the SVG code';
}

/** Saves the shape as a PNG or SVG file. */
export async function download(
  format: 'png' | 'svg', chord: ChordInfo, voicing: Voicing, style: ExportStyle,
): Promise<string> {
  const svg = diagramSvg(chord, voicing, style);
  const blob = format === 'png' ? await svgToPng(svg) : new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${exportFileName(chord, voicing)}.${format}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return `Downloaded ${a.download}`;
}
