import type { Part } from './clip';
import { type Layout } from './layout';
import { textRowOf } from './rows';
import type { FieldKind } from './WordField';
import { SECTION_LINE } from './sectionText';

/*
 * Where the fields and panels that a press, a key or a picked word's menu opens go over the drawn tab.
 * Each takes the tab's layout as the page drew it, so nothing is laid out again.
 */

/** What a word's field starts with: what is there now. */
export function wordNow(clip: Part, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): string {
  const b = clip.bars[bar];
  if (kind === 'ending') return b?.ending ? String(b.ending) : '';
  if (kind === 'repeat') return String(b?.repeatEnd ?? 2);
  if (kind === 'chord') return b?.columns[column]?.chord ?? '';
  if (kind === 'text') return b?.columns[column]?.text ?? '';
  if (kind === 'section') return b?.section?.text ?? '';
  return clip.capo ? String(clip.capo) : '';
}

/** Where a word's field goes over the drawing: above the spot the word is drawn, kept inside the tab's width. */
export function wordSpot(layout: Layout, width: number, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): { x: number; y: number } {
  // The capo's field fits its caption and a small number box; the others are 180px wide (`.tab-word`).
  const FIELD_WIDTH = kind === 'capo' || kind === 'ending' || kind === 'repeat' ? 150 : 180;
  const FIELD_HEIGHT = 64;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const { rows, top } = layout.systems[s];
    // A short text's field opens over it, under the chord names; a new text's over the names.
    const spot = placed.columns[column];
    const text = spot?.column.text ? textRowOf(rows, spot) : rows.text;
    const row = { chord: rows.chords, text, section: rows.section, capo: rows.capo, ending: rows.endings, repeat: rows.endings }[kind];
    // A section moved up clear of another opens its field over where it is drawn (issue #389).
    const raised = kind === 'section' ? placed.sectionTop * SECTION_LINE : 0;
    const y = top + (row ?? rows.staffTop - 20) + raised - FIELD_HEIGHT;
    // The capo is written at the start of the first line, over the time signature.
    // A repeat's count is written over the bar's end.
    const x = kind === 'chord' || kind === 'text' ? (placed.columns[column]?.x ?? placed.x0) : kind === 'capo' ? 0
      : kind === 'repeat' ? placed.x1 - FIELD_WIDTH / 2 : placed.x0 + FIELD_WIDTH / 2;
    return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, y) };
  }
  return { x: FIELD_WIDTH / 2, y: 0 };
}

/**
 * Where a later bar's tempo panel goes when the Tempo tool or a picked tempo's Edit opens it: from
 * the bar's start, just under its tempo's row (over the staff when the bar has no tempo yet).
 */
export function barTempoSpot(layout: Layout, bar: number): { x: number; y: number } {
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
export function barTimeSpot(layout: Layout, bar: number): { x: number; y: number } {
  for (const { bars, rows, top } of layout.systems) {
    const placed = bars.find(b => b.index === bar);
    if (placed) return { x: placed.x0, y: top + (rows.score ? rows.score.bottom : rows.staffBottom) + 12 };
  }
  return { x: 0, y: 0 };
}

/** Where the Tuplet panel `;` opens goes (step 6, Q16): just under the cursor's column on the tab. */
export function cursorSpot(layout: Layout, at: { bar: number; column: number }): { x: number; y: number } {
  for (const { bars, rows, top } of layout.systems) {
    const placed = bars.find(b => b.index === at.bar);
    if (placed) return { x: (placed.columns[at.column]?.x ?? placed.x0) - PANEL_LEAD, y: top + rows.staffBottom + 12 };
  }
  return { x: 0, y: 0 };
}
