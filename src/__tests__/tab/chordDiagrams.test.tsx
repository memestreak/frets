/**
 * Chord diagrams in the drawn clip (issue #242, `docs/specs/2026-11-06-tab-chord-diagrams-design.md`):
 * which chords get one, the Chord chart, the row under the names, and the drawing.
 */
import * as alphaTab from '@coderline/alphatab';
import { render } from '@testing-library/react';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { chartChords, diagramOf, drawnOnLine, layoutChart, shapedChord } from '@/features/tab/chordDiagrams';
import { partOf, type Part } from '@/features/tab/clip';
import { layoutClip } from '@/features/tab/layout';
import { TabClip } from '@/features/tab/TabClip';

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
    const wide = layoutChart(chords, 600, 'upright');
    expect(new Set(wide.places.map(p => p.y)).size).toBe(1);
    expect(wide.places[0].x).toBeGreaterThan(0);
    const narrow = layoutChart(chords, 100, 'upright');
    expect(new Set(narrow.places.map(p => p.y)).size).toBe(3);
  });
});

describe('diagrams over the names', () => {
  it('every name, or only the first of each chord on a line', () => {
    const p = part(TWO_TRACKS);
    expect(drawnOnLine(p, ['A', 'C', 'E', undefined, 'C'], 'every')).toEqual([true, true, false, false, true]);
    expect(drawnOnLine(p, ['A', 'C', 'E', undefined, 'C'], 'line')).toEqual([true, true, false, false, false]);
  });
  it('take a row under the names only when on, and only on a line with a shaped chord', () => {
    const p = part(TWO_TRACKS);
    const off = layoutClip(p, 2000);
    const on = layoutClip(p, 2000, 'tab', 'upright');
    expect(off.systems[0].rows.diagrams).toBeNull();
    expect(on.systems[0].rows.diagrams).toBeGreaterThan(on.systems[0].rows.chords!);
    expect(on.systems[0].rows.staffTop).toBeGreaterThan(off.systems[0].rows.staffTop);
  });
  it('are drawn under each shaped name, none for E, A7 or N.C.', () => {
    const p = part(TWO_TRACKS);
    const { container } = render(<TabClip clip={p} width={2000} title="t" diagrams={{ turn: 'upright', repeat: 'every' }} />);
    const grids = [...container.querySelectorAll('[data-testid=chord-grid]')].map(g => g.getAttribute('data-chord'));
    expect(grids).toEqual(['A', 'C', 'C']);
    const { container: none } = render(<TabClip clip={p} width={2000} title="t" />);
    expect(none.querySelectorAll('[data-testid=chord-grid]')).toHaveLength(0);
  });
});
