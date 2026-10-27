import type { ReactNode } from 'react';
import { beatTicks, changesKey, isRest, keyAt, timeAt, tupletGroups, tupletLabel, type Clip, type TimeSignature } from './clip';
import {
  ACCIDENTAL_ROOM, beamGroups, HEAD_WIDTH, SPACE, STEM_STEPS, stemUpFor, stepY,
  type PlacedBar, type PlacedColumn, type ScoreRows, type Spot, type System,
} from './layout';
import { accidentalLanes, keySigns, STAFF_LINES, type Head } from './notation';
import { GLYPHS, type GlyphName } from './smufl';
import type { TabLook } from './TabClip';

/**
 * One line of the notation staff (issue #122; `docs/specs/2026-10-27-tab-notation-design.md`): the
 * clef with its 8 (written an octave up), the key signature on every line, the time signature on the
 * first, the bar lines, and each column's heads, accidentals, stems, beams, flags, dots, rests, ties and
 * tuplet numbers. Over the tab it carries the rhythm, so the tab under it has no stems.
 */
export function StaffDrawing({ system, si, score, clip, look, lastBar, previous }: {
  system: System;
  si: number;
  score: ScoreRows;
  clip: Clip;
  look: TabLook;
  lastBar: number;
  /** For every head, where the head before it on the same string was drawn: ties join them. */
  previous: Map<string, Spot & { step: number }>;
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];
  for (const step of STAFF_LINES) {
    const y = stepY(score, step);
    parts.push(<line key={`line-${step}`} x1={system.lineStart} x2={end} y1={y} y2={y} stroke={look.line} strokeWidth={1} />);
  }
  parts.push(<line key="open" x1={system.lineStart} x2={system.lineStart} y1={score.top} y2={score.bottom} stroke={look.ink} strokeWidth={1.5} />);

  // The treble clef curls round the G line; the small 8 under it says the music sounds an octave lower.
  const clefX = system.lineStart + 3;
  parts.push(<Glyph key="clef" name="gClef" x={clefX} y={stepY(score, 2)} look={look} />);
  parts.push(
    <text key="clef-8" x={clefX + GLYPHS.gClef.width * SPACE / 2} y={stepY(score, -5.4)} fontSize={9} fontWeight={700} fill={look.ink} textAnchor="middle">8</text>,
  );
  parts.push(<KeySignature key="key" score={score} x={system.keyX} fifths={keyAt(clip, system.bars[0].index).fifths} look={look} />);
  if (system.timeX !== null) parts.push(<StaffTime key="time" time={clip.time} x={system.timeX} score={score} look={look} />);

  for (const bar of system.bars) {
    if (bar.timeX !== null && bar.bar.time) parts.push(<StaffTime key={`time-${bar.index}`} time={bar.bar.time} x={bar.timeX} score={score} look={look} />);
    if (bar.keyX !== null && changesKey(clip, bar.index)) {
      parts.push(<KeySignature key={`key-${bar.index}`} score={score} x={bar.keyX} fifths={keyAt(clip, bar.index).fifths} look={look} />);
    }
    parts.push(<StaffBarLines key={`bar-${bar.index}`} bar={bar} score={score} look={look} final={bar.index === lastBar} />);
    parts.push(
      <StaffBar key={`notes-${bar.index}`} bar={bar} si={si} score={score} beat={beatTicks(timeAt(clip, bar.index))} look={look} previous={previous} />,
    );
  }
  return <g data-testid="staff">{parts}</g>;
}

/** A glyph from the music font, its origin at (x, y). */
function Glyph({ name, x, y, look, scale = 1 }: { name: GlyphName; x: number; y: number; look: TabLook; scale?: number }) {
  return <path d={GLYPHS[name].d} transform={`translate(${x} ${y}) scale(${SPACE * scale})`} fill={look.ink} />;
}

const KEY_SIGN_STEP = 8;

function KeySignature({ score, x, fifths, look }: { score: ScoreRows; x: number; fifths: number; look: TabLook }) {
  return (
    <g data-testid="key-signature">
      {keySigns({ fifths }).map(({ step, sharp }, k) => (
        <Glyph key={k} name={sharp ? 'accidentalSharp' : 'accidentalFlat'} x={x + k * KEY_SIGN_STEP} y={stepY(score, step)} look={look} />
      ))}
    </g>
  );
}

