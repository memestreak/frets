'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { copySvgAsPng, copySvgCode, svgToPng } from '@/components/chords/export/exportImage';
import { Segmented } from '@/components/controls';
import { HoverTips } from '@/components/HoverTips';
import { CloseIcon } from '@/components/icons';
import { writeAlphaTex } from './alphatex';
import { writeAscii } from './ascii';
import { musicXmlLosses, writeMusicXml } from './musicxml';
import { writeGuitarPro } from './guitarPro';
import { SAVE_KINDS, saveFile, type SaveKind } from './saveFile';
import { partOf, type Clip } from './clip';
import {
  TAB_EXPORT_WIDTHS, TabImage, tabFileName, tabImageSize, tabSvg, type TabExportStyle,
} from './exportTab';
import type { TabView } from './viewOptions';
import type { Parts } from './layout';

const SHOW_HIDE = [['show', 'Show'], ['hide', 'Hide']] as const;
const ON_OFF = [['on', 'On'], ['off', 'Off']] as const;
const WIDTHS = TAB_EXPORT_WIDTHS.map(w => [w, String(w)] as const);

/** The formats the dialog downloads, in the order its Format list shows them. */
export const TAB_EXPORT_FORMATS = ['png', 'svg', 'ascii', 'alphatex', 'musicxml', 'guitarPro'] as const;
export type TabExportFormat = (typeof TAB_EXPORT_FORMATS)[number];

const FORMAT_LABELS: Record<TabExportFormat, string> = {
  png: 'PNG image', svg: 'SVG image', ascii: 'ASCII tab', alphatex: 'alphaTex', musicxml: 'MusicXML', guitarPro: 'Guitar Pro',
};

const isImage = (format: TabExportFormat) => format === 'png' || format === 'svg';

/**
 * The Tab page's Export dialog: a Format list (PNG image, SVG image, ASCII
 * tab, alphaTex, MusicXML, Guitar Pro) and one Download button, which saves
 * the clip in that format through the browser's Save As dialog where it has
 * one, as the card's Save as… list does. Copy, beside it, copies the images
 * and the two text formats; the other two can't be pasted, so it isn't there
 * for them. For the images the dialog also shows the preview with its size
 * in pixels above the list, and under it the image's choices (width,
 * transparent background, the clip's name above the tab or not). A red ⚠
 * before the list says when the file can't
 * hold all of the clip. The images and ASCII tab are of the track the page
 * shows; alphaTex, MusicXML and Guitar Pro hold every track. A line says what
 * happened. The page's Export button opens it, as does the tab's right-click
 * menu, on the format last picked. It stays open after an action; × or Esc
 * close it.
 */
