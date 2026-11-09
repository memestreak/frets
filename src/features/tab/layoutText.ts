/**
 * The words over the tab (chord names, text, sections, tempos, the capo, endings) and the time and
 * key signatures: their sizes, the boxes they are drawn in, and which one a press is on. Pure.
 */

import { barLineAt, barLineBox, isBarLine, type BarLineHit } from './barLines';
import { type Tempo } from './clip';
import { BAR_TEXT_INSET, boldTextWidth, SECTION_BOX_HEIGHT, SECTION_LINE, sectionBoxes, sectionTextWidth } from './sectionText';
import { tempoNoteWidth } from './TempoNote';
import { BEAT_TEXT_INSET, BEAT_TEXT_LINE, beatTextLines } from './beatText';
import { gridSize, OVER_NAME_SCALE } from './chordDiagrams';
import { type Layout, lineAt, type PlacedBar, type PlacedColumn, type System } from './layout';
import { textRowOf } from './rows';
import { chordWidth } from './widths';

/** A free text's box: its widest line, and its first and last lines' middles, down from the system's top. */
function beatTextBox(placed: PlacedColumn, textRow: number): { x0: number; x1: number; y0: number; y1: number } {
  const x0 = placed.x - BEAT_TEXT_INSET;
  const y0 = textRow + placed.textTop * BEAT_TEXT_LINE;
  return { x0, x1: x0 + beatTextLines(placed.column.text ?? '', placed.textLines).width, y0, y1: y0 + (placed.textLines.length - 1) * BEAT_TEXT_LINE };
}

/**
 * A section's box, where `placeSections` put it: from its bar's text start to its widest line's end, and
 * its first and last lines' middles, down from the system's top.
 */
export function sectionBox(bar: PlacedBar, sectionRow: number): { x0: number; x1: number; y0: number; y1: number } {
  const x0 = barTextX(bar);
  const { text } = sectionBoxes(bar.bar.section!);
  const lines = bar.sectionLines.length > 0 ? bar.sectionLines : [bar.bar.section!.text];
  const y0 = sectionRow + bar.sectionTop * SECTION_LINE;
  return { x0, x1: x0 + text.x + Math.max(...lines.map(sectionTextWidth)), y0, y1: y0 + (lines.length - 1) * SECTION_LINE };
}

export const TEMPO_SIZE = 11;
/** The room between a tempo's word and its note. */
const TEMPO_GAP = 6;
/**
 * Where a tempo's parts go from the bar's start, as guitar books print it (Jeremy, 2026-10-28): its
 * word first ("Medium Rock"), then the note and " = 122", all in bold. `width` is a guess, for presses.
 */
export function tempoParts(tempo: Tempo, size: number = TEMPO_SIZE): { noteX: number; numberX: number; width: number } {
  const noteX = tempo.label ? boldTextWidth(tempo.label, size) + TEMPO_GAP * (size / TEMPO_SIZE) : 0;
  const numberX = noteX + tempoNoteWidth(size);
  return { noteX, numberX, width: numberX + boldTextWidth(` = ${tempo.bpm}`, size) };
}

/**
 * The tempo drawn over a bar. The first bar's is printed in the score's head instead, under the tuning,
 * as a printed score has it (Jeremy, 2026-10-29; `ScoreHead.tsx`), so only later changes are drawn here.
 */
export function tempoOver(bar: { index: number; bar: { tempo?: Tempo } }): Tempo | undefined {
  return bar.index > 0 ? bar.bar.tempo : undefined;
}

/** Where the words over a bar start: just after its opening line. */
export function barTextX(bar: PlacedBar): number {
  return bar.x0 + BAR_TEXT_INSET;
}

/**
 * What a press on the words over the staff, or on a time signature, is on: a chord name or free text
 * (its column's place in the clip), or a bar's section, tempo or time signature (the first line's is bar 0's).
 */
export type TextHit = WordHit;

export const CAPO_SIZE = 11;
/** The capo's words, as drawn: "Capo 3". */
export function capoText(capo: number): string {
  return `Capo ${capo}`;
}

/**
 * A word over the staff that can be picked: a chord name, free text, a section, a tempo, the capo or an
 * ending; a time or key signature (step 8: the bar it is drawn at, the first line's time signature bar
 * 0's); or a bar line that can (`barLines.ts`): a repeat's start, end or count, or a double bar line.
 */
export type WordHit = { kind: 'chord' | 'text'; index: number } | { kind: 'section' | 'tempo' | 'capo' | 'ending' | 'time' | 'key'; bar: number } | BarLineHit;

/** Whether a picked word (or none) is this one. */
export function sameWord(picked: WordHit | null, hit: WordHit): boolean {
  if (!picked || picked.kind !== hit.kind) return false;
  return 'index' in picked ? 'index' in hit && picked.index === hit.index : 'bar' in hit && picked.bar === hit.bar;
}

