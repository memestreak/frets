'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { Segmented } from '@/components/controls';
import { CloseIcon } from '@/components/icons';
import { voicingCaption } from '@/lib/chords/voicings';
import { copyPng, copySvg, download, type ExportShape } from './exportImage';
import { exportLook, type ExportStyle } from './exportStyle';

interface ExportDialogProps {
  /** The shape to export, with its deduced name; the dialog is open while there is one. */
  shape: ExportShape | null;
  style: ExportStyle;
  onStyle: (style: ExportStyle) => void;
  onClose: () => void;
}

const SHOW_HIDE = [['show', 'Show'], ['hide', 'Hide']] as const;
const HIDE_SHOW = [['hide', 'Hide'], ['show', 'Show']] as const;
const showHide = (on: boolean) => (on ? 'show' : 'hide');

/**
 * The Export dialog, on the native modal `<dialog>`: a preview of the image
 * as it will be, the four choices, the name to print (the deduced name,
 * which can be edited for this export), and Copy PNG, Copy SVG, Download
 * PNG and Download SVG, with a line saying what happened. It stays open
 * after an action; Done, × or Esc close it.
 */
export function ExportDialog({ shape, style, onStyle, onClose }: ExportDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const nameId = useId();
  const [status, setStatus] = useState('');
  // The last shape shown, so the content doesn't vanish while the dialog
  // closes; a new one brings its own name back.
  const [shown, setShown] = useState(shape);
  const [name, setName] = useState(shape?.name ?? '');
  if (shape && shape !== shown) {
    setShown(shape);
    setName(shape.name);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shape && !el.open) {
      setStatus('');
      el.showModal();
    } else if (!shape && el.open) el.close();
  }, [shape]);

  const set = (patch: Partial<ExportStyle>) => {
    onStyle({ ...style, ...patch });
    setStatus('');
  };
  const run = (action: (named: ExportShape) => Promise<string>) => {
    if (!shown) return;
    action({ ...shown, name }).then(setStatus, (e: unknown) => {
      setStatus(`Couldn't: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  return (
    <dialog
      ref={ref} className="settings-dialog export-dialog" aria-labelledby={headingId}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (shape) onClose();
      }}
    >
      {shown && (
        <div className="settings-dialog-inner">
          <div className="flex items-center justify-between gap-3">
            <h3 id={headingId} className="dialog-title m-0">
              Export {shown.name || 'shape'}, {voicingCaption(shown.voicing)}
            </h3>
            <button
              type="button" className="btn btn-ghost btn-icon" aria-label="Close export"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="settings-dialog-body">
            <div
              className={`export-preview export-preview-${style.background}`}
              data-testid="export-preview"
            >
              <ChordDiagram
                chord={shown.chord} voicing={shown.voicing} look={exportLook(style, name)}
              />
            </div>
            <div className="export-choices">
              <span>Colours</span>
              <Segmented
                label="Colours" value={style.colours} onChange={colours => set({ colours })}
                options={[['mono', 'Black & white'], ['degrees', 'Degree colours']]}
              />
              <span>Background</span>
              <Segmented
                label="Background" value={style.background}
                onChange={background => set({ background })}
                options={[['light', 'Light'], ['dark', 'Dark']]}
              />
              <span>Intervals</span>
              <Segmented
                label="Intervals" value={showHide(style.intervals)}
                onChange={v => set({ intervals: v === 'show' })} options={HIDE_SHOW}
              />
              <span>Chord name</span>
              <Segmented
                label="Chord name" value={showHide(style.name)}
                onChange={v => set({ name: v === 'show' })} options={SHOW_HIDE}
              />
              <label htmlFor={nameId}>Name</label>
              <input
                id={nameId} type="text" className="input export-name" aria-label="Name"
                value={name} placeholder="No name" disabled={!style.name}
                autoComplete="off" spellCheck={false}
                onChange={e => {
                  setName(e.target.value);
                  setStatus('');
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => run(s => copyPng(s, style))}>
              Copy PNG
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => run(s => copySvg(s, style))}>
              Copy SVG
            </button>
            <button
              type="button" className="btn btn-ghost"
              onClick={() => run(s => download('png', s, style))}
            >
              Download PNG
            </button>
            <button
              type="button" className="btn btn-ghost"
              onClick={() => run(s => download('svg', s, style))}
            >
              Download SVG
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-(--ink-muted)" role="status">{status}</span>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
