import type { ReactNode } from 'react';
import { changesKey, isRest, keyAt, type Clip, type TimeSignature } from './clip';
import {
  ACCIDENTAL_ROOM, HEAD_WIDTH, SPACE, stepY,
  type PlacedBar, type PlacedColumn, type ScoreRows, type System,
} from './layout';
import { accidentalLanes, keySigns, STAFF_LINES } from './notation';
import { GLYPHS, type GlyphName } from './smufl';
import { GRACE_SCALE, staffBar } from './staffGeometry';
import { bendLabel, type StaffMark } from './staffMarks';
import { vibratoWave } from './marks';
import type { TabLook } from './TabClip';

/**
 * One line of the notation staff (issue #122; `docs/specs/2026-10-27-tab-notation-design.md`): the
 * treble clef (written an octave up), the key signature on every line, the time signature on the
 * first, the bar lines, and each column's heads, accidentals, stems, beams, flags, dots, rests, ties and
 * tuplet numbers. Over the tab it carries the rhythm, so the tab under it has no stems.
 */
export function StaffDrawing({ system, score, clip, look, lastBar, marks }: {
  system: System;
  score: ScoreRows;
  clip: Clip;
  look: TabLook;
  lastBar: number;
  /** The line's technique marks, ties and tuplet numbers (`staffMarks.ts`). */
  marks: StaffMark[];
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];
  for (const step of STAFF_LINES) {
    const y = stepY(score, step);
    parts.push(<line key={`line-${step}`} x1={system.lineStart} x2={end} y1={y} y2={y} stroke={look.line} strokeWidth={1} />);
  }
  parts.push(<line key="open" x1={system.lineStart} x2={system.lineStart} y1={score.top} y2={score.bottom} stroke={look.ink} strokeWidth={1.5} />);

  // The treble clef curls round the G line. Guitar is written an octave above how it sounds; as in
  // most guitar books, the clef carries no 8 to say so (Jeremy, 2026-10-27).
  parts.push(<Glyph key="clef" name="gClef" x={system.lineStart + 3} y={stepY(score, 2)} look={look} />);
  parts.push(<KeySignature key="key" score={score} x={system.keyX} fifths={keyAt(clip, system.bars[0].index).fifths} look={look} />);
  if (system.timeX !== null) parts.push(<StaffTime key="time" time={clip.time} x={system.timeX} score={score} look={look} />);

  for (const bar of system.bars) {
    if (bar.timeX !== null && bar.bar.time) parts.push(<StaffTime key={`time-${bar.index}`} time={bar.bar.time} x={bar.timeX} score={score} look={look} />);
    if (bar.keyX !== null && changesKey(clip, bar.index)) {
      parts.push(<KeySignature key={`key-${bar.index}`} score={score} x={bar.keyX} fifths={keyAt(clip, bar.index).fifths} look={look} />);
    }
    parts.push(<StaffBarLines key={`bar-${bar.index}`} bar={bar} score={score} look={look} final={bar.index === lastBar} />);
    parts.push(
      <StaffBar key={`notes-${bar.index}`} bar={bar} score={score} look={look} />,
    );
  }
  marks.forEach((mark, k) => parts.push(<StaffMarkDrawing key={`mark-${k}`} mark={mark} look={look} />));
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
const HEADS: GlyphName[] = ['noteheadWhole', 'noteheadHalf', 'noteheadBlack'];
const X_HEADS: GlyphName[] = ['noteheadXWhole', 'noteheadXHalf', 'noteheadXBlack'];
const DIAMOND_HEADS: GlyphName[] = ['noteheadDiamondWhole', 'noteheadDiamondHalf', 'noteheadDiamondBlack'];
const BEAM_THICKNESS = 0.5 * SPACE;
const BEAM_GAP = 0.75 * SPACE;

/** One bar's notes on the staff. */
function StaffBar({ bar, score, look }: { bar: PlacedBar; score: ScoreRows; look: TabLook }) {
  const parts: ReactNode[] = [];
  const { columns: geometry, groups, groupUp, beamY } = staffBar(bar, score);

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
    const { up, width, xs, stemX, tip, group } = geometry.get(placed)!;
    const lanes = accidentalLanes(heads);
    const shape = value === 1 ? 0 : value === 2 ? 1 : 2;
    heads.forEach((h, k) => {
      const note = column.notes[h.string];
      // A dead note is an ×; a natural harmonic a diamond, as printed guitar music has them.
      const head = h.dead ? X_HEADS[shape] : note?.harmonic === 'natural' ? DIAMOND_HEADS[shape] : HEADS[shape];
      const y = stepY(score, h.step);
      // Ledger lines from the staff out to the head: every line step below the bottom line or above the top one.
      const ledgers: number[] = [];
      for (let ls = -2; ls >= h.step; ls -= 2) ledgers.push(ls);
      for (let ls = 10; ls <= h.step; ls += 2) ledgers.push(ls);
      for (const ls of ledgers) {
        parts.push(<line key={`ledger-${key}-${k}-${ls}`} x1={xs[k] - 3} x2={xs[k] + width + 3} y1={stepY(score, ls)} y2={stepY(score, ls)} stroke={look.ink} strokeWidth={1} />);
      }
      parts.push(<g key={`head-${key}-${k}`} data-testid="staff-head"><Glyph name={head} x={xs[k]} y={y} look={look} scale={grace} /></g>);
      // A ghost note's head in brackets.
      if (note?.ghost) {
        const open = GLYPHS.noteheadParenthesisLeft.width * SPACE * grace;
        parts.push(
          <g key={`ghost-${key}-${k}`} data-testid="staff-ghost">
            <Glyph name="noteheadParenthesisLeft" x={xs[k] - open - 1} y={y} look={look} scale={grace} />
            <Glyph name="noteheadParenthesisRight" x={xs[k] + GLYPHS[head].width * SPACE * grace + 1} y={y} look={look} scale={grace} />
          </g>,
        );
      }
      if (h.shows !== null) {
        const sign: GlyphName = h.shows > 0 ? 'accidentalSharp' : h.shows < 0 ? 'accidentalFlat' : 'accidentalNatural';
        const laneX = Math.min(...xs) - 2 - lanes[k]! * ACCIDENTAL_ROOM * grace;
        parts.push(<Glyph key={`acc-${key}-${k}`} name={sign} x={laneX - GLYPHS[sign].width * SPACE * grace} y={y} look={look} scale={grace} />);
      }
      // Dots go in the space right of the head: a head on a line puts its dot in the space above.
      const dotY = stepY(score, h.step % 2 === 0 ? h.step + 1 : h.step);
      for (let d = 0; d < dots; d++) parts.push(<circle key={`dot-${key}-${k}-${d}`} cx={Math.max(...xs) + width + 4 + d * 5} cy={dotY} r={1.6} fill={look.ink} />);
    });

    if (tip === null) continue;
    // The stem: from the farthest head to its length past the nearest, or to the group's beam.
    const low = stepY(score, heads[0].step);
    const high = stepY(score, heads[heads.length - 1].step);
    parts.push(<line key={`stem-${key}`} x1={stemX} x2={stemX} y1={up ? low : high} y2={tip} stroke={look.ink} strokeWidth={1.1} />);
    if (value >= 8 && !group) {
      parts.push(<Glyph key={`flag-${key}`} name={FLAGS[value][up ? 0 : 1]} x={stemX - 0.5} y={tip} look={look} scale={grace} />);
    }
  }

  // Beams: the first joins the whole group; the second, third and fourth join neighbours that have them, or stub toward one.
  for (const g of groups) {
    if (g.length < 2) continue;
    const up = groupUp.get(g)!;
    const y0 = beamY.get(g)!;
    const stemOf = (p: PlacedColumn) => (up ? p.x + HEAD_WIDTH / 2 - 0.6 : p.x - HEAD_WIDTH / 2 + 0.6);
    const beam = (k: string, xa: number, xb: number, level: number) => {
      const y = up ? y0 + (level - 1) * BEAM_GAP : y0 - (level - 1) * BEAM_GAP - BEAM_THICKNESS;
      return <rect key={k} x={Math.min(xa, xb) - 0.5} y={y} width={Math.abs(xb - xa) + 1} height={BEAM_THICKNESS} fill={look.ink} />;
    };
    parts.push(beam(`beam-${g[0].index}`, stemOf(g[0]), stemOf(g[g.length - 1]), 1));
    for (let level = 2; level <= 4; level++) {
      const has = (p?: PlacedColumn) => p !== undefined && beamCount(p.column.duration.value) >= level;
      g.forEach((p, k) => {
        if (!has(p)) return;
        const next = g[k + 1];
        const prev = g[k - 1];
        if (has(next)) parts.push(beam(`beam${level}-${p.index}`, stemOf(p), stemOf(next), level));
        else if (!has(prev)) parts.push(beam(`stub${level}-${p.index}`, stemOf(p), stemOf(p) + (next ? 7 : -7), level));
      });
    }
  }

  return <g>{parts}</g>;
}

