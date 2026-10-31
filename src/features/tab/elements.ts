/**
 * Alt+← → (issue #238, as MuseScore's "next element"): every thing on the clip a press can pick, in
 * reading order, so the keys step through marks and words as well as notes. In each column: its bar's
 * words first when it opens the bar (capo, section, tempo, ending), then its chord name and text, then its
 * notes from the high string down (or the rest), then its marks. Pure; built from what is drawn.
 */
import { STRING_COUNT, type Part } from './clip';
import type { Layout } from './layout';
import { textBox, type WordHit } from './layoutText';
import { markBoxes, type MarkHit } from './marks';

/** A note on a string, a rest (a column with no notes), a mark or a word. */
export type Element = { kind: 'note'; index: number; string: number } | { kind: 'rest'; index: number } | MarkHit | WordHit;

const BAR_WORDS = ['capo', 'section', 'tempo', 'ending'] as const;

export function elementsOf(clip: Part, layout: Layout): Element[] {
  const capo = clip.capo ?? null;
  const drawn = (hit: WordHit) => textBox(layout, hit, capo) !== null;
  // Each mark once (a mark drawn on the staff and on the tab is one), grouped by its column.
  const marks = new Map<number, MarkHit[]>();
  const seen = new Set<string>();
  for (const { hit } of markBoxes(layout)) {
    const key = `${hit.mark}:${hit.index}:${hit.string}`;
    if (seen.has(key)) continue;
    seen.add(key);
    marks.set(hit.index, [...(marks.get(hit.index) ?? []), withoutOn(hit)]);
  }
  const out: Element[] = [];
  for (const system of layout.systems) {
    for (const bar of system.bars) {
      for (const kind of BAR_WORDS) {
        const hit: WordHit = { kind, bar: bar.index };
        if ((kind !== 'capo' || bar.index === 0) && drawn(hit)) out.push(hit);
      }
      for (const { column, index } of bar.columns) {
        for (const kind of ['chord', 'text'] as const) if (drawn({ kind, index })) out.push({ kind, index });
        const strings = [...Array(STRING_COUNT).keys()].filter(s => column.notes[s]);
        if (strings.length === 0) out.push({ kind: 'rest', index });
        for (const string of strings) out.push({ kind: 'note', index, string });
        out.push(...(marks.get(index) ?? []));
      }
    }
  }
  return out;
}

/** The mark itself, wherever it was drawn: stepping to it picks it on the tab. */
function withoutOn(hit: MarkHit): MarkHit {
  const rest = { ...hit };
  delete rest.on;
  return rest;
}

/** Whether two elements are the same thing. */
export function sameElement(a: Element, b: Element): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'mark' && b.kind === 'mark') return a.mark === b.mark && a.index === b.index && a.string === b.string;
  if ('bar' in a && 'bar' in b) return a.bar === b.bar;
  if ('index' in a && 'index' in b && a.index !== b.index) return false;
  if (a.kind === 'note' && b.kind === 'note') return a.string === b.string;
  return true;
}

/**
 * The element after (+1) or before (−1) the current one, or null at either end. A column with notes but
 * no string picked stands just before its first note, so → goes to that note and ← to what is before it.
 */
export function stepElement(list: readonly Element[], current: Element | { kind: 'column'; index: number }, step: 1 | -1): Element | null {
  let at = current.kind === 'column' ? -1 : list.findIndex(e => sameElement(e, current));
  if (at === -1) {
    if (!('index' in current)) return null;
    const first = list.findIndex(e => (e.kind === 'note' || e.kind === 'rest') && e.index === current.index);
    if (first === -1) return null;
    if (list[first].kind === 'rest') at = first;
    else return step === 1 ? list[first] : list[first - 1] ?? null;
  }
  return list[at + step] ?? null;
}