export function TabExportDialog({ clip, track, parts, view, open, style, onStyle, onClose }: {
  /** The whole clip, every track: saved as alphaTex, MusicXML and Guitar Pro; the images and ASCII tab are of the track the page shows. */
  clip: Clip;
  /** The track the page shows. */
  track: number;
  /** What the page shows, which the image draws too: the staff, the tab or both. */
  parts: Parts;
  /** The View options as the page shows them: bar numbers and size for the image, the rhythm line for ASCII. */
  view: TabView;
  open: boolean;
  style: TabExportStyle;
  onStyle: (style: TabExportStyle) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const formatId = useId();
  const [status, setStatus] = useState('');
  // Kept while the page is open, so the dialog opens again on the format last used.
  const [format, setFormat] = useState<TabExportFormat>('png');
  const part = partOf(clip, track);
  // The image's title is the clip's name, shown or hidden by Clip name.
  const title = clip.name;
  // Each opening starts on a blank status line.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStatus('');
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const set = (patch: Partial<TabExportStyle>) => {
    onStyle({ ...style, ...patch });
    setStatus('');
  };
  const fail = (e: unknown) => setStatus(`Couldn't: ${e instanceof Error ? e.message : String(e)}`);
  const svg = () => tabSvg(part, style, title, parts, view);
  const ascii = () => writeAscii(part, { rhythm: view.asciiRhythm });
  const { width, height } = tabImageSize(part, style, title, parts, view);
  const baseName = tabFileName(clip.name);

  /** What each format saves: its kind (name ending, type) and the file. */
  const files: Record<TabExportFormat, { kind: SaveKind; make: () => Blob | Promise<Blob> }> = {
    png: { kind: SAVE_KINDS.png, make: () => svgToPng(svg()) },
    svg: { kind: SAVE_KINDS.svg, make: () => new Blob([svg()], { type: SAVE_KINDS.svg.mime }) },
    ascii: { kind: SAVE_KINDS.ascii, make: () => new Blob([ascii()], { type: SAVE_KINDS.ascii.mime }) },
    alphatex: { kind: SAVE_KINDS.alphatex, make: () => new Blob([writeAlphaTex(clip)], { type: SAVE_KINDS.alphatex.mime }) },
    musicxml: { kind: SAVE_KINDS.musicxml, make: () => new Blob([writeMusicXml(clip)], { type: SAVE_KINDS.musicxml.mime }) },
    guitarPro: {
      kind: SAVE_KINDS.guitarPro,
      make: async () => new Blob([(await writeGuitarPro(clip)) as Uint8Array<ArrayBuffer>], { type: SAVE_KINDS.guitarPro.mime }),
    },
  };
  /** What Copy does for the formats that can be pasted; MusicXML and Guitar Pro have none. */
  const copies: Partial<Record<TabExportFormat, () => Promise<string>>> = {
    png: () => copySvgAsPng(svg()),
    svg: () => copySvgCode(svg()),
    ascii: () => copyText(ascii()),
    alphatex: () => copyText(writeAlphaTex(clip)),
  };
  const copy = copies[format];

  const download = () => {
    const { kind, make } = files[format];
    saveFile(baseName, kind, make).then(line => { if (line) setStatus(line); }, fail);
  };

  const musicXmlLeft = musicXmlLosses(clip);
  // alphaTab reads the alphaTex Frets keeps without drawing, so the Guitar Pro file loses only the FX.
  const lossNote = format === 'musicxml' && musicXmlLeft.length ? `The MusicXML file leaves out ${musicXmlLeft.join(' and ')}.`
    : format === 'guitarPro' && clip.tracks.some(t => t.fx?.on) ? 'The Guitar Pro file leaves out the FX.'
    : null;

  return (
    <dialog
      ref={ref} className="settings-dialog export-dialog tab-export-dialog" aria-labelledby={headingId}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      {/* Its own tips, as the page's are drawn under the open dialog. */}
      {open && (
        <HoverTips>
        <div className="settings-dialog-inner">
          <div className="flex items-center justify-between gap-3">
            <h3 id={headingId} className="dialog-title m-0">Export {clip.name.trim() || 'tab'}</h3>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Close export" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <div className="settings-dialog-body">
            {isImage(format) && (
              <>
                <div className="export-preview" data-testid="export-preview">
                  <TabImage clip={part} style={style} title={title} parts={parts} view={view} />
                </div>
                <p className="export-size" data-testid="export-size">
                  {width} × {height} px, {style.transparent ? 'transparent' : 'on white'}
                </p>
              </>
            )}
            {/* Format first; under it the image's choices, only for PNG and SVG. */}
            <div className="export-choices">
              <label htmlFor={formatId}>Format</label>
              <span className="tab-export-format">
                {lossNote && <span className="tab-sound-note" role="img" aria-label={lossNote} data-tip={lossNote}>⚠</span>}
                <select
                  id={formatId} className="input" value={format}
                  onChange={e => {
                    setFormat(e.target.value as TabExportFormat);
                    setStatus('');
                  }}
                >
                  {TAB_EXPORT_FORMATS.map(f => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
                </select>
              </span>
              {isImage(format) && (
                <>
                  <span>Size<span className="export-unit"> (px wide)</span></span>
                  <Segmented label="Size" value={style.width} onChange={w => set({ width: w })} options={WIDTHS} />
                  <span>Transparent background</span>
                  <Segmented
                    label="Transparent background" value={style.transparent ? 'on' : 'off'}
                    onChange={v => set({ transparent: v === 'on' })} options={ON_OFF}
                  />
                  <span>Clip name</span>
                  <Segmented
                    label="Clip name" value={style.name ? 'show' : 'hide'}
                    onChange={v => set({ name: v === 'show' })} options={SHOW_HIDE}
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-(--ink-muted)" role="status">{status}</span>
            {copy && (
              <button type="button" className="btn btn-secondary" onClick={() => copy().then(setStatus, fail)}>Copy</button>
            )}
            <button type="button" className="btn btn-primary" onClick={download}>Download</button>
          </div>
        </div>
        </HoverTips>
      )}
    </dialog>
  );
}

/** Copies `text`; resolves to the line the dialog shows. */
async function copyText(text: string): Promise<string> {
  await navigator.clipboard.writeText(text);
  return 'Copied as text';
}