/** One of the staff's marks (`staffMarks.ts`), drawn as the tab draws its own where they share a look. */
function StaffMarkDrawing({ mark, look }: { mark: StaffMark; look: TabLook }) {
  switch (mark.kind) {
    case 'accent': {
      const { x, y, heavy, above } = mark;
      if (!heavy) return <path d={`M${x - 5} ${y - 4} L${x + 5} ${y} L${x - 5} ${y + 4}`} fill="none" stroke={look.ink} strokeWidth={1.5} data-testid="staff-accent" />;
      // A heavy accent points away from the head: ^ over it, v under it.
      const tipY = above ? y - 5 : y + 5;
      const baseY = above ? y + 4 : y - 4;
      return <path d={`M${x - 4} ${baseY} L${x} ${tipY} L${x + 4} ${baseY}`} fill="none" stroke={look.ink} strokeWidth={1.8} data-testid="staff-accent" />;
    }
    case 'staccato':
      return <circle cx={mark.x} cy={mark.y} r={1.8} fill={look.ink} data-testid="staff-staccato" />;
    case 'vibrato': {
      const { d, strokeWidth } = vibratoWave(mark.x, mark.y, mark.wide);
      return <path d={d} fill="none" stroke={look.ink} strokeWidth={strokeWidth} data-testid="staff-vibrato" />;
    }
    case 'tremolo':
      return (
        <g data-testid="staff-tremolo">
          {Array.from({ length: mark.slashes }, (_, k) => {
            const ty = mark.y + (k - (mark.slashes - 1) / 2) * 5;
            return <line key={k} x1={mark.x - 4} x2={mark.x + 4} y1={ty + 2} y2={ty - 2} stroke={look.ink} strokeWidth={2} />;
          })}
        </g>
      );
    case 'arc': {
      const { x0, y0, x1, y1, bow, tie } = mark;
      return (
        <path
          d={`M${x0} ${y0} Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + bow} ${x1} ${y1}`} fill="none" stroke={look.ink} strokeWidth={1.2}
          data-testid={tie ? 'staff-tie' : 'staff-slur'}
        />
      );
    }
    case 'line':
      return <line x1={mark.x0} y1={mark.y0} x2={mark.x1} y2={mark.y1} stroke={look.ink} strokeWidth={1.2} data-testid="staff-slide" />;
    case 'bend': {
      const { x, y, top, bend } = mark;
      const head = (tx: number, ty: number, down = false) => (
        <path d={down ? `M${tx - 3.5} ${ty - 6} L${tx} ${ty} L${tx + 3.5} ${ty - 6}` : `M${tx - 3.5} ${ty + 6} L${tx} ${ty} L${tx + 3.5} ${ty + 6}`} fill={look.ink} />
      );
      const peakX = bend.pre ? x - 4 : x + 8;
      return (
        <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="staff-bend">
          {bend.pre
            ? <line x1={peakX} x2={peakX} y1={y - 6} y2={top + 2} />
            : <path d={`M${x + 1} ${y} Q${peakX} ${y} ${peakX} ${top + 2}`} />}
          {head(peakX, top)}
          {bend.release && <path d={`M${peakX + 1} ${top} Q${peakX + 9} ${top} ${peakX + 9} ${y - 6}`} />}
          {bend.release && head(peakX + 9, y - 6, true)}
          <text x={peakX} y={top - 4} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" textAnchor="middle">{bendLabel(bend)}</text>
        </g>
      );
    }
    case 'tap':
      return <text x={mark.x} y={mark.y} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="staff-tap">T</text>;
    case 'tuplet':
      return (
        <text x={mark.x} y={mark.y} fontSize={10} fontStyle="italic" fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="staff-tuplet">
          {mark.label}
        </text>
      );
  }
}
