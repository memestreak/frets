/**
 * Chord diagrams in the drawn clip (issue #242, `docs/specs/2026-11-06-tab-chord-diagrams-design.md`):
 * which chords get one, the Chord chart, the row under the names, and the drawing.
 */
import * as alphaTab from '@coderline/alphatab';
import { render } from '@testing-library/react';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { chartChords, diagramOf, layoutChart, shapedChord } from '@/features/tab/chordDiagrams';
import { textAt, textBox } from '@/features/tab/layoutText';
import { attachment } from '@/features/tab/attachment';
import { partOf, type Part } from '@/features/tab/clip';
import { layoutClip } from '@/features/tab/layout';
import { TabClip } from '@/features/tab/TabClip';
import { asciiChordChart, readAscii, writeAscii } from '@/features/tab/ascii';

function part(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip, 0);
}

const TWO_TRACKS = [
  '\\track "Gtr I"',
  '\\ts (4 4)',
  '\\chord ("C" 0 1 0 2 3 x)',
  '\\chord ("A" 5 5 6 7 7 5)',
  '\\chord ("A7" 0 2 0 2 0 x) {showdiagram false}',
  '\\chord ("Dsus2" 0 3 2 0 x x)',
  'r.4{ch "A"} r.4{ch "C"} r.4{ch "E"} r.4{ch "A7"} | r.2{ch "C"} r.2{ch "N.C."} |',
  '\\track "Gtr II"',
  '\\chord ("C" 0 1 0 2 3 x)',
  '\\chord ("G" 3 0 0 0 2 3)',
  'r.1{ch "G"} | r.1{ch "C"} |',
  '',
].join('\n');

describe('which chords get a diagram', () => {
  it('a definition with a shape, low string first, starting where its lowest fret is', () => {
    expect(shapedChord({ name: 'A', frets: [5, 5, 6, 7, 7, 5] })).toEqual({ name: 'A', shape: [5, 7, 7, 6, 5, 5], start: 5 });
    expect(shapedChord({ name: 'C', frets: [0, 1, 0, 2, 3, null] })!.start).toBe(1);
  });
  it('no: a name with no definition, a definition with no strings or none played, or showdiagram false', () => {
    const p = part(TWO_TRACKS);
    expect(diagramOf(p, 'E')).toBeNull();
    expect(diagramOf(p, 'N.C.')).toBeNull();
    expect(diagramOf(p, 'A7')).toBeNull();
    expect(shapedChord({ name: 'X' })).toBeNull();
    expect(shapedChord({ name: 'X', frets: [null, null, null, null, null, null] })).toBeNull();
  });
});

describe('the Chord chart', () => {
  it('every named chord with a shape once, in the order first named, then the other tracks’ (unused Dsus2 left out)', () => {
    expect(chartChords(part(TWO_TRACKS)).map(c => c.name)).toEqual(['A', 'C', 'G']);
  });
  it('wraps onto a second row when the width runs out, each row centred', () => {
    const chords = chartChords(part(TWO_TRACKS));
    const wide = layoutChart(chords, 600);
    expect(new Set(wide.places.map(p => p.y)).size).toBe(1);
    expect(wide.places[0].x).toBeGreaterThan(0);
    const narrow = layoutChart(chords, 100);
    expect(new Set(narrow.places.map(p => p.y)).size).toBe(3);
  });
});

describe('diagrams over the names', () => {
  it('take a row under the names only when on, and only on a line with a shaped chord', () => {
    const p = part(TWO_TRACKS);
    const off = layoutClip(p, 2000);
    const on = layoutClip(p, 2000, 'tab', true);
    expect(off.systems[0].rows.diagrams).toBeNull();
    expect(on.systems[0].rows.diagrams).toBeGreaterThan(on.systems[0].rows.chords!);
    expect(on.systems[0].rows.staffTop).toBeGreaterThan(off.systems[0].rows.staffTop);
  });
  it('are drawn under every shaped name, the same chord each time, none for E, A7 or N.C.', () => {
    const p = part(TWO_TRACKS);
    const { container } = render(<TabClip clip={p} width={2000} title="t" chordDiagrams />);
    const grids = [...container.querySelectorAll('[data-testid=chord-grid]')].map(g => g.getAttribute('data-chord'));
    expect(grids).toEqual(['A', 'C', 'C']);
    const { container: none } = render(<TabClip clip={p} width={2000} title="t" />);
    expect(none.querySelectorAll('[data-testid=chord-grid]')).toHaveLength(0);
  });
  it('a press on a diagram is a press on its chord name, and its box takes in the diagram', () => {
    const layout = layoutClip(part(TWO_TRACKS), 2000, 'tab', true);
    const system = layout.systems[0];
    const a = system.bars[0].columns[0];
    const middle = system.top + system.rows.diagrams! + 10;
    expect(textAt(layout, a.x, middle)).toEqual({ kind: 'chord', index: a.index });
    const box = textBox(layout, { kind: 'chord', index: a.index }, null)!;
    expect(box.y + box.height).toBeGreaterThan(middle);
  });
  it('a picked chord’s dashed Attachment line runs from under its diagram', () => {
    const layout = layoutClip(part(TWO_TRACKS), 2000, 'tab', true);
    const system = layout.systems[0];
    const a = system.bars[0].columns[0];
    const { lines } = attachment(layout, { kind: 'chord', index: a.index });
    expect(lines).toHaveLength(1);
    expect(Math.min(lines[0].y0, lines[0].y1)).toBeGreaterThan(system.top + system.rows.diagrams!);
  });
  it('long free text goes over the chord names', () => {
    const rows = layoutClip(part('\\ts (4 4)\nr.1{ch "C" txt "Intro, quietly, then building"} |\n'), 2000).systems[0].rows;
    expect(rows.text!).toBeLessThan(rows.chords!);
  });
});

describe('the ASCII chord chart', () => {
  it('lists each chord once with its frets low E first, dashes once a fret is 10 or more, and the reader skips it', () => {
    const p = part(TWO_TRACKS);
    expect(asciiChordChart(chartChords(p))).toBe('A  577655\nC  x32010\nG  320003');
    expect(asciiChordChart([{ name: 'D', shape: [null, null, 12, 14, 15, 14], start: 12 }])).toBe('D  x-x-12-14-15-14');
    const text = writeAscii(p, { chords: true });
    expect(text).toContain('\n\nA  577655\n');
    expect(writeAscii(p)).not.toContain('577655');
    const read = readAscii(text);
    expect(read.ok && read.clip.masterBars.length).toBe(2);
  });
});
