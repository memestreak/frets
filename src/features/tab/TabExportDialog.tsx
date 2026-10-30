'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { copySvgAsPng, copySvgCode, downloadSvg } from '@/components/chords/export/exportImage';
import { Segmented } from '@/components/controls';
import { HoverTips } from '@/components/HoverTips';
import { CloseIcon } from '@/components/icons';
import { writeAlphaTex } from './alphatex';
import { writeAscii } from './ascii';
import { musicXmlLosses, writeMusicXml } from './musicxml';
import { SAVE_KINDS } from './saveFile';
import { partOf, type Clip } from './clip';
import { writeGuitarPro } from './guitarPro';
import {
  TAB_EXPORT_WIDTHS, TabImage, tabFileName, tabImageSize, tabSvg, type TabExportStyle,
} from './exportTab';
import type { TabView } from './viewOptions';
import type { Parts } from './layout';

const SHOW_HIDE = [['show', 'Show'], ['hide', 'Hide']] as const;
const ON_OFF = [['on', 'On'], ['off', 'Off']] as const;
const WIDTHS = TAB_EXPORT_WIDTHS.map(w => [w, String(w)] as const);

/**
 * The Tab page's Export dialog, as the Chords page's: a preview of the
 * image as it will be with its size in pixels, the choices (width,
 * transparent, the name above the tab and what it says), and Copy PNG,
 * Copy SVG, Download PNG and Download SVG, then the clip in other formats
 * (Download alphaTex, Download ASCII, Download MusicXML and Download Guitar Pro,
 * each of the last two with a red ⚠ after it when the file can't hold all of the
 * clip), with a line saying what happened. The page's
 * Export button opens it, as does the tab's right-click menu. The name
 * starts as the clip's and can be changed for this export. It stays open
 * after an action; Done, × or Esc close it.
 */
export function TabExportDialog({ clip, track, parts, view, open, style, onStyle, onClose }: {
  /** The whole clip, every track: downloaded as alphaTex, MusicXML and Guitar Pro; the images and ASCII tab are of the track the page shows. */
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
  const nameId = useId();
  const [status, setStatus] = useState('');
  const part = partOf(clip, track);
  const [title, setTitle] = useState(clip.name);
  // Each opening starts on the clip's own name and a blank status line.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(clip.name);
      setStatus('');
    }
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
  const run = (action: (svg: string) => Promise<string>) => {
    action(tabSvg(part, style, title, parts, view)).then(setStatus, (e: unknown) => {
      setStatus(`Couldn't: ${e instanceof Error ? e.message : String(e)}`);
    });
  };
  const { width, height } = tabImageSize(part, style, title, parts, view);
  const fileName = tabFileName(title || clip.name);
  const losses = musicXmlLosses(clip);
  const lossNote = losses.length ? `The MusicXML file leaves out ${losses.join(' and ')}.` : null;
  // alphaTab reads the alphaTex Frets keeps without drawing, so the Guitar Pro file loses only the FX.
  const gpLossNote = clip.tracks.some(t => t.fx?.on) ? 'The Guitar Pro file leaves out the FX.' : null;

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
            <div className="export-preview" data-testid="export-preview">
              <TabImage clip={part} style={style} title={title} parts={parts} view={view} />
            </div>
            <p className="export-size" data-testid="export-size">
              {width} × {height} px, {style.transparent ? 'transparent' : 'on white'}
            </p>
            <div className="export-choices">
              <span>Size<span className="export-unit"> (px wide)</span></span>
              <Segmented label="Size" value={style.width} onChange={w => set({ width: w })} options={WIDTHS} />
              <span>Transparent</span>
              <Segmented
                label="Transparent" value={style.transparent ? 'on' : 'off'}
                onChange={v => set({ transparent: v === 'on' })} options={ON_OFF}
              />
              <span>Clip name</span>
              <Segmented
                label="Clip name" value={style.name ? 'show' : 'hide'}
                onChange={v => set({ name: v === 'show' })} options={SHOW_HIDE}
              />
              <label htmlFor={nameId}>Name</label>
              <input
                id={nameId} type="text" className="input export-name" aria-label="Name"
                value={title} placeholder="No name" disabled={!style.name}
                autoComplete="off" spellCheck={false}
                onChange={e => {
                  setTitle(e.target.value);
                  setStatus('');
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => run(copySvgAsPng)}>Copy PNG</button>
            <button type="button" className="btn btn-secondary" onClick={() => run(copySvgCode)}>Copy SVG</button>
            <button type="button" className="btn btn-ghost" onClick={() => run(svg => downloadSvg('png', svg, fileName))}>
              Download PNG
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => run(svg => downloadSvg('svg', svg, fileName))}>
              Download SVG
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tab-export-text-label">Other formats</span>
            <button type="button" className="btn btn-ghost" onClick={() => setStatus(downloadText(`${fileName}.alphatex.txt`, writeAlphaTex(clip)))}>
              Download alphaTex
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStatus(downloadText(`${fileName}.txt`, writeAscii(part, { rhythm: view.asciiRhythm })))}>
              Download ASCII
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStatus(downloadText(`${fileName}.musicxml`, writeMusicXml(clip), SAVE_KINDS.musicxml.mime))}>
              Download MusicXML
            </button>
            {lossNote && <span className="tab-sound-note" role="img" aria-label={lossNote} data-tip={lossNote}>⚠</span>}
            <button
              type="button" className="btn btn-ghost"
              onClick={() => {
                writeGuitarPro(clip).then(
                  bytes => setStatus(download(`${fileName}.gp`, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: SAVE_KINDS.guitarPro.mime }))),
                  (e: unknown) => setStatus(`Couldn't: ${e instanceof Error ? e.message : String(e)}`),
                );
              }}
            >
              Download Guitar Pro
            </button>
            {gpLossNote && <span className="tab-sound-note" role="img" aria-label={gpLossNote} data-tip={gpLossNote}>⚠</span>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-(--ink-muted)" role="status">{status}</span>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>
          </div>
        </div>
        </HoverTips>
      )}
    </dialog>
  );
}

/** Saves `text` as a file (plain text unless `type` says otherwise); returns the line the dialog shows. */
function downloadText(fileName: string, text: string, type = 'text/plain'): string {
  return download(fileName, new Blob([text], { type }));
}

/** Downloads `blob` as `fileName`; returns the line the dialog shows. */
function download(fileName: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Downloaded ${fileName}`;
}