/** The time signature on the staff: its numbers fill the upper and lower halves. */
function StaffTime({ time, x, score, look }: { time: TimeSignature; x: number; score: ScoreRows; look: TabLook }) {
  return (
    <g fontSize={19} fontWeight={800} fill={look.ink} textAnchor="middle" data-testid="staff-time-signature">
      <text x={x} y={stepY(score, 4) - 2}>{time.beats}</text>
      <text x={x} y={stepY(score, 0) - 2}>{time.value}</text>
    </g>
  );
}

function StaffBarLines({ bar, score, look, final }: { bar: PlacedBar; score: ScoreRows; look: TabLook; final: boolean }) {
  const { x0, x1 } = bar;
  const vertical = (x: number, w: number) => <line x1={x} x2={x} y1={score.top} y2={score.bottom} stroke={look.ink} strokeWidth={w} />;
  const dots = (x: number) => [3, 5].map(step => <circle key={`${x}-${step}`} cx={x} cy={stepY(score, step)} r={1.8} fill={look.ink} />);
  const thickEnd = final || bar.bar.repeatEnd !== undefined;
  return (
    <g>
      {bar.bar.repeatStart && <g>{vertical(x0 + 2, 3)}{vertical(x0 + 7, 1)}{dots(x0 + 12)}</g>}
      {thickEnd ? (
        <g>
          {vertical(x1 - 6, 1)}
          {vertical(x1 - 1.5, 3)}
          {bar.bar.repeatEnd !== undefined && dots(x1 - 11)}
        </g>
      ) : vertical(x1, 1)}
    </g>
  );
}

/** Beams (or flags) a note value has: one for an eighth, two for a sixteenth, up to four for a sixty-fourth. */
function beamCount(value: number): number {
  return value >= 8 ? Math.log2(value) - 2 : 0;
}

const FLAGS: Record<number, [GlyphName, GlyphName]> = {
  8: ['flag8thUp', 'flag8thDown'], 16: ['flag16thUp', 'flag16thDown'], 32: ['flag32ndUp', 'flag32ndDown'], 64: ['flag64thUp', 'flag64thDown'],
};
const RESTS: Record<number, GlyphName> = {
  1: 'restWhole', 2: 'restHalf', 4: 'restQuarter', 8: 'rest8th', 16: 'rest16th', 32: 'rest32nd', 64: 'rest64th',
};
/** A grace note's heads and stem, against a full one's. */
const GRACE_SCALE = 0.65;
const BEAM_THICKNESS = 0.5 * SPACE;
const BEAM_GAP = 0.75 * SPACE;

/** Where each head of a column goes across: a head a second from the one before it sits on the stem's other side. */
function headXs(heads: Head[], left: number, up: boolean, width: number): number[] {
  const xs = heads.map(() => left);
  if (up) {
    for (let k = 1; k < heads.length; k++) if (heads[k].step - heads[k - 1].step === 1 && xs[k - 1] === left) xs[k] = left + width;
  } else {
    for (let k = heads.length - 2; k >= 0; k--) if (heads[k + 1].step - heads[k].step === 1 && xs[k + 1] === left) xs[k] = left - width;
  }
  return xs;
}

