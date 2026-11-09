// The marks in their own rows over a line's tab (under a staff alone), drawn by `TabClip`.
import type { ReactNode } from 'react';
import { columnMordent } from './clip';
import type { System } from './layout';
import type { Rows } from './rows';
import { mordentSign, vibratoWave, type MarkLit } from './marks';
import { columnRuns, RUN_MARKS, runLabelWidth, runsIn, vibratoRuns } from './runs';
import { FermataSign } from './StaffDrawing';
import { columnMarks } from './TabColumn';
import { drawnDynamics, hairpinSpan } from './dynamics';
import { litLook, type TabLook } from './tabLook';

/** What a whammy bar's run is labelled, as guitar books print it. */
const WHAMMY_LABEL = 'w/ bar';

/** The wah's sign centred on (x, y): "+" closed, "o" open, as Guitar Pro prints them. */
function WahMark({ kind, x, y, look }: { kind: 'open' | 'closed'; x: number; y: number; look: TabLook }) {
  return kind === 'closed'
    ? <path d={`M${x - 4} ${y} h8 M${x} ${y - 4} v8`} stroke={look.ink} strokeWidth={1.2} fill="none" data-testid="wah" />
    : <circle cx={x} cy={y} r={3.6} stroke={look.ink} strokeWidth={1.1} fill="none" data-testid="wah" />;
}

