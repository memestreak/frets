/** The tab's own rhythm under the strings (when no staff carries it): stems, beams, flags and rests. */

import { type ReactNode } from 'react';
import { isRest, TREMOLO_VALUES, tupletGroups, tupletLabel, type Column } from './clip';
import { type PlacedBar, type PlacedColumn, type Rows } from './layout';
import { beamGroups } from './beams';
import { MultiRest } from './StaffDrawing';
import { type TabLook } from './tabLook';

/** Stems, beams, flags, dots, tremolo slashes, tuplet numbers and rests under the staff; grace notes get none. */
export function Stems({ bar, rows, beat, look }: { bar: PlacedBar; rows: Rows; beat: number; look: TabLook }) {
  const parts: ReactNode[] = [];
  const groups = beamGroups(bar, beat);
  const grouped = new Map<Column, PlacedColumn[]>();
  for (const g of groups) for (const p of g.columns) grouped.set(p.column, g.columns);

  // A multi-bar rest: its thick bar where the rests go, its count over the tab.
  if (bar.restRun) {
    if (!bar.restRun.first) return null;
    return <MultiRest span={bar.restRun.span} count={bar.restRun.count} y={rows.stemTop + 10} countY={rows.staffTop - 6} look={look} />;
  }
  for (const placed of bar.columns) {
    const { column, x } = placed;
    const { value, dots } = column.duration;
    const key = `${x}`;
    if (column.grace) continue;
    if (column.tremolo && !isRest(column)) {
      // Tremolo picking: a slash across the stem for each beam of the speed, one for eighths up to three for thirty-seconds.
      // They start near the stem's top: a half note's short stem, or where a stem would be for a whole note.
      const slashes = TREMOLO_VALUES.indexOf(column.tremolo) + 1;
      const top = value === 2 ? rows.stemBottom - 12 : rows.stemTop + (value === 1 ? 2 : 0);
      for (let k = 0; k < slashes; k++) {
        const ty = top + 3 + k * 4;
        parts.push(<line key={`tremolo-${key}-${k}`} x1={x - 4} x2={x + 4} y1={ty + 2} y2={ty - 2} stroke={look.ink} strokeWidth={2} data-testid="tremolo" />);
      }
    }
    if (isRest(column)) {
      parts.push(<Rest key={`rest-${key}`} x={x} y={rows.stemTop + 10} value={value} look={look} />);
    } else if (value === 2) {
      parts.push(<line key={`stem-${key}`} x1={x} x2={x} y1={rows.stemBottom - 12} y2={rows.stemBottom} stroke={look.ink} strokeWidth={1.3} />);
    } else if (value >= 4) {
      parts.push(<line key={`stem-${key}`} x1={x} x2={x} y1={rows.stemTop} y2={rows.stemBottom} stroke={look.ink} strokeWidth={1.3} />);
      const group = grouped.get(column);
      if (value >= 8 && (!group || group.length === 1)) {
        // A lone eighth or shorter gets its flags.
        for (let f = 0; f < beamCount(value); f++) {
          const fy = rows.stemBottom - f * 6;
          parts.push(<path key={`flag-${key}-${f}`} d={`M${x} ${fy} q6 -2 8 -9`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
        }
      }
    }
    // A note's dots sit by its stem's foot; a rest's beside the rest, clear of a whole or half rest's line.
    const rest = isRest(column);
    const dotX = rest ? x + (value <= 2 ? 13 : 8) : x + 5;
    const dotY = rest ? rows.stemTop + (value <= 2 ? 5 : 10) : rows.stemBottom - 3;
    for (let d = 0; d < dots; d++) {
      parts.push(<circle key={`dot-${key}-${d}`} cx={dotX + d * 5} cy={dotY} r={1.8} fill={look.ink} />);
    }
  }

  for (const g of groups) {
    if (g.columns.length < 2) continue;
    const first = g.columns[0].x;
    const last = g.columns[g.columns.length - 1].x;
    parts.push(<line key={`beam-${first}`} x1={first} x2={last} y1={rows.stemBottom} y2={rows.stemBottom} stroke={look.ink} strokeWidth={3.2} />);
    // The second, third and fourth beams join neighbours that have them too; a note alone in having
    // one gets a short stub toward its neighbour.
    for (let level = 2; level <= 4; level++) {
      const has = (p?: PlacedColumn) => p !== undefined && beamCount(p.column.duration.value) >= level;
      const y = rows.stemBottom - (level - 1) * 6;
      g.columns.forEach((p, k) => {
        if (!has(p)) return;
        const next = g.columns[k + 1];
        const prev = g.columns[k - 1];
        if (has(next)) {
          parts.push(<line key={`beam${level}-${p.x}`} x1={p.x} x2={next.x} y1={y} y2={y} stroke={look.ink} strokeWidth={3.2} />);
        } else if (!has(prev)) {
          const toward = next ? 7 : -7;
          parts.push(<line key={`stub${level}-${p.x}`} x1={p.x} x2={p.x + toward} y1={y} y2={y} stroke={look.ink} strokeWidth={3.2} />);
        }
      });
    }
  }

  // Each tuplet group's number in its middle: 3 under a triplet, 9 under nine, 3:4 under three in the
  // time of four. Where one beam doesn't already join the whole group (a rest in it, or quarter notes),
  // a bracket across every member shows what the number counts. A group short of notes is drawn as it
  // is, and the warning under the bar says so.
  const cols = bar.columns.filter(p => !p.column.grace);
  for (const { from, to, duration } of tupletGroups(cols.map(p => p.column))) {
    const label = tupletLabel(duration);
    const members = cols.slice(from, to + 1);
    const beam = grouped.get(members[0].column);
    const beamed = members.length > 1 && members.every(p => grouped.get(p.column) === beam);
    const x0 = cols[from].x - 5;
    const x1 = cols[to].x + 5;
    const mid = (x0 + x1) / 2;
    const gap = label.length * 3.5 + 4;
    const y = rows.tuplet - 4;
    parts.push(
      <g key={`tuplet-${cols[from].x}`} data-testid="tuplet-group">
        {!beamed && (
          <path
            d={`M${x0} ${y - 4} V${y} H${Math.max(x0, mid - gap)} M${Math.min(x1, mid + gap)} ${y} H${x1} V${y - 4}`}
            fill="none" stroke={look.ink} strokeWidth={1} data-testid="tuplet-bracket"
          />
        )}
        <text x={mid} y={rows.tuplet} fontSize={10} fontStyle="italic" fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="tuplet">{label}</text>
      </g>,
    );
  }

  return <g>{parts}</g>;
}

function Rest({ x, y, value, look }: { x: number; y: number; value: number; look: TabLook }) {
  // A whole rest hangs from a line, a half rest sits on one. Under the tab there is no staff line to
  // show which, so each gets a short line of its own, as rests written outside a staff do.
  if (value === 1 || value === 2) {
    const line = y - 3;
    return (
      <g fill={look.ink} data-testid="rest">
        <line x1={x - 9} x2={x + 9} y1={line} y2={line} stroke={look.ink} strokeWidth={1.2} />
        <rect x={x - 6} y={value === 1 ? line : line - 5} width={12} height={5} />
      </g>
    );
  }
  if (value === 4) {
    return (
      <path
        d={`M${x - 2} ${y - 12} l5 6 l-5 5 l5 6 q-6 -2 -4 5`} fill="none" stroke={look.ink} strokeWidth={2}
        strokeLinejoin="round" data-testid="rest"
      />
    );
  }
  // Eighth rests and shorter: a slanted stem with a flag for each beam, the stem longer for three or four.
  const flags = beamCount(value);
  const length = 16 + Math.max(0, flags - 2) * 6;
  return (
    <g fill={look.ink} stroke={look.ink} data-testid="rest">
      <line x1={x + 3} y1={y - 8} x2={x + 3 - length * 5 / 16} y2={y - 8 + length} strokeWidth={1.4} />
      {Array.from({ length: flags }, (_, f) => <circle key={f} cx={x - 2 - f * 2} cy={y - 7 + f * 6} r={2.4} />)}
    </g>
  );
}

/** Beams (or flags) a note value has: one for an eighth, two for a sixteenth, up to four for a sixty-fourth. */
function beamCount(value: number): number {
  return value >= 8 ? Math.log2(value) - 2 : 0;
}
