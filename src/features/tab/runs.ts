/**
 * Marks drawn over runs of columns (vibrato, let ring, P.M.), and the joins from one note to the next
 * on a string (hammer-ons, pull-offs, legato slides). Pure; works on a `layoutClip` layout.
 */

import { STRING_COUNT, isLetRing, isPalmMuted, type Column, type Note } from './clip';
import { BEND_PEAK, bendShape, type Layout, lineAt, type PlacedColumn, type System } from './layout';

/** The vibrato waves of a line: one over each run of neighbouring columns with vibrato, wide where any note's is. */
export function vibratoRuns(system: System) {
  return columnRuns(system, c => (c.notes.some(n => n?.vibrato === 'wide') ? 'wide' : c.notes.some(n => n?.vibrato) ? 'slight' : null));
}

/** A run of columns on one line under one mark drawn across them: from its first column's centre to `end`. */
export interface ColumnRun {
  from: PlacedColumn;
  to: PlacedColumn;
  /** Where it stops: a little before the column after its last, or its bar's closing line, whichever comes first. */
  end: number;
}

/**
 * The runs of neighbouring columns on a line that share a mark, by `kind` (null for none): a vibrato
 * over several notes is one wave, an octave line one line. A run stops at the line's end.
 */
export function columnRuns<K>(system: System, kind: (column: Column) => K | null): (ColumnRun & { kind: K })[] {
  const placed = system.bars.flatMap(b => b.columns);
  const last = system.bars[system.bars.length - 1]?.x1 ?? 0;
  const runs: (ColumnRun & { kind: K })[] = [];
  placed.forEach((p, i) => {
    const k = kind(p.column);
    if (k === null) return;
    const open = runs[runs.length - 1];
    if (open && open.to === placed[i - 1] && open.kind === k) open.to = p;
    else runs.push({ from: p, to: p, end: 0, kind: k });
  });
  const barEnd = new Map(system.bars.flatMap(b => b.columns.map(c => [c, b.x1] as const)));
  for (const run of runs) {
    const next = placed[placed.indexOf(run.to) + 1];
    // A run whose last note ends its bar stops at the bar line, as Guitar Pro draws it.
    const end = barEnd.get(run.to)!;
    run.end = next ? Math.min(next.x - 12, end - 6) : last - 6;
  }
  return runs;
}

export type RunMark = 'palmMute' | 'letRing';
export const RUN_MARKS: { mark: RunMark; label: string; has: (column: Column) => boolean }[] = [
  { mark: 'palmMute', label: 'P.M.', has: isPalmMuted },
  { mark: 'letRing', label: 'let ring', has: isLetRing },
];

/** One run as drawn on one line of tab: its columns, and where its label starts and its line ends. */
export interface Run {
  columns: PlacedColumn[];
  x0: number;
  x1: number;
}

/** How wide a run's label is drawn. */
export function runLabelWidth(label: string): number {
  return label.length * 5.5;
}

/** The runs of columns that have a mark, on one line of tab. */
export function runsIn(system: System, has: (column: Column) => boolean): Run[] {
  const runs: Run[] = [];
  let current: PlacedColumn[] = [];
  const close = () => {
    if (current.length > 0) runs.push({ columns: current, x0: current[0].x - 8, x1: current[current.length - 1].x + 8 });
    current = [];
  };
  for (const placed of system.bars.flatMap(b => b.columns)) {
    if (has(placed.column)) current.push(placed);
    else close();
  }
  close();
  return runs;
}

/** The run under a point, label or line, with the mark it draws; null when there is none. */
export function runAt(layout: Layout, x: number, y: number): { mark: RunMark; run: Run } | null {
  const line = lineAt(layout, y);
  if (!line) return null;
  const { system, localY } = line;
  const { rows } = system;
  for (const { mark, label, has } of RUN_MARKS) {
    const rowY = rows[mark];
    if (rowY === null || Math.abs(localY - rowY) > 7) continue;
    const run = runsIn(system, has).find(r => x >= r.x0 - 2 && x <= Math.max(r.x1, r.x0 + runLabelWidth(label)) + 2);
    if (run) return { mark, run };
  }
  return null;
}

/** Where a note was drawn: its line of tab and its column's centre. */
export interface Spot {
  system: number;
  x: number;
}

/** Where a note was drawn, and where a bend held on from it starts its dashed line: its arrow's peak (`bendShape`), or BEND_PEAK right of it. */
export interface NoteSpot extends Spot {
  peak: number;
}

/** One arc over a run of notes on a string joined by hammer-ons, pull-offs and legato slides, on one line. */
export interface LegatoArc {
  system: number;
  string: number;
  /** The run's first and last notes' centres; a run from the line before starts at the line's staff. */
  x0: number;
  x1: number;
  /** The run's first note was on the line before. */
  continued: boolean;
}

/**
 * The legato runs of a clip as Guitar Pro draws them: one arc from the first note picked to the last
 * one sounded without picking (hammered, pulled or slid to), split where the run crosses into a new line.
 */
export function legatoArcs(systems: System[]): LegatoArc[] {
  const arcs: LegatoArc[] = [];
  const open: (LegatoArc | null)[] = Array(STRING_COUNT).fill(null);
  const last: ({ system: number; x: number } | null)[] = Array(STRING_COUNT).fill(null);
  systems.forEach((system, si) => {
    for (const bar of system.bars) {
      for (const placed of bar.columns) {
        placed.column.notes.forEach((note, s) => {
          if (!note) return;
          const joined = !!(note.legato || note.slide === 'legato') && last[s] !== null;
          if (!joined) open[s] = null;
          else if (open[s] && open[s]!.system === si) open[s]!.x1 = placed.x;
          else {
            const from = last[s]!;
            if (from.system === si) {
              open[s] = { system: si, string: s, x0: from.x, x1: placed.x, continued: false };
            } else {
              // The run goes on into a new line: its part on the line before runs to that line's end.
              const before = systems[from.system];
              const lineEnd = before.bars[before.bars.length - 1].x1 - 4;
              if (open[s]) open[s]!.x1 = lineEnd;
              else arcs.push({ system: from.system, string: s, x0: from.x, x1: lineEnd, continued: false });
              open[s] = { system: si, string: s, x0: system.staffStart, x1: placed.x, continued: true };
            }
            arcs.push(open[s]!);
          }
          last[s] = { system: si, x: placed.x };
        });
      }
    }
  });
  return arcs;
}

/** For every note, where the note before it on the same string was drawn. */
export function previousSpots(systems: System[]): Map<Note, NoteSpot> {
  const out = new Map<Note, NoteSpot>();
  const last: (NoteSpot | null)[] = Array(STRING_COUNT).fill(null);
  systems.forEach((system, si) => {
    for (const bar of system.bars) {
      for (const placed of bar.columns) {
        placed.column.notes.forEach((note, s) => {
          if (!note) return;
          const before = last[s];
          if (before) out.set(note, before);
          // A bent or held note's arrow or dashed line runs to where `bendShape` puts its peak; a pre-bend's,
          // or a bend pushed on up's, stands BEND_PEAK on (`BendDrawing`, `BendCarry`).
          const own = note.bend && !note.bend.pre && note.bend.from === undefined;
          last[s] = { system: si, x: placed.x, peak: placed.x + (own ? bendShape(placed, note.bend!).peak : BEND_PEAK) };
        });
      }
    }
  });
  return out;
}

/* — the cursor — */
