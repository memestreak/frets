/**
 * The words over the tab (chord names, text, sections, tempos, the capo, endings) and the time and
 * key signatures: their sizes, the boxes they are drawn in, and which one a press is on. Pure.
 */

import { type Section, type Tempo } from './clip';
import { type Layout, type PlacedBar, type System, chordWidth } from './layout';

export const BEAT_TEXT_SIZE = 11;
/** Free text starts a little left of its column's middle and runs right. */
export const BEAT_TEXT_INSET = 4;
export function beatTextWidth(text: string): number {
  return text.length * 5.6;
}

export const SECTION_SIZE = 14;
/** A section's rehearsal mark box: its height (a square for one letter). */
export const SECTION_BOX_HEIGHT = 19;
/**
 * About how wide a run of bold Figtree is at a size, with narrow, wide and capital letters apart: a
 * guess, for placing what follows a word and for presses on it.
 */
export function boldTextWidth(text: string, size: number): number {
  let em = 0;
  for (const c of text) {
    em += /[il.,:;'!|]/.test(c) ? 0.28 : /[fjrt ]/.test(c) ? 0.36 : /[mwMW]/.test(c) ? 0.86 : /[A-Z]/.test(c) ? 0.68 : 0.57;
  }
  return em * size;
}

/**
 * A section as guitar books print it (Jeremy, 2026-10-28): its rehearsal mark (if any) in an outlined
 * box, then its name in bold with no box. Each part's place and width from the bar's start.
 */
export function sectionBoxes(section: Section): { marker: { x: number; width: number } | null; text: { x: number; width: number } } {
  const marker = section.marker ? { x: 0, width: Math.max(SECTION_BOX_HEIGHT, section.marker.length * 9 + 6) } : null;
  const x = marker ? marker.width + 5 : 0;
  return { marker, text: { x, width: boldTextWidth(section.text, SECTION_SIZE) } };
}

export const TEMPO_SIZE = 11;
/** The room between a tempo's word and its note. */
const TEMPO_GAP = 6;
/**
 * Where a tempo's parts go from the bar's start, as guitar books print it (Jeremy, 2026-10-28): its
 * word first ("Medium Rock"), then the note and " = 122", all in bold. `width` is a guess, for presses.
 */
export function tempoParts(tempo: Tempo): { noteX: number; numberX: number; width: number } {
  const noteX = tempo.label ? boldTextWidth(tempo.label, TEMPO_SIZE) + TEMPO_GAP : 0;
  const numberX = noteX + 7;
  return { noteX, numberX, width: numberX + boldTextWidth(` = ${tempo.bpm}`, TEMPO_SIZE) };
}

/** Where the words over a bar start: just after its opening line. */
export function barTextX(bar: PlacedBar): number {
  return bar.x0 + 4;
}

/**
 * What a press on the words over the staff, or on a time signature, is on: a chord name or free text
 * (its column's place in the clip), or a bar's section, tempo or time signature (the first line's is bar 0's).
 */
export type TextHit = WordHit | { kind: 'time'; bar: number } | { kind: 'key'; bar: number };

export const CAPO_SIZE = 11;
/** The capo's words, as drawn: "Capo 3". */
export function capoText(capo: number): string {
  return `Capo ${capo}`;
}

/** A word over the staff that can be picked: a chord name, free text, a section, a tempo or the capo. */
export type WordHit = { kind: 'chord' | 'text'; index: number } | { kind: 'section' | 'tempo' | 'capo' | 'ending'; bar: number };

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
 * The box round a drawn word, in the tab's units, as a press finds it (`textAt`); null when it isn't
 * drawn. A picked word is outlined with it, and its Edit and Delete buttons go beside it.
 */
export function textBox(layout: Layout, hit: WordHit, capo: number | null): { x: number; y: number; width: number; height: number } | null {
  const { rows } = layout;
  const box = (s: number, rowY: number | null, x0: number, x1: number, height = 18) =>
    rowY === null ? null : { x: x0 - 3, y: s * rows.height + rowY - height / 2, width: x1 - x0 + 6, height };
  for (let s = 0; s < layout.systems.length; s++) {
    const system = layout.systems[s];
    if (hit.kind === 'capo') {
      if (!system.first || !capo) continue;
      return box(s, rows.capo, system.lineStart, system.lineStart + capoText(capo).length * 6.5);
    }
    if (hit.kind === 'chord' || hit.kind === 'text') {
      const placed = system.bars.flatMap(b => b.columns).find(c => c.index === hit.index);
      if (!placed) continue;
      if (hit.kind === 'chord') {
        const w = placed.column.chord ? chordWidth(placed.column.chord) : 0;
        return w > 0 ? box(s, rows.chords, placed.x - w / 2, placed.x + w / 2) : null;
      }
      const t = placed.column.text;
      const x0 = placed.x - BEAT_TEXT_INSET;
      return t ? box(s, rows.text, x0, x0 + beatTextWidth(t)) : null;
    }
    if (!('bar' in hit)) continue;
    if (hit.kind === 'ending') {
      const span = endingSpans(system).find(e => e.bar === hit.bar);
      if (span && rows.endings !== null) return { x: span.x0 - 3, y: s * rows.height + rows.endings - 8, width: span.x1 - span.x0 + 6, height: 18 };
      continue;
    }
    const bar = system.bars.find(b => b.index === hit.bar);
    if (!bar) continue;
    const x0 = barTextX(bar);
    if (hit.kind === 'section') {
      if (!bar.bar.section) return null;
      const { text } = sectionBoxes(bar.bar.section);
      return box(s, rows.section, x0, x0 + text.x + text.width, SECTION_BOX_HEIGHT + 6);
    }
    return bar.bar.tempo ? box(s, rows.tempo, x0, x0 + tempoParts(bar.bar.tempo).width) : null;
  }
  return null;
}

/** How far from a time signature's centre a press is on it. */
const TIME_REACH = 11;

/** The chord name, section, tempo, capo or time signature under a point; null when there is none. */
export function textAt(layout: Layout, x: number, y: number): TextHit | null {
  const { rows } = layout;
  const system = layout.systems[Math.floor(y / rows.height)];
  if (!system || y < 0) return null;
  const localY = y - Math.floor(y / rows.height) * rows.height;
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
  if (near(rows.text)) {
    for (const placed of system.bars.flatMap(b => b.columns)) {
      const t = placed.column.text;
      const x0 = placed.x - BEAT_TEXT_INSET;
      if (t && x >= x0 - 2 && x <= x0 + beatTextWidth(t) + 2) return { kind: 'text', index: placed.index };
    }
  }
  for (const bar of system.bars) {
    const x0 = barTextX(bar);
    if (near(rows.section) && bar.bar.section) {
      const { text } = sectionBoxes(bar.bar.section);
      if (x >= x0 - 2 && x <= x0 + text.x + text.width + 2) return { kind: 'section', bar: bar.index };
    }
    if (near(rows.tempo) && bar.bar.tempo && x >= x0 - 2 && x <= x0 + tempoParts(bar.bar.tempo).width + 2) {
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