/** Each ending bracket drawn on a line: its first bar (on this line), number and ends. */
export function endingSpans(system: System): { bar: number; n: number; x0: number; x1: number }[] {
  const out: { bar: number; n: number; x0: number; x1: number }[] = [];
  system.bars.forEach((bar, k) => {
    const n = bar.bar.ending;
    if (!n || system.bars[k - 1]?.bar.ending === n) return;
    let last = k;
    while (system.bars[last + 1]?.bar.ending === n) last++;
    out.push({ bar: bar.index, n, x0: bar.x0 + 4, x1: system.bars[last].x1 - 4 });
  });
  return out;
}

/**
 * The box round a drawn word or bar line, in the tab's units, as a press finds it (`textAt`); null when it
 * isn't drawn. A picked one's menu opens under it from the keyboard.
 */
export function textBox(layout: Layout, hit: WordHit, capo: number | null): { x: number; y: number; width: number; height: number } | null {
  if (isBarLine(hit)) return barLineBox(layout, hit);
  const box = (s: number, rowY: number | null, x0: number, x1: number, height = 18) =>
    rowY === null ? null : { x: x0 - 3, y: layout.systems[s].top + rowY - height / 2, width: x1 - x0 + 6, height };
  for (let s = 0; s < layout.systems.length; s++) {
    const system = layout.systems[s];
    const { rows } = system;
    if (hit.kind === 'capo') {
      if (!system.first || !capo) continue;
      return box(s, rows.capo, system.lineStart, system.lineStart + capoText(capo).length * 6.5);
    }
    if (hit.kind === 'chord' || hit.kind === 'text') {
      const placed = system.bars.flatMap(b => b.columns).find(c => c.index === hit.index);
      if (!placed) continue;
      if (hit.kind === 'chord') {
        const w = placed.column.chord ? chordWidth(placed.column.chord) : 0;
        if (w <= 0 || rows.chords === null) return null;
        const grid = diagramBox(placed, rows);
        if (!grid) return box(s, rows.chords, placed.x - w / 2, placed.x + w / 2);
        // The name and the diagram under it, as one (issue #242).
        const top = rows.chords - 9;
        const half = Math.max(w, grid.x1 - grid.x0) / 2;
        return { x: placed.x - half - 3, y: system.top + top, width: 2 * half + 6, height: grid.y1 + 3 - top };
      }
      const textRow = textRowOf(rows, placed);
      if (!placed.column.text || textRow === null) return null;
      const text = beatTextBox(placed, textRow);
      return box(s, (text.y0 + text.y1) / 2, text.x0, text.x1, 18 + text.y1 - text.y0);
    }
    if (!('bar' in hit)) continue;
    if (hit.kind === 'ending') {
      const span = endingSpans(system).find(e => e.bar === hit.bar);
      if (span && rows.endings !== null) return { x: span.x0 - 3, y: system.top + rows.endings - 8, width: span.x1 - span.x0 + 6, height: 18 };
      continue;
    }
    const bar = system.bars.find(b => b.index === hit.bar);
    if (!bar) continue;
    if (hit.kind === 'time' || hit.kind === 'key') return signatureBox(system, bar, hit.kind);
    const x0 = barTextX(bar);
    if (hit.kind === 'section') {
      if (!bar.bar.section || rows.section === null) return null;
      const section = sectionBox(bar, rows.section);
      return box(s, (section.y0 + section.y1) / 2, section.x0, section.x1, SECTION_BOX_HEIGHT + 6 + section.y1 - section.y0);
    }
    const tempo = tempoOver(bar);
    return tempo ? box(s, rows.tempo, x0, x0 + tempoParts(tempo).width) : null;
  }
  return null;
}

/** Where the diagram under a column's chord name is drawn, in its line's units; null when it has none. */
export function diagramBox(placed: PlacedColumn, rows: System['rows']): { x0: number; x1: number; y0: number; y1: number } | null {
  if (!placed.diagram || rows.diagrams === null) return null;
  const { width, height } = gridSize(placed.diagram);
  const half = (width * OVER_NAME_SCALE) / 2;
  return { x0: placed.x - half, x1: placed.x + half, y0: rows.diagrams, y1: rows.diagrams + height * OVER_NAME_SCALE };
}

/** How far from a time signature's centre a press is on it. */
const TIME_REACH = 11;

