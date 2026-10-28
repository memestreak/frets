/** Which notes a beam joins in a bar: by beat, and plain eighths four together in 4/4. Pure. */

import { isRest, ticks, type Column } from './clip';
import { type PlacedBar, type PlacedColumn } from './layout';

export interface BeamGroup {
  columns: PlacedColumn[];
}

/** A beat's run of beamable columns, and whether it is two plain eighths filling the beat. */
interface BeatRun {
  columns: PlacedColumn[];
  beat: number;
  eighths: boolean;
}

/**
 * Runs of beamable columns (eighth or shorter, not rests) within each beat of a bar. In 4/4, two
 * beats of plain eighths in the same half of the bar are one group of four, as printed music beams
 * them (`halfBars`; Guitar Pro's Sweet Child O' Mine, Jeremy 2026-10-28); sixteenths stay by the beat.
 */
export function beamGroups(bar: PlacedBar, beat: number): BeamGroup[] {
  const runs: BeatRun[] = [];
  let at = 0;
  let current: PlacedColumn[] = [];
  let currentBeat = -1;
  const close = () => {
    if (current.length > 0) {
      const eighths = current.length === 2 && current.every(p => isPlainEighth(p.column)) && ticks(current[0].column.duration) * 2 === beat;
      runs.push({ columns: current, beat: currentBeat, eighths });
    }
    current = [];
  };
  for (const placed of bar.columns) {
    // A grace note takes no time and is drawn without a stem, so it ends a beam and starts none.
    if (placed.column.grace) {
      close();
      currentBeat = -1;
      continue;
    }
    const b = Math.floor(at / beat);
    const beamable = placed.column.duration.value >= 8 && !isRest(placed.column);
    if (!beamable || b !== currentBeat) close();
    if (beamable) {
      current.push(placed);
      currentBeat = b;
    }
    at += ticks(placed.column.duration);
  }
  close();
  const groups: BeamGroup[] = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const next = runs[i + 1];
    const joined = bar.halfBars && next && run.eighths && next.eighths && run.beat % 2 === 0 && next.beat === run.beat + 1
      && run.columns[1].index + 1 === next.columns[0].index;
    if (joined) {
      groups.push({ columns: [...run.columns, ...next.columns] });
      i++;
    } else groups.push({ columns: run.columns });
  }
  return groups;
}

/** An eighth with no dot and in no tuplet. */
function isPlainEighth(column: Column): boolean {
  const { value, dots, tuplet } = column.duration;
  return value === 8 && dots === 0 && !tuplet;
}
