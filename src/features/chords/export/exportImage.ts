import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import type { ChordInfo } from '@/lib/chords/chordTypes';
import { voicingKey, type Voicing } from '@/lib/chords/voicings';
import { exportLook, type ExportStyle } from './exportStyle';

/** What gets exported: a shape of a chord, and the name it goes by. */
export interface ExportShape {
  chord: ChordInfo;
  voicing: Voicing;
  /** The deduced name, or the one typed in the Export dialog; may be empty. */
  name: string;
}

/** The PNG is this many times the diagram's size in SVG units. */
export const PNG_SCALE = 4;

const FONT_FAMILY = 'Figtree, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
/** The app's own Figtree, embedded in the PNG so its text looks the same everywhere. */
const FIGTREE_URL = new URL('../../../app/fonts/figtree-latin.woff2', import.meta.url);

/**
 * One shape as a standalone SVG: the page's `ChordDiagram`, drawn with
 * concrete colours, sized in its own units, transparent behind.
 */
export function diagramSvg({ chord, voicing, name }: ExportShape, style: ExportStyle): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => {
    root.render(createElement(ChordDiagram, { chord, voicing, look: exportLook(style, name) }));
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
export function exportFileName({ voicing, name }: ExportShape): string {
  return `${name.trim() || 'Chord'} ${voicingKey(voicing)}`.replace(/[\\/:*?"<>|]/g, '_');
}

/** Copies the shape as a PNG; resolves to the line the page shows. */
export async function copyPng(shape: ExportShape, style: ExportStyle): Promise<string> {
  // The PNG goes in as a promise, so Safari still counts the click as the gesture.
  const png = svgToPng(diagramSvg(shape, style));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  return 'Copied as PNG';
}

/**
 * Copies the shape as an SVG image where the browser takes one (Chrome,
 * Edge), and otherwise as SVG code, which design tools paste as vectors.
 */
export async function copySvg(shape: ExportShape, style: ExportStyle): Promise<string> {
  const svg = diagramSvg(shape, style);
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

/** A shape's PNG, drawn before it is dragged. */
interface DragImage {
  file: File;
  /** For pages that take an `<img>`, such as a document. */
  dataUrl: string;
  /** For Chrome and Edge's drop onto the desktop. */
  url: string;
}

/** Shapes drawn lately; the oldest go once there are more. */
const DRAG_CACHE_SIZE = 12;
const dragImages = new Map<string, DragImage>();
const drawing = new Set<string>();

const dragKey = (shape: ExportShape, style: ExportStyle) =>
  `${shape.chord.symbol}|${exportFileName(shape)}|${JSON.stringify(style)}`;

const dataUrlOf = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/**
 * Draws the shape's PNG ahead of a drag. A drag must carry its data the
 * moment it starts, and the PNG takes a moment, so the page calls this
 * when the pointer comes over a diagram.
 */
export async function prepareDrag(shape: ExportShape, style: ExportStyle): Promise<void> {
  const key = dragKey(shape, style);
  if (dragImages.has(key) || drawing.has(key)) return;
  drawing.add(key);
  try {
    const png = await svgToPng(diagramSvg(shape, style));
    const file = new File([png], `${exportFileName(shape)}.png`, { type: 'image/png' });
    dragImages.set(key, { file, dataUrl: await dataUrlOf(png), url: URL.createObjectURL(png) });
    for (const [old, image] of dragImages) {
      if (dragImages.size <= DRAG_CACHE_SIZE) break;
      URL.revokeObjectURL(image.url);
      dragImages.delete(old);
    }
  } catch {
    // The drag then carries the SVG.
  } finally {
    drawing.delete(key);
  }
}

/**
 * Fills a drag with the shape: the PNG drawn by `prepareDrag` (or, if it
 * isn't ready, the SVG) as an image for pages and apps, as a file for web
 * pages that take files, and, in Chrome and Edge, as a file for the
 * desktop. A text field gets the file name.
 */
export function fillDragData(data: DataTransfer, shape: ExportShape, style: ExportStyle): void {
  const name = exportFileName(shape);
  const image = dragImages.get(dragKey(shape, style));
  const alt = (shape.name.trim() || 'Chord').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
  data.effectAllowed = 'copy';
  data.setData('text/plain', name);
  if (image) {
    data.setData('text/html', `<img src="${image.dataUrl}" alt="${alt}">`);
    data.setData('DownloadURL', `image/png:${image.file.name}:${image.url}`);
    data.items.add(image.file);
  } else {
    const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagramSvg(shape, style))}`;
    data.setData('text/html', `<img src="${svg}" alt="${alt}">`);
    data.setData('DownloadURL', `image/svg+xml:${name}.svg:${svg}`);
  }
}

/** Saves the shape as a PNG or SVG file. */
export async function download(
  format: 'png' | 'svg', shape: ExportShape, style: ExportStyle,
): Promise<string> {
  const svg = diagramSvg(shape, style);
  const blob = format === 'png' ? await svgToPng(svg) : new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${exportFileName(shape)}.${format}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return `Downloaded ${a.download}`;
}
