import type { Part } from './clip';
import { type Layout } from './layout';
import { textRowOf, type Rows } from './rows';
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
  if (kind === 'dynamic') return b?.columns[column]?.dynamic ?? '';
  // The technique popover adds a mark by name; it starts empty, whatever the notes have (issue #501).
  if (kind === 'technique') return '';
  return b?.section?.text ?? '';
}

/** The chord popover's height (`.tab-word`: its caption and field) and a small gap under it. */
const CHORD_FIELD_HEIGHT = 96;

/** The text annotation popover's height with one line typed (`.tab-word`: its caption and field), and the gap under it. */
const TEXT_FIELD_HEIGHT = 84;
const TEXT_FIELD_GAP = 6;
/** Half a text annotation's line: a row's place is its first line's middle. */
const TEXT_HALF_LINE = 9;

/** How far a dynamic's field stands from its column's middle, beside it. */
const BESIDE = 16;

/** The bottom of a line's notes, as drawn: the tab's stems or bottom string, the staff, and the dynamics' row (`dynamic`) under its letters. */
function lineBottom(rows: Rows, dynamic: number): number {
  const tab = rows.tab ? (rows.tabStems ? rows.stemBottom : rows.staffBottom) : 0;
  return Math.max(tab, rows.score?.bottom ?? 0, dynamic + 12);
}

/** Where a word's field goes over the drawing: above the spot the word is drawn, kept inside the tab's width. */
export function wordSpot(layout: Layout, width: number, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): { x: number; y: number; up?: boolean } {
  // A number's field fits its caption and a small number box; the others are 180px wide (`.tab-word`).
  const FIELD_WIDTH = kind === 'ending' || kind === 'repeat' ? 150 : kind === 'technique' ? 240 : 180;
  // The technique popover sits where a dynamic's does: under the line beside its column, so the notes it marks stay in sight.
  const beside = kind === 'dynamic' || kind === 'technique';
  const FIELD_HEIGHT = 64;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const { rows, top } = layout.systems[s];
    // A short text's field opens over it, under the chord names; a new text's over the names.
    const spot = placed.columns[column];
    const text = spot?.column.text ? textRowOf(rows, spot) : rows.text;
    // A dynamic's field opens over its row; a new one's over where the row will be: under the staff, or over the tab.
    const dynamic = rows.dynamics ?? (rows.score ? rows.score.bottom + 20 : rows.staffTop - 20);
    const row = { chord: rows.chords, text, section: rows.section, ending: rows.endings, repeat: rows.endings, dynamic, technique: dynamic }[kind];
    // A section moved up clear of another opens its field over where it is drawn (issue #389).
    const raised = kind === 'section' ? placed.sectionTop * SECTION_LINE : 0;
    // A dynamic's field opens under the line, as Dorico's popover opens under the staff, clear of the column's
    // notes so they show lit while it is open (Jeremy, 2026-11-09); a word's over its row.
    const y = beside ? top + lineBottom(rows, dynamic) + 12 : top + (row ?? rows.staffTop - 20) + raised - FIELD_HEIGHT;
    // A repeat's count is written over the bar's end.
    if (beside) {
      // Beside its column, not over it, so its list, opening up or down, leaves the column's notes in sight (lit).
      const at = placed.columns[column]?.x ?? placed.x0;
      const right = at + BESIDE + FIELD_WIDTH / 2;
      return { x: right <= width - FIELD_WIDTH / 2 ? right : Math.max(FIELD_WIDTH / 2, at - BESIDE - FIELD_WIDTH / 2), y: Math.max(0, y) };
    }
    if (kind === 'chord') {
      // The chord popover sits wholly over where the line's chord names go (over the staff, or over the tab
      // when only it is drawn), so it never covers the column it names; with no room for it over the first line,
      // it goes under the line instead.
      const names = rows.chords ?? (rows.score?.top ?? rows.staffTop) - 20;
      const over = top + names - CHORD_FIELD_HEIGHT;
      const at = placed.columns[column]?.x ?? placed.x0 + FIELD_WIDTH / 2;
      return {
        x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, at)),
        y: over >= 0 ? over : top + lineBottom(rows, dynamic) + 12,
      };
    }
    if (kind === 'text') {
      // The text annotation popover hangs up from the top of the line's text annotations (long ones over the chord names, short ones
      // under them, issue #404), or from where they would go, so it never covers its column or what is written
      // over the line; it grows up as lines are typed. With no room over the first line, it opens under the line.
      const highest = rows.text ?? rows.chords ?? rows.textUnder ?? (rows.score?.top ?? rows.staffTop) - 20;
      const bottom = top + highest - TEXT_HALF_LINE - TEXT_FIELD_GAP;
      const at = placed.columns[column]?.x ?? placed.x0 + FIELD_WIDTH / 2;
      const x = Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, at));
      return bottom >= TEXT_FIELD_HEIGHT ? { x, y: bottom, up: true } : { x, y: top + lineBottom(rows, dynamic) + 12 };
    }
    const x = kind === 'repeat' ? placed.x1 - FIELD_WIDTH / 2 : placed.x0 + FIELD_WIDTH / 2;
    return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, y) };
  }
  return { x: FIELD_WIDTH / 2, y: 0 };
}

/** The Lyrics field's size (`.tab-lyric`): small, as Dorico's lyrics popover. */
export const LYRIC_FIELD = { width: 180, height: 30 };
/** From the field's left edge to where its text starts: the grip and the line's number. */
const LYRIC_TEXT_LEAD = 44;
/** Room over the staff's top line for an up stem on a note in the staff. */
const STEM_CLEAR = 36;

/**
 * Where the Lyrics field's top left goes: from its note, just above the system's top line (the staff, or the tab
 * when only it is drawn), so the syllables already typed under the notes stay in sight. It can be dragged
 * away from what it covers (`LyricField`).
 */
export function lyricSpot(layout: Layout, width: number, at: { bar: number; column: number }): { x: number; y: number } {
  const fit = (x: number) => Math.min(width - LYRIC_FIELD.width, Math.max(0, x));
  for (const { bars, rows, top } of layout.systems) {
    const placed = bars.find(b => b.index === at.bar);
    if (!placed) continue;
    const x = placed.columns[at.column]?.x ?? placed.x0;
    // Over the staff's up stems (the tab alone has none over it); the text starts over the note, with the
    // line's number just before it, as in Dorico.
    const over = rows.score ? rows.score.top - STEM_CLEAR : rows.staffTop - 8;
    return { x: fit(x - LYRIC_TEXT_LEAD), y: Math.max(0, top + over - LYRIC_FIELD.height) };
  }
  return { x: 0, y: 0 };
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
