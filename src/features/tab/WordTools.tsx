import type { MouseEvent } from 'react';
import { PencilIcon, TrashIcon } from '@/components/icons';
import type { Clip } from './clip';
import { layoutClip, type Parts } from './layout';
import { textBox, type WordHit } from './layoutText';
import { markBox, type MarkHit } from './marks';
import type { FieldKind } from './WordField';

/*
 * What goes over the drawn tab beside a picked word or mark, and where the fields and panels a press
 * opens go.
 */

/** What a word's field starts with: what is there now. */
export function wordNow(clip: Clip, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): string {
  const b = clip.bars[bar];
  if (kind === 'ending') return b?.ending ? String(b.ending) : '';
  if (kind === 'chord') return b?.columns[column]?.chord ?? '';
  if (kind === 'text') return b?.columns[column]?.text ?? '';
  if (kind === 'section') return b?.section?.text ?? '';
  return clip.capo ? String(clip.capo) : '';
}

/** Where a word's field goes over the drawing: above the spot the word is drawn, kept inside the tab's width. */
export function wordSpot(clip: Clip, width: number, parts: Parts, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): { x: number; y: number } {
  const layout = layoutClip(clip, width, parts);
  // The capo's field fits its caption and a small number box; the others are 180px wide (`.tab-word`).
  const FIELD_WIDTH = kind === 'capo' || kind === 'ending' ? 150 : 180;
  const FIELD_HEIGHT = 64;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const { rows, top } = layout.systems[s];
    const row = { chord: rows.chords, text: rows.text, section: rows.section, capo: rows.capo, ending: rows.endings }[kind];
    const y = top + (row ?? rows.staffTop - 20) - FIELD_HEIGHT;
    // The capo is written at the start of the first line, over the time signature.
    const x = kind === 'chord' || kind === 'text' ? (placed.columns[column]?.x ?? placed.x0) : kind === 'capo' ? 0 : placed.x0 + FIELD_WIDTH / 2;
    return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, y) };
  }
  return { x: FIELD_WIDTH / 2, y: 0 };
}

/**
 * Edit and Delete for a picked word, to its right (Jeremy, 2026-10-27), or its left at the tab's right
 * edge; Delete alone for a picked mark, whose palette tool does the editing.
 */
export function WordTools({ clip, width, parts, hit, onEdit, onDelete }: {
  clip: Clip;
  width: number;
  parts: Parts;
  hit: WordHit | MarkHit;
  onEdit: (() => void) | null;
  onDelete: () => void;
}) {
  const layout = layoutClip(clip, width, parts);
  const box = hit.kind === 'mark' ? markBox(layout, hit) : textBox(layout, hit, clip.capo ?? null);
  if (!box) return null;
  const TOOLS_WIDTH = onEdit ? 58 : 30;
  const GAP = 4;
  const right = box.x + box.width + GAP;
  const left = right + TOOLS_WIDTH <= width ? right : box.x - GAP - TOOLS_WIDTH;
  // The buttons keep the focus on the tab, so the word stays picked and its keys still work.
  const keep = (e: MouseEvent) => e.preventDefault();
  return (
    <span className="tab-word-tools" style={{ left, top: box.y + box.height / 2 - 13 }} data-testid="word-tools">
      {onEdit && (
        <button type="button" className="tab-word-tool" aria-label="Edit" data-tip="Edit (Enter)" onMouseDown={keep} onClick={onEdit}>
          <PencilIcon />
        </button>
      )}
      <button type="button" className="tab-word-tool" aria-label="Delete" data-tip="Delete" onMouseDown={keep} onClick={onDelete}>
        <TrashIcon />
      </button>
    </span>
  );
}

/**
 * Where a later bar's tempo panel goes when the Tempo tool or a picked tempo's Edit opens it: from
 * the bar's start, just under its tempo's row (over the staff when the bar has no tempo yet).
 */
export function barTempoSpot(clip: Clip, width: number, parts: Parts, bar: number): { x: number; y: number } {
  const layout = layoutClip(clip, width, parts);
  for (const { bars, rows, top } of layout.systems) {
    const placed = bars.find(b => b.index === bar);
    if (placed) return { x: placed.x0, y: top + (rows.tempo ?? rows.staffTop - 20) + 12 };
  }
  return { x: 0, y: 0 };
}

/** How far left of a press its signature panel starts, and how far under it. */
export const PANEL_LEAD = 16;
export const PANEL_DROP = 14;

/**
 * Where a bar's time or key signature panel goes when the palette opens it: from the bar's start,
 * under the staff its signatures are drawn on (the notation staff when it is shown). The panel keeps
 * itself inside the tab's width.
 */
export function barTimeSpot(clip: Clip, width: number, parts: Parts, bar: number): { x: number; y: number } {
  const layout = layoutClip(clip, width, parts);
  for (const { bars, rows, top } of layout.systems) {
    const placed = bars.find(b => b.index === bar);
    if (placed) return { x: placed.x0, y: top + (rows.score ? rows.score.bottom : rows.staffBottom) + 12 };
  }
  return { x: 0, y: 0 };
}
