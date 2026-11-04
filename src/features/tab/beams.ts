/**
 * Which notes a beam joins in a bar: by the Beat groups, then each note's Beam override
 * (`docs/specs/2026-11-04-tab-beat-groups-beams-design.md`). Pure.
 */

import { beatTicks, isRest, ticks, type Column, type TimeSignature } from './clip';
import { type PlacedColumn } from './layout';

/** What beaming needs of a column: itself and its place in the clip. Laid out (`PlacedColumn`) or not (the MusicXML export). */
type BeamColumn = Pick<PlacedColumn, 'column' | 'index'>;

/** What beaming needs of a bar: its columns in order, its time signature and its Beat groups in ticks. */
export interface BeamBar<C extends BeamColumn = PlacedColumn> {
  columns: C[];
  time: TimeSignature;
  groups: number[];
}

export interface BeamGroup<C extends BeamColumn = PlacedColumn> {
  columns: C[];
}

/** Whether a column can be beamed: an eighth or shorter, a note, not a grace note. */
export function isBeamable(column: Column): boolean {
  return !column.grace && !isRest(column) && column.duration.value >= 8;
}

/**
 * The runs of beamable notes in a bar, each beamed together (a run of one gets a flag). Automatic first: in a meter counted in eighths or
 * shorter (7/8 as 2+2+3) eighths and shorter are beamed within each Beat group; in one counted in
 * quarters or halves within each beat, and in 4/4 two beats of plain eighths in the same group are one
 * beam of four, as printed music beams them (Guitar Pro's Sweet Child O' Mine, Jeremy 2026-10-28).
 * Then each note's Beam override: Break before starts a new beam, Join to previous carries on the beam
 * of the note just before it. A beam never crosses a rest, a grace note or a bar line.
 */
export function beamGroups<C extends BeamColumn>(bar: BeamBar<C>): BeamGroup<C>[] {
  const { columns, time, groups } = bar;
  const counted = time.value >= 8;
  const beat = beatTicks(time);
  const groupEnds = ends(groups);
  const groupOf = (at: number) => groupEnds.findIndex(end => at < end);
  // Each column's span (its group, or its beat) by where it starts; null for one that can't be beamed.
  const span: (number | null)[] = [];
  let at = 0;
  for (const placed of columns) {
    span.push(isBeamable(placed.column) ? (counted ? groupOf(at) : Math.floor(at / beat)) : null);
    if (!placed.column.grace) at += ticks(placed.column.duration);
  }
  // Runs: neighbours that can be beamed and share a span.
  const id: (number | null)[] = columns.map(() => null);
  let next = 0;
  span.forEach((s, i) => {
    if (s === null) return;
    id[i] = i > 0 && span[i - 1] === s && id[i - 1] !== null ? id[i - 1] : next++;
  });
  if (!counted && time.beats === 4 && time.value === 4) joinEighthBeats(columns, span, id, beat, groupOf);
  // The overrides, in order: a Join after a Break before it still joins.
  columns.forEach((placed, i) => {
    if (id[i] === null) return;
    if (placed.column.beam === 'break' && i > 0 && id[i - 1] === id[i]) renumber(id, i, id[i]!, next++);
    if (placed.column.beam === 'join' && i > 0 && id[i - 1] !== null && id[i - 1] !== id[i]) renumber(id, i, id[i]!, id[i - 1]!);
  });
  const out: BeamGroup<C>[] = [];
  columns.forEach((placed, i) => {
    if (id[i] === null) return;
    if (i > 0 && id[i - 1] === id[i]) out[out.length - 1].columns.push(placed);
    else out.push({ columns: [placed] });
  });
  return out;
}

/** A Column without its Beam override: what a change of its length leaves (spec Q12). */
export function unbeamed(column: Column): Column {
  if (!column.beam) return column;
  const rest = { ...column };
  delete rest.beam;
  return rest;
}

/** Where each group ends, from the bar's start. */
function ends(groups: number[]): number[] {
  let t = 0;
  return groups.map(g => (t += g));
}

/** From column `from` on, the run numbered `old` numbered `to`. */
function renumber(id: (number | null)[], from: number, old: number, to: number) {
  for (let k = from; k < id.length && id[k] === old; k++) id[k] = to;
}

/**
 * In 4/4: a beat that is two plain eighths, followed straight on by another in the same Beat group,
 * is beamed with it, four together; sixteenths stay by the beat.
 */
function joinEighthBeats<C extends BeamColumn>(columns: C[], span: (number | null)[], id: (number | null)[], beat: number, groupOf: (at: number) => number) {
  const pairAt = (i: number) => {
    const a = columns[i]?.column;
    const b = columns[i + 1]?.column;
    return !!a && !!b && span[i] !== null && span[i] === span[i + 1] && span[i + 2] !== span[i]
      && (i === 0 || span[i - 1] !== span[i]) && isPlainEighth(a) && isPlainEighth(b);
  };
  for (let i = 0; i + 3 < columns.length; i++) {
    if (!pairAt(i) || !pairAt(i + 2) || span[i + 2] !== span[i]! + 1) continue;
    if (groupOf(span[i]! * beat) !== groupOf(span[i + 2]! * beat)) continue;
    renumber(id, i + 2, id[i + 2]!, id[i]!);
    i += 3;
  }
}

/** An eighth with no dot and in no tuplet. */
function isPlainEighth(column: Column): boolean {
  const { value, dots, tuplet } = column.duration;
  return value === 8 && dots === 0 && !tuplet;
}