/** The marks in their own rows over the tab (under a staff alone): P.M. and let ring runs, and each column's stroke, vibrato, P.H. and accents. */
export function SystemRowMarks({ system, rows, look, selected = null, lit, withDynamics = true }: {
  system: System; rows: Rows; look: TabLook; selected?: [number, number] | null; lit: MarkLit;
  /** Off for another Voice's layer: the part's own line draws every Voice's dynamics (`drawnDynamics`). */
  withDynamics?: boolean;
}) {
  const parts: ReactNode[] = [];
  const inRun = (index: number) => selected !== null && index >= selected[0] && index <= selected[1];
  // Palm mute and let ring: a label, then a dashed line over the run of columns that have it.
  for (const { mark, label, has } of RUN_MARKS) {
    const y = rows[mark];
    if (y === null) continue;
    const name = mark === 'palmMute' ? 'palm-mute' : 'let-ring';
    for (const { columns, x0, x1 } of runsIn(system, has)) {
      const lw = runLabelWidth(label);
      // A run shorter than its label is the label alone: its line and end tick would cross the word.
      const longer = x1 > x0 + lw + 2;
      // A press on the line picks it as a Mark (step 8), or its columns selected light it (issue #276).
      const picked = columns.every(c => inRun(c.index)) || lit(mark, columns[0].index, null, columns[columns.length - 1].index);
      const ink = litLook(look, picked).ink;
      parts.push(
        <g key={`${name}-${columns[0].index}`} data-testid={name} data-selected={picked || undefined}>
          <text x={x0} y={y + 4} fontSize={10} fontWeight={700} fill={ink}>{label}</text>
          {longer && <line x1={x0 + lw} x2={x1} y1={y} y2={y} stroke={ink} strokeDasharray="3 3" />}
          {longer && <line x1={x1} x2={x1} y1={y - 4} y2={y + 4} stroke={ink} />}
        </g>,
      );
    }
  }

  // The whammy bar: "w/ bar" and a dashed line over each run of columns that use it, as guitar books print it.
  if (rows.whammy !== null) {
    const y = rows.whammy;
    const lw = runLabelWidth(WHAMMY_LABEL);
    for (const { columns, x0, x1 } of runsIn(system, c => !!c.whammy)) {
      const longer = x1 > x0 + lw + 2;
      const ink = litLook(look, columns.some(c => lit('whammy', c.index, null))).ink;
      parts.push(
        <g key={`whammy-run-${columns[0].index}`} data-testid="whammy-run">
          <text x={x0} y={y + 4} fontSize={10} fontStyle="italic" fill={ink}>{WHAMMY_LABEL}</text>
          {longer && <line x1={x0 + lw} x2={x1} y1={y} y2={y} stroke={ink} strokeDasharray="3 3" />}
        </g>,
      );
    }
  }

  // Fermatas, over the tab when there is no staff to carry them.
  if (rows.fermatas !== null) {
    for (const bar of system.bars) {
      for (const { column, x, index } of bar.columns) {
        if (column.fermata) parts.push(<FermataSign key={`fermata-${index}`} fermata={column.fermata} x={x} y={rows.fermatas + 5} look={litLook(look, lit('fermata', index, null))} />);
      }
    }
  }

  // Hairpins: one wedge over each run of neighbouring columns getting louder (opening) or softer (closing).
  if (rows.hairpins !== null) {
    for (const run of columnRuns(system, c => c.hairpin ?? null)) {
      const y = rows.hairpins;
      const { x0, x1 } = hairpinSpan(system, run, y);
      const [narrow, wide] = run.kind === 'crescendo' ? [x0, x1] : [x1, x0];
      const picked = lit('hairpin', run.from.index, null, run.to.index);
      parts.push(
        <path
          key={`hairpin-${run.from.index}`} d={`M${wide} ${y - 4} L${narrow} ${y} L${wide} ${y + 4}`}
          fill="none" stroke={litLook(look, picked).ink} strokeWidth={1.1} data-testid="hairpin" data-selected={picked || undefined}
        />,
      );
    }
  }

  // Dynamics: each one's letters on the hairpins' row, centred on its column (issue #437); the other Voices' too,
  // drawn by the part's own line so two at one time can stand clear of each other.
  if (rows.dynamics !== null && withDynamics) {
    for (const drawn of drawnDynamics(system, rows.dynamics)) {
      const picked = drawn.own && lit('dynamic', drawn.index, null);
      parts.push(
        <g key={`dynamic-${drawn.own ? '' : 'v'}${drawn.index}-${drawn.box.x}`} fill={litLook(look, picked).ink} data-testid="dynamic" data-dynamic={drawn.dynamic} data-selected={picked || undefined}>
          {drawn.letters.map((letter, i) => <path key={i} d={letter.d} transform={letter.transform} />)}
        </g>,
      );
    }
  }

  // Vibrato: one wave over each run of neighbouring notes that have it, over the tab under a staff too.
  if (rows.vibrato !== null) {
    for (const run of vibratoRuns(system)) {
      const { d, strokeWidth } = vibratoWave(run.from.x, rows.vibrato, run.kind === 'wide', run.end);
      const on = inRun(run.from.index) || lit('vibrato', run.from.index, null, run.to.index);
      parts.push(<path key={`vibrato-${run.from.index}`} d={d} fill="none" stroke={litLook(look, on).ink} strokeWidth={strokeWidth} data-testid="vibrato" />);
    }
  }

  for (const bar of system.bars) {
    for (const { column, x, index } of bar.columns) {
      const mordent = columnMordent(column);
      if (mordent && rows.vibrato !== null) {
        const { d, transform } = mordentSign(x, rows.vibrato, mordent);
        parts.push(<path key={`mordent-${index}`} d={d} transform={transform} fill={litLook(look, lit('mordent', index, null)).ink} data-testid="mordent" />);
      }
      if (column.stroke && rows.strokes !== null) {
        const sy = rows.strokes;
        const ink = litLook(look, lit('stroke', index, null)).ink;
        parts.push(column.stroke === 'down'
          ? <path key={`stroke-${index}`} d={`M${x - 4} ${sy + 4} v-7 h8 v7`} fill="none" stroke={ink} strokeWidth={1.5} />
          : <path key={`stroke-${index}`} d={`M${x - 4} ${sy - 4} L${x} ${sy + 4} L${x + 4} ${sy - 4}`} fill="none" stroke={ink} strokeWidth={1.5} />);
      }
      if (column.wah && rows.wah !== null) parts.push(<WahMark key={`wah-${index}`} kind={column.wah} x={x} y={rows.wah} look={litLook(look, lit('wah', index, null))} />);
      parts.push(<g key={`marks-${index}`}>{columnMarks(column, x, rows, look, mark => lit(mark, index, null))}</g>);
    }
  }
  return <>{parts}</>;
}