/** The box round a drawn time or key signature, as `textAt` finds it; null when the bar doesn't draw one. */
function signatureBox(system: System, bar: System['bars'][number], kind: 'time' | 'key'): { x: number; y: number; width: number; height: number } | null {
  const { rows } = system;
  const [top, bottom] = rows.score ? [rows.score.top - 4, rows.score.bottom + 4] : [rows.staffTop, rows.staffBottom];
  const tall = (x0: number, x1: number) => ({ x: x0, y: system.top + top, width: x1 - x0, height: bottom - top });
  if (kind === 'time') {
    const first = system.bars[0] === bar && system.timeX !== null;
    const x = first ? system.timeX : bar.timeX;
    return x === null ? null : tall(x - TIME_REACH, x + TIME_REACH);
  }
  if (!rows.score) return null;
  // The key stops where a time signature drawn after it starts.
  const timeX = system.bars[0] === bar && system.timeX !== null ? system.timeX : bar.timeX;
  const end = (x: number) => (timeX === null ? x : Math.min(x, timeX - TIME_REACH));
  if (system.bars[0] === bar && bar.keyX === null) return tall(system.lineStart, end(system.staffStart));
  return bar.keyX === null ? null : tall(bar.keyX - 4, end((bar.columns[0]?.x ?? bar.x1) - 6));
}

/** The chord name, section, tempo, capo, ending, bar line or time signature under a point; null when there is none. */
export function textAt(layout: Layout, x: number, y: number): TextHit | null {
  const line = lineAt(layout, y);
  if (!line) return null;
  const barLine = barLineAt(layout, x, y);
  if (barLine) return barLine;
  const { system, localY } = line;
  const { rows } = system;
  const near = (rowY: number | null) => rowY !== null && Math.abs(localY - rowY) <= 8;
  if (system.first && near(rows.capo) && x >= system.lineStart - 2 && x <= system.lineStart + capoText(1).length * 6.5 + 8) {
    return { kind: 'capo', bar: 0 };
  }
  if (near(rows.endings)) {
    const span = endingSpans(system).find(e => x >= e.x0 - 4 && x <= e.x1 + 4);
    if (span) return { kind: 'ending', bar: span.bar };
  }
  if (near(rows.chords)) {
    for (const placed of system.bars.flatMap(b => b.columns)) {
      const w = placed.column.chord ? chordWidth(placed.column.chord) : 0;
      if (w > 0 && Math.abs(x - placed.x) <= w / 2 + 2) return { kind: 'chord', index: placed.index };
    }
  }
  // A press on a chord's diagram is a press on its name (issue #242).
  for (const placed of system.bars.flatMap(b => b.columns)) {
    const grid = diagramBox(placed, rows);
    if (grid && x >= grid.x0 - 2 && x <= grid.x1 + 2 && localY >= grid.y0 - 2 && localY <= grid.y1 + 2) return { kind: 'chord', index: placed.index };
  }
  for (const placed of system.bars.flatMap(b => b.columns)) {
    const textRow = textRowOf(rows, placed);
    if (!placed.column.text || textRow === null) continue;
    const text = beatTextBox(placed, textRow);
    if (localY >= text.y0 - 6 && localY <= text.y1 + 6 && x >= text.x0 - 2 && x <= text.x1 + 2) return { kind: 'text', index: placed.index };
  }
  for (const bar of system.bars) {
    const x0 = barTextX(bar);
    if (rows.section !== null && bar.bar.section) {
      const section = sectionBox(bar, rows.section);
      if (localY >= section.y0 - 10 && localY <= section.y1 + 10 && x >= section.x0 - 2 && x <= section.x1 + 2) return { kind: 'section', bar: bar.index };
    }
    const tempo = tempoOver(bar);
    if (near(rows.tempo) && tempo && x >= x0 - 2 && x <= x0 + tempoParts(tempo).width + 2) {
      return { kind: 'tempo', bar: bar.index };
    }
  }
  // Time signatures are drawn on the notation staff when it is shown, else on the tab.
  const onStaff = rows.score
    ? localY >= rows.score.top - 4 && localY <= rows.score.bottom + 4
    : rows.tab && localY >= rows.staffTop && localY <= rows.staffBottom;
  if (onStaff && system.timeX !== null && Math.abs(x - system.timeX) <= TIME_REACH) return { kind: 'time', bar: 0 };
  const changed = system.bars.find(b => b.timeX !== null && Math.abs(x - b.timeX) <= TIME_REACH);
  if (onStaff && changed) return { kind: 'time', bar: changed.index };
  // The clef and the key signature after it (the line's own; a press on the clef opens it even when the
  // key has no sharps or flats, Jeremy 2026-10-27), or the key inside a bar that changes it.
  if (rows.score && onStaff) {
    if (x >= system.lineStart && x < system.staffStart) return { kind: 'key', bar: system.bars[0].index };
    const keyed = system.bars.find(b => b.keyX !== null && x >= b.keyX - 4 && x < b.columns[0]?.x - 6);
    if (keyed) return { kind: 'key', bar: keyed.index };
  }
  return null;
}
