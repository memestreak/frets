import type { ReactNode } from 'react';
import {
  beatTicks, isRest, isUneven, STRING_COUNT,
  type Bend, type Clip, type Column, type Note,
} from './clip';
import {
  beamGroups, layoutClip, noteLabel, ROW, STAFF_BOTTOM, stringY, SYSTEM_HEIGHT,
  type PlacedBar, type PlacedColumn, type System,
} from './layout';

/** The colours a clip is drawn in: tokens on the page, concrete colours in an export. */
export interface TabLook {
  ink: string;
  /** The string lines. */
  line: string;
  /** Behind a note's number, so the line doesn't run through it. */
  paper: string;
  /** Behind guessed columns and bars that don't add up. */
  wash: string;
}

export const PAGE_LOOK: TabLook = {
  ink: 'var(--ink)',
  line: 'var(--line-strong)',
  paper: 'var(--surface-raised)',
  wash: 'var(--warning)',
};

const BEND_LABEL: Record<number, string> = { 1: '¼', 2: '½', 4: 'full', 6: '1½', 8: '2' };

/** Where a note was drawn, so the next note on its string can join it. */
interface Spot {
  system: number;
  x: number;
}

/**
 * A clip drawn as tab: systems of six lines with the notes, their marks
 * above the staff and rhythm stems below. Draws what `layoutClip` places
 * and knows no ASCII.
 */
export function TabClip({ clip, width, look = PAGE_LOOK, title }: {
  clip: Clip;
  width: number;
  look?: TabLook;
  /** Read by screen readers; the drawing itself is hidden from them. */
  title: string;
}) {
  const layout = layoutClip(clip, width);
  const previous = previousSpots(layout.systems);
  const lastBar = clip.bars.length - 1;
  return (
    <svg
      width={width} height={layout.height} viewBox={`0 0 ${width} ${layout.height}`}
      role="img" aria-label={title} fontFamily="var(--font-sans), sans-serif"
      className="block"
    >
      {layout.systems.map((system, si) => (
        <g key={si} transform={`translate(0 ${si * SYSTEM_HEIGHT})`} data-testid="tab-system">
          <SystemDrawing
            system={system} index={si} clip={clip} look={look} names={layout.names}
            previous={previous} lastBar={lastBar}
          />
        </g>
      ))}
    </svg>
  );
}

/** For every note, where the note before it on the same string was drawn. */
function previousSpots(systems: System[]): Map<Note, Spot> {
  const out = new Map<Note, Spot>();
  const last: (Spot | null)[] = Array(STRING_COUNT).fill(null);
  systems.forEach((system, si) => {
    for (const bar of system.bars) {
      for (const placed of bar.columns) {
        placed.column.notes.forEach((note, s) => {
          if (!note) return;
          const before = last[s];
          if (before) out.set(note, before);
          last[s] = { system: si, x: placed.x };
        });
      }
    }
  });
  return out;
}