/** One bar's notes on the staff. */
function StaffBar({ bar, si, score, beat, look, previous }: {
  bar: PlacedBar;
  si: number;
  score: ScoreRows;
  beat: number;
  look: TabLook;
  previous: Map<string, Spot & { step: number }>;
}) {
  const parts: ReactNode[] = [];
  const groups = beamGroups(bar, beat);
  const groupOf = new Map<PlacedColumn, PlacedColumn[]>();
  for (const g of groups) for (const p of g.columns) groupOf.set(p, g.columns);
  // A beamed group's stems all go one way, decided by all its heads, and end on one flat beam.
  const groupUp = new Map<PlacedColumn[], boolean>();
  const beamY = new Map<PlacedColumn[], number>();
  for (const g of groups) {
    const all = g.columns.flatMap(p => p.heads).sort((a, b) => a.step - b.step);
    const up = stemUpFor(all);
    groupUp.set(g.columns, up);
    const ends = g.columns.filter(p => p.heads.length > 0).map(p => (up
      ? stepY(score, p.heads[p.heads.length - 1].step + STEM_STEPS)
      : stepY(score, p.heads[0].step - STEM_STEPS)));
    beamY.set(g.columns, up ? Math.min(...ends) : Math.max(...ends));
  }

  for (const placed of bar.columns) {
    const { column, x, heads } = placed;
    const { value, dots } = column.duration;
    const key = `${placed.index}`;
    const grace = column.grace ? GRACE_SCALE : 1;
    if (isRest(column) || heads.length === 0) {
      if (column.grace) continue;
      const restStep = value === 1 ? 6 : 4;
      const glyph = RESTS[value];
      const rx = x - GLYPHS[glyph].width * SPACE / 2;
      parts.push(<g key={`rest-${key}`} data-testid="staff-rest"><Glyph name={glyph} x={rx} y={stepY(score, restStep)} look={look} /></g>);
      for (let d = 0; d < dots; d++) parts.push(<circle key={`rdot-${key}-${d}`} cx={rx + GLYPHS[glyph].width * SPACE + 4 + d * 5} cy={stepY(score, 5)} r={1.6} fill={look.ink} />);
      continue;
    }
    const group = groupOf.get(placed);
    const up = group ? groupUp.get(group)! : placed.stemUp;
    const width = HEAD_WIDTH * grace;
    const left = x - width / 2;
    const xs = headXs(heads, left, up, width);
    const lanes = accidentalLanes(heads);
    const head: GlyphName = value === 1 ? 'noteheadWhole' : value === 2 ? 'noteheadHalf' : 'noteheadBlack';
    heads.forEach((h, k) => {
      const y = stepY(score, h.step);
      // Ledger lines from the staff out to the head: every line step below the bottom line or above the top one.
      const ledgers: number[] = [];
      for (let ls = -2; ls >= h.step; ls -= 2) ledgers.push(ls);
      for (let ls = 10; ls <= h.step; ls += 2) ledgers.push(ls);
      for (const ls of ledgers) {
        parts.push(<line key={`ledger-${key}-${k}-${ls}`} x1={xs[k] - 3} x2={xs[k] + width + 3} y1={stepY(score, ls)} y2={stepY(score, ls)} stroke={look.ink} strokeWidth={1} />);
      }
      parts.push(<g key={`head-${key}-${k}`} data-testid="staff-head"><Glyph name={h.dead ? 'noteheadXBlack' : head} x={xs[k]} y={y} look={look} scale={grace} /></g>);
      if (h.shows !== null) {
        const sign: GlyphName = h.shows > 0 ? 'accidentalSharp' : h.shows < 0 ? 'accidentalFlat' : 'accidentalNatural';
        const laneX = Math.min(...xs) - 2 - lanes[k]! * ACCIDENTAL_ROOM * grace;
        parts.push(<Glyph key={`acc-${key}-${k}`} name={sign} x={laneX - GLYPHS[sign].width * SPACE * grace} y={y} look={look} scale={grace} />);
      }
      // Dots go in the space right of the head: a head on a line puts its dot in the space above.
      const dotY = stepY(score, h.step % 2 === 0 ? h.step + 1 : h.step);
      for (let d = 0; d < dots; d++) parts.push(<circle key={`dot-${key}-${k}-${d}`} cx={Math.max(...xs) + width + 4 + d * 5} cy={dotY} r={1.6} fill={look.ink} />);
      // A tie: an arc from the head before on the same string, curving away from the stem.
      const before = previous.get(`${placed.index}:${h.string}`);
      if (column.notes[h.string]?.tie && before && before.system === si) {
        const fromX = before.x + width + 1;
        const toX = xs[k] - 2;
        // Alone, away from the stem; in a chord, the upper half's ties curve up and the lower half's down.
        const bend = heads.length > 1 ? (k >= heads.length / 2 ? -1 : 1) : up ? 1 : -1;
        const ty = y + bend * 5;
        parts.push(<path key={`tie-${key}-${k}`} d={`M${fromX} ${ty} Q${(fromX + toX) / 2} ${ty + bend * 7} ${toX} ${ty}`} fill="none" stroke={look.ink} strokeWidth={1.2} data-testid="staff-tie" />);
      }
    });

    if (value === 1) continue;
    // The stem: from the farthest head to its length past the nearest, or to the group's beam.
    const stemX = up ? left + width - 0.6 : left + 0.6;
    const low = stepY(score, heads[0].step);
    const high = stepY(score, heads[heads.length - 1].step);
    const length = STEM_STEPS * SPACE / 2 * grace;
    const tip = group && group.length > 1 ? beamY.get(group)! : up ? high - length : low + length;
    parts.push(<line key={`stem-${key}`} x1={stemX} x2={stemX} y1={up ? low : high} y2={tip} stroke={look.ink} strokeWidth={1.1} />);
    if (value >= 8 && (!group || group.length === 1)) {
      parts.push(<Glyph key={`flag-${key}`} name={FLAGS[value][up ? 0 : 1]} x={stemX - 0.5} y={tip} look={look} scale={grace} />);
    }
  }

  // Beams: the first joins the whole group; the second, third and fourth join neighbours that have them, or stub toward one.
  for (const g of groups) {
    if (g.columns.length < 2) continue;
    const up = groupUp.get(g.columns)!;
    const y0 = beamY.get(g.columns)!;
    const stemOf = (p: PlacedColumn) => (up ? p.x + HEAD_WIDTH / 2 - 0.6 : p.x - HEAD_WIDTH / 2 + 0.6);
    const beam = (k: string, xa: number, xb: number, level: number) => {
      const y = up ? y0 + (level - 1) * BEAM_GAP : y0 - (level - 1) * BEAM_GAP - BEAM_THICKNESS;
      return <rect key={k} x={Math.min(xa, xb) - 0.5} y={y} width={Math.abs(xb - xa) + 1} height={BEAM_THICKNESS} fill={look.ink} />;
    };
    parts.push(beam(`beam-${g.columns[0].index}`, stemOf(g.columns[0]), stemOf(g.columns[g.columns.length - 1]), 1));
    for (let level = 2; level <= 4; level++) {
      const has = (p?: PlacedColumn) => p !== undefined && beamCount(p.column.duration.value) >= level;
      g.columns.forEach((p, k) => {
        if (!has(p)) return;
        const next = g.columns[k + 1];
        const prev = g.columns[k - 1];
        if (has(next)) parts.push(beam(`beam${level}-${p.index}`, stemOf(p), stemOf(next), level));
        else if (!has(prev)) parts.push(beam(`stub${level}-${p.index}`, stemOf(p), stemOf(p) + (next ? 7 : -7), level));
      });
    }
  }

  // Each tuplet's number over (or under) its group, past the beam or the heads.
  const cols = bar.columns.filter(p => !p.column.grace);
  for (const { from, to, duration } of tupletGroups(cols.map(p => p.column))) {
    const members = cols.slice(from, to + 1);
    const allHeads = members.flatMap(p => p.heads).sort((a, b) => a.step - b.step);
    const group = groupOf.get(members[0]);
    const up = group ? groupUp.get(group)! : stemUpFor(allHeads);
    const reach = members.map(p => {
      const g = groupOf.get(p);
      if (g && g.length > 1) return beamY.get(g)!;
      if (p.heads.length === 0) return stepY(score, up ? 8 : 0);
      return up ? stepY(score, p.heads[p.heads.length - 1].step + STEM_STEPS) : stepY(score, p.heads[0].step - STEM_STEPS);
    });
    const y = up ? Math.min(stepY(score, 9), ...reach) - 5 : Math.max(stepY(score, -1), ...reach) + 13;
    const mid = (members[0].x + members[members.length - 1].x) / 2;
    parts.push(
      <text key={`tuplet-${members[0].index}`} x={mid} y={y} fontSize={10} fontStyle="italic" fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="staff-tuplet">
        {tupletLabel(duration)}
      </text>,
    );
  }
  return <g>{parts}</g>;
}

/** For every head, keyed by its column's place and string, where the head before it on that string was. */
export function previousHeads(systems: System[]): Map<string, Spot & { step: number }> {
  const out = new Map<string, Spot & { step: number }>();
  const last = new Map<number, Spot & { step: number }>();
  systems.forEach((system, si) => {
    for (const bar of system.bars) {
      for (const placed of bar.columns) {
        for (const h of placed.heads) {
          const before = last.get(h.string);
          if (before) out.set(`${placed.index}:${h.string}`, before);
          last.set(h.string, { system: si, x: placed.x - HEAD_WIDTH / 2, step: h.step });
        }
      }
    }
  });
  return out;
}