function SystemDrawing({ system, index, clip, look, names, previous, lastBar }: {
  system: System;
  index: number;
  clip: Clip;
  look: TabLook;
  names: string[] | null;
  previous: Map<Note, Spot>;
  lastBar: number;
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];
  const beat = beatTicks(clip.time);

  // Washes first, under everything.
  for (const bar of system.bars) {
    if (isUneven(bar.bar, clip.time)) {
      parts.push(
        <rect
          key={`uneven-${bar.index}`} x={bar.x0 + 2} y={ROW.staffTop - 8} width={bar.x1 - bar.x0 - 4}
          height={ROW.stemBottom - ROW.staffTop + 12} fill={look.wash} opacity={0.12}
          data-testid="uneven-bar"
        />,
      );
    }
    for (const placed of bar.columns) {
      if (!placed.column.guessed) continue;
      parts.push(
        <rect
          key={`guess-${bar.index}-${placed.x}`} x={placed.x - placed.width / 2 + 1} y={ROW.staffTop - 8}
          width={placed.width - 2} height={ROW.stemBottom - ROW.staffTop + 12}
          fill={look.wash} opacity={0.18} rx={3} data-testid="guessed-column"
        />,
      );
    }
  }

  // The staff: lines, names, TAB, time signature.
  for (let s = 0; s < STRING_COUNT; s++) {
    parts.push(
      <line key={`string-${s}`} x1={system.staffStart} x2={end} y1={stringY(s)} y2={stringY(s)} stroke={look.line} strokeWidth={1} />,
    );
    if (names) {
      parts.push(
        <text key={`name-${s}`} x={6} y={stringY(s) + 4} fontSize={10} fill={look.ink} textAnchor="middle">{names[s]}</text>,
      );
    }
  }
  parts.push(
    <line key="open" x1={system.staffStart} x2={system.staffStart} y1={ROW.staffTop} y2={STAFF_BOTTOM} stroke={look.ink} strokeWidth={1.5} />,
  );
  const clefX = (names ? 16 : 0) + 13;
  ['T', 'A', 'B'].forEach((letter, k) => parts.push(
    <text key={`clef-${letter}`} x={clefX} y={ROW.staffTop + 19 + k * 20} fontSize={15} fontWeight={700} fill={look.ink} textAnchor="middle">{letter}</text>,
  ));
  if (system.first) {
    const tx = clefX + 25;
    parts.push(
      <text key="time-top" x={tx} y={ROW.staffTop + 30} fontSize={22} fontWeight={700} fill={look.ink} textAnchor="middle">{clip.time.beats}</text>,
      <text key="time-bottom" x={tx} y={ROW.staffTop + 62} fontSize={22} fontWeight={700} fill={look.ink} textAnchor="middle">{clip.time.value}</text>,
    );
  }

  for (const bar of system.bars) parts.push(<BarDrawing key={`bar-${bar.index}`} bar={bar} look={look} final={bar.index === lastBar} />);

  // Endings: one bracket over each run of bars with the same ending.
  system.bars.forEach((bar, k) => {
    const n = bar.bar.ending;
    if (!n || system.bars[k - 1]?.bar.ending === n) return;
    let last = k;
    while (system.bars[last + 1]?.bar.ending === n) last++;
    const x0 = bar.x0 + 4;
    const x1 = system.bars[last].x1 - 4;
    parts.push(
      <g key={`ending-${bar.index}`} stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="ending">
        <polyline points={`${x0},${ROW.endings + 8} ${x0},${ROW.endings - 4} ${x1},${ROW.endings - 4}`} />
        <text x={x0 + 4} y={ROW.endings + 6} fontSize={11} fontWeight={700} fill={look.ink} stroke="none">{n}.</text>
      </g>,
    );
  });

  // Palm mute runs.
  const placedAll = system.bars.flatMap(b => b.columns);
  placedAll.forEach((placed, k) => {
    if (!placed.column.palmMute || placedAll[k - 1]?.column.palmMute) return;
    let last = k;
    while (placedAll[last + 1]?.column.palmMute) last++;
    const x0 = placed.x - 8;
    const x1 = placedAll[last].x + 8;
    parts.push(
      <g key={`pm-${k}`} data-testid="palm-mute">
        <text x={x0} y={ROW.palmMute + 4} fontSize={10} fontWeight={700} fill={look.ink}>P.M.</text>
        {x1 > x0 + 28 && (
          <line x1={x0 + 26} x2={x1} y1={ROW.palmMute} y2={ROW.palmMute} stroke={look.ink} strokeDasharray="3 3" />
        )}
        <line x1={x1} x2={x1} y1={ROW.palmMute - 4} y2={ROW.palmMute + 4} stroke={look.ink} />
      </g>,
    );
  });

  for (const bar of system.bars) {
    for (const placed of bar.columns) {
      parts.push(
        <ColumnDrawing
          key={`col-${bar.index}-${placed.x}`} placed={placed} system={index} look={look}
          previous={previous} staffStart={system.staffStart}
        />,
      );
    }
    parts.push(<Stems key={`stems-${bar.index}`} bar={bar} beat={beat} look={look} />);
  }

  return <>{parts}</>;
}

function BarDrawing({ bar, look, final }: { bar: PlacedBar; look: TabLook; final: boolean }) {
  const { x0, x1 } = bar;
  const dots = (x: number) => [1.5, 3.5].map(k => (
    <circle key={`${x}-${k}`} cx={x} cy={ROW.staffTop + k * ROW.stringGap} r={2.2} fill={look.ink} />
  ));
  const vertical = (x: number, w: number) => (
    <line x1={x} x2={x} y1={ROW.staffTop} y2={STAFF_BOTTOM} stroke={look.ink} strokeWidth={w} />
  );
  const thickEnd = final || bar.bar.repeatEnd !== undefined;
  return (
    <g>
      {bar.bar.repeatStart && (
        <g data-testid="repeat-start">
          {vertical(x0 + 2, 3)}
          {vertical(x0 + 7, 1)}
          {dots(x0 + 12)}
        </g>
      )}
      {thickEnd ? (
        <g>
          {vertical(x1 - 6, 1)}
          {vertical(x1 - 1.5, 3)}
          {bar.bar.repeatEnd !== undefined && <g data-testid="repeat-end">{dots(x1 - 11)}</g>}
        </g>
      ) : vertical(x1, 1)}
      {bar.bar.repeatEnd !== undefined && bar.bar.repeatEnd !== 2 && (
        <text x={x1} y={ROW.endings + 6} fontSize={11} fontWeight={700} fill={look.ink} textAnchor="end">
          ×{bar.bar.repeatEnd}
        </text>
      )}
    </g>
  );
}

function ColumnDrawing({ placed, system, look, previous, staffStart }: {
  placed: PlacedColumn;
  system: number;
  look: TabLook;
  previous: Map<Note, Spot>;
  staffStart: number;
}) {
  const { column, x } = placed;
  const parts: ReactNode[] = [];
  if (column.stroke) {
    parts.push(column.stroke === 'down'
      ? <path key="stroke" d={`M${x - 4} ${ROW.strokes + 4} v-7 h8 v7`} fill="none" stroke={look.ink} strokeWidth={1.5} />
      : <path key="stroke" d={`M${x - 4} ${ROW.strokes - 4} L${x} ${ROW.strokes + 4} L${x + 4} ${ROW.strokes - 4}`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
  }
  let marksDrawn = false;
  // A whole chord held over draws its numbers in brackets; arcs on every string would only clutter it.
  const fewTies = column.notes.filter(n => n?.tie).length <= 2;
  column.notes.forEach((note, s) => {
    if (!note) return;
    const y = stringY(s);
    const label = noteLabel(note);
    const lw = label.length * 7 + 4;
    const before = previous.get(note);
    // Where the joined-from note sits on this system, or the staff's start if it was on the line before.
    const fromX = before && before.system === system ? before.x : staffStart;
    if (note.legato) {
      const mid = (fromX + x) / 2;
      parts.push(
        <g key={`legato-${s}`}>
          <path d={`M${fromX + 4} ${y - 8} Q${mid} ${y - 18} ${x - 4} ${y - 8}`} fill="none" stroke={look.ink} strokeWidth={1.1} />
          <text x={mid} y={y - 17} fontSize={9} fontWeight={700} fill={look.ink} textAnchor="middle">{note.legato.toUpperCase()}</text>
        </g>,
      );
    }
    if (note.slide) {
      const up = note.slide === 'up';
      const from = before ? fromX + 7 : x - 16;
      parts.push(
        <line
          key={`slide-${s}`} x1={from} x2={x - 7} y1={y + (up ? 3 : -3)} y2={y + (up ? -3 : 3)}
          stroke={look.ink} strokeWidth={1.2}
        />,
      );
    }
    if (note.tie && before && fewTies) {
      parts.push(
        <path key={`tie-${s}`} d={`M${fromX + 4} ${y + 7} Q${(fromX + x) / 2} ${y + 15} ${x - 10} ${y + 7}`} fill="none" stroke={look.ink} strokeWidth={1.1} />,
      );
    }
    parts.push(
      <rect key={`knock-${s}`} x={x - lw / 2} y={y - 7} width={lw} height={14} fill={look.paper} />,
      <text key={`fret-${s}`} x={x} y={y + 4.5} fontSize={13} fontWeight={600} fill={look.ink} textAnchor="middle">{label}</text>,
    );
    if (note.bend) parts.push(<BendDrawing key={`bend-${s}`} bend={note.bend} x={x} y={y} look={look} />);
    if (!marksDrawn && note.vibrato) {
      marksDrawn = true;
      let d = `M${x + 4} ${ROW.marks}`;
      for (let k = 0; k < 4; k++) d += ' q3 -4 6 0 q3 4 6 0';
      parts.push(<path key="vibrato" d={d} fill="none" stroke={look.ink} strokeWidth={1.2} data-testid="vibrato" />);
    }
    if (note.tap) {
      parts.push(<text key={`tap-${s}`} x={x} y={y - 10} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle">T</text>);
    }
  });
  return <g data-testid="tab-column">{parts}</g>;
}

function BendDrawing({ bend, x, y, look }: { bend: Bend; x: number; y: number; look: TabLook }) {
  const top = ROW.staffTop - 10;
  const head = (tx: number, ty: number, down = false) => (
    <path d={down ? `M${tx - 4} ${ty - 7} L${tx} ${ty} L${tx + 4} ${ty - 7}` : `M${tx - 4} ${ty + 7} L${tx} ${ty} L${tx + 4} ${ty + 7}`} fill={look.ink} />
  );
  const label = (
    <text x={bend.pre ? x : x + 14} y={top - 4} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" textAnchor="middle">
      {BEND_LABEL[bend.quarters]}
    </text>
  );
  if (bend.pre) {
    return (
      <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend">
        <line x1={x} x2={x} y1={y - 8} y2={top + 2} />
        {head(x, top)}
        {bend.release && <path d={`M${x + 2} ${top} Q${x + 14} ${top} ${x + 14} ${y - 8}`} />}
        {bend.release && head(x + 14, y - 8, true)}
        {label}
      </g>
    );
  }
  return (
    <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend">
      <path d={`M${x + 7} ${y - 2} Q${x + 14} ${y - 2} ${x + 14} ${top + 2}`} />
      {head(x + 14, top)}
      {bend.release && <path d={`M${x + 15} ${top} Q${x + 24} ${top} ${x + 24} ${y - 8}`} />}
      {bend.release && head(x + 24, y - 8, true)}
      {label}
    </g>
  );
}

/** Stems, beams, flags, dots, triplet numbers and rests under the staff. */
function Stems({ bar, beat, look }: { bar: PlacedBar; beat: number; look: TabLook }) {
  const parts: ReactNode[] = [];
  const groups = beamGroups(bar, beat);
  const grouped = new Map<Column, PlacedColumn[]>();
  for (const g of groups) for (const p of g.columns) grouped.set(p.column, g.columns);

  for (const placed of bar.columns) {
    const { column, x } = placed;
    const { value, dotted } = column.duration;
    const key = `${x}`;
    if (isRest(column)) {
      parts.push(<Rest key={`rest-${key}`} x={x} value={value} look={look} />);
    } else if (value === 2) {
      parts.push(<line key={`stem-${key}`} x1={x} x2={x} y1={ROW.stemBottom - 12} y2={ROW.stemBottom} stroke={look.ink} strokeWidth={1.3} />);
    } else if (value >= 4) {
      parts.push(<line key={`stem-${key}`} x1={x} x2={x} y1={ROW.stemTop} y2={ROW.stemBottom} stroke={look.ink} strokeWidth={1.3} />);
      const group = grouped.get(column);
      if (value >= 8 && (!group || group.length === 1)) {
        // A lone eighth or sixteenth gets flags.
        for (let f = 0; f < (value === 16 ? 2 : 1); f++) {
          const fy = ROW.stemBottom - f * 6;
          parts.push(<path key={`flag-${key}-${f}`} d={`M${x} ${fy} q6 -2 8 -9`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
        }
      }
    }
    if (dotted) parts.push(<circle key={`dot-${key}`} cx={x + 5} cy={ROW.stemBottom - 3} r={1.8} fill={look.ink} />);
  }

  for (const g of groups) {
    if (g.columns.length < 2) continue;
    const first = g.columns[0].x;
    const last = g.columns[g.columns.length - 1].x;
    parts.push(<line key={`beam-${first}`} x1={first} x2={last} y1={ROW.stemBottom} y2={ROW.stemBottom} stroke={look.ink} strokeWidth={3.2} />);
    g.columns.forEach((p, k) => {
      if (p.column.duration.value !== 16) return;
      const next = g.columns[k + 1];
      const prev = g.columns[k - 1];
      const y = ROW.stemBottom - 6;
      if (next?.column.duration.value === 16) {
        parts.push(<line key={`beam2-${p.x}`} x1={p.x} x2={next.x} y1={y} y2={y} stroke={look.ink} strokeWidth={3.2} />);
      } else if (prev?.column.duration.value !== 16) {
        const toward = next ? 7 : -7;
        parts.push(<line key={`stub-${p.x}`} x1={p.x} x2={p.x + toward} y1={y} y2={y} stroke={look.ink} strokeWidth={3.2} />);
      }
    });
  }

  // Triplet numbers under each run of triplets.
  const cols = bar.columns;
  cols.forEach((p, k) => {
    if (!p.column.duration.triplet || cols[k - 1]?.column.duration.triplet) return;
    let last = k;
    while (cols[last + 1]?.column.duration.triplet && last - k < 2) last++;
    parts.push(
      <text key={`tuplet-${p.x}`} x={(p.x + cols[last].x) / 2} y={ROW.tuplet} fontSize={10} fontStyle="italic" fontWeight={700} fill={look.ink} textAnchor="middle">3</text>,
    );
  });

  return <g>{parts}</g>;
}

function Rest({ x, value, look }: { x: number; value: number; look: TabLook }) {
  const y = ROW.stemTop + 10;
  if (value === 1) return <rect x={x - 6} y={y - 6} width={12} height={5} fill={look.ink} data-testid="rest" />;
  if (value === 2) return <rect x={x - 6} y={y - 1} width={12} height={5} fill={look.ink} data-testid="rest" />;
  if (value === 4) {
    return (
      <path
        d={`M${x - 2} ${y - 12} l5 6 l-5 5 l5 6 q-6 -2 -4 5`} fill="none" stroke={look.ink} strokeWidth={2}
        strokeLinejoin="round" data-testid="rest"
      />
    );
  }
  // Eighth and sixteenth rests: a slanted stem with one or two flags.
  return (
    <g fill={look.ink} stroke={look.ink} data-testid="rest">
      <line x1={x + 3} y1={y - 8} x2={x - 2} y2={y + 8} strokeWidth={1.4} />
      <circle cx={x - 2} cy={y - 7} r={2.4} />
      {value === 16 && <circle cx={x - 4} cy={y - 1} r={2.4} />}
    </g>
  );
}
