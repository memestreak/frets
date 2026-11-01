import type { ReactNode } from 'react';
import { changesKey, isRest, keyAt, startsFreeTime, timeAt, type Part, type Column, type Fermata, type TimeSignature } from './clip';
import { ACCIDENTAL_ROOM, accidentalRoom, BEND_FROM_ROOM, BEND_LABEL_STEP, HEAD_WIDTH, SPACE, STEM_STEPS, stepY, type PlacedBar, type PlacedColumn, type ScoreRows, type System } from './layout';
import type { Accidental } from '@/lib/theory/keys';
import { accidentalLanes, keySigns, STAFF_LINES, type Head, type SmallHead } from './notation';
import { GLYPHS, type GlyphName } from './smufl';
import { GRACE_SCALE, staffBar } from './staffGeometry';
import { bendLabel, type StaffMark } from './staffMarks';
import { mordentSign, vibratoWave } from './marks';
import type { TabLook } from './tabLook';
import { TapSign } from './TapSign';

/**
 * One line of the notation staff (issue #122; `docs/specs/2026-10-27-tab-notation-design.md`): the
 * treble clef (written an octave up), the key signature on every line, the time signature on the
 * first, the bar lines, and each column's heads, accidentals, stems, beams, flags, dots, rests, ties and
 * tuplet numbers. Over the tab it carries the rhythm, so the tab under it has no stems.
 */
export function StaffDrawing({ system, score, clip, look, lastBar, marks, alone = false, selected = null, selectedNote = null }: {
  system: System;
  score: ScoreRows;
  clip: Part;
  look: TabLook;
  lastBar: number;
  /** The line's technique marks, ties and tuplet numbers (`staffMarks.ts`). */
  marks: StaffMark[];
  /** The staff without the tab: its bends' arrows show a let-down bend coming back, so no head does. */
  alone?: boolean;
  /** The selected run of columns (places in the clip): their heads are drawn in `--primary`, as MuseScore colours selected notes. */
  selected?: [number, number] | null;
  /**
   * The one note selected in normal mode (issue #276): its head, sign, brackets, ledger lines and dots drawn
   * in `--primary` where they are, so a sign moved left for a chord lights with its note.
   */
  selectedNote?: NoteAt | null;
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
    if (bar.timeX !== null) {
      const free = startsFreeTime(clip, bar.index);
      parts.push(<StaffTime key={`time-${bar.index}`} time={timeAt(clip, bar.index)} x={bar.timeX} score={score} look={look} brackets={free} />);
    }
    if (bar.keyX !== null && changesKey(clip, bar.index)) {
      parts.push(<KeySignature key={`key-${bar.index}`} score={score} x={bar.keyX} fifths={keyAt(clip, bar.index).fifths} look={look} />);
    }
    parts.push(<StaffBarLines key={`bar-${bar.index}`} bar={bar} score={score} look={look} final={bar.index === lastBar} />);
    parts.push(
      <StaffBar key={`notes-${bar.index}`} bar={bar} score={score} look={look} alone={alone} selected={selected} selectedNote={selectedNote} />,
    );
  }
  const litLook = { ...look, ink: 'var(--primary)' };
  const inRun = (index: number) => selected !== null && index >= selected[0] && index <= selected[1];
  marks.forEach((mark, k) => parts.push(<StaffMarkDrawing key={`mark-${k}`} mark={mark} look={inRun(mark.hit.index) ? litLook : look} />));
  return <g data-testid="staff">{parts}</g>;
}

/** The ledger lines a head on a step needs, above or below the staff. */
function ledgerSteps(step: number): number[] {
  const ledgers: number[] = [];
  for (let ls = -2; ls >= step; ls -= 2) ledgers.push(ls);
  for (let ls = 10; ls <= step; ls += 2) ledgers.push(ls);
  return ledgers;
}

/**
 * The staff's own cursor (issue #136): an outlined head at the pitch Enter would put on the column, with
 * its ledger lines and, when the key doesn't give it, its sharp, flat or natural. In normal mode (issue
 * #238) it marks the selected note instead, `selected`: the head filled in the primary colour, as
 * MuseScore colours a selected note.
 */
export function StaffCursor({ x, step, sign, score, selected = false }: { x: number; step: number; sign: -1 | 0 | 1 | null; score: ScoreRows; selected?: boolean }) {
  const y = stepY(score, step);
  const left = x - HEAD_WIDTH / 2;
  const signGlyph: GlyphName | null = sign === null ? null : sign > 0 ? 'accidentalSharp' : sign < 0 ? 'accidentalFlat' : 'accidentalNatural';
  return (
    <g data-testid={selected ? 'staff-selected' : 'staff-cursor'} pointerEvents="none">
      {ledgerSteps(step).map(ls => (
        <line key={ls} x1={left - 3} x2={left + HEAD_WIDTH + 3} y1={stepY(score, ls)} y2={stepY(score, ls)} stroke="var(--primary)" strokeWidth={1} />
      ))}
      <path
        d={GLYPHS.noteheadBlack.d} transform={`translate(${left} ${y}) scale(${SPACE})`}
        fill="var(--primary)" fillOpacity={selected ? 1 : 0.3} stroke={selected ? 'none' : 'var(--primary)'} strokeWidth={1.5 / SPACE}
      />
      {signGlyph && <path d={GLYPHS[signGlyph].d} transform={`translate(${left - ACCIDENTAL_ROOM} ${y}) scale(${SPACE})`} fill="var(--primary)" />}
    </g>
  );
}

/**
 * The shadow note under the pointer in note input (issue #238, as MuseScore shows one): a faint note of
 * the length a press would enter, its head on the line or space pointed at, its stem up and flag.
 */
export function ShadowNote({ x, step, value, score }: { x: number; step: number; value: number; score: ScoreRows }) {
  const y = stepY(score, step);
  const left = x - HEAD_WIDTH / 2;
  const head = HEADS[Math.min(2, Math.log2(value))];
  const stemX = left + HEAD_WIDTH - 0.6;
  const stemTop = stepY(score, step + STEM_STEPS);
  const flag = FLAGS[value]?.[0];
  return (
    <g data-testid="shadow-note" data-value={value} pointerEvents="none" opacity={0.45} fill="var(--primary)" stroke="var(--primary)">
      {ledgerSteps(step).map(ls => (
        <line key={ls} x1={left - 3} x2={left + HEAD_WIDTH + 3} y1={stepY(score, ls)} y2={stepY(score, ls)} strokeWidth={1} />
      ))}
      <path d={GLYPHS[head].d} transform={`translate(${left} ${y}) scale(${SPACE})`} stroke="none" />
      {value >= 2 && <line x1={stemX} x2={stemX} y1={y} y2={stemTop} strokeWidth={1.2} />}
      {flag && <path d={GLYPHS[flag].d} transform={`translate(${stemX - 0.6} ${stemTop}) scale(${SPACE})`} stroke="none" />}
    </g>
  );
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

/**
 * The time signature on the staff: its numbers fill the upper and lower halves. In brackets where a
 * run of free-time bars starts, as Guitar Pro prints it (Sweet Child O' Mine, bar 176).
 */
function StaffTime({ time, x, score, look, brackets = false }: { time: TimeSignature; x: number; score: ScoreRows; look: TabLook; brackets?: boolean }) {
  const middle = (score.top + score.bottom) / 2;
  return (
    <g fontSize={19} fontWeight={800} fill={look.ink} textAnchor="middle" data-testid="staff-time-signature">
      <text x={x} y={stepY(score, 4) - 2}>{time.beats}</text>
      <text x={x} y={stepY(score, 0) - 2}>{time.value}</text>
      {brackets && <TimeBrackets x={x} middle={middle} height={score.bottom - score.top} look={look} />}
    </g>
  );
}

/** A free-time bar's brackets round its time signature, as tall as the staff they stand on. */
export function TimeBrackets({ x, middle, height, look }: { x: number; middle: number; height: number; look: TabLook }) {
  // Bravura's brackets are about four staff spaces tall.
  const scale = height / 3.92;
  const half = 12;
  return (
    <g data-testid="time-brackets">
      <path d={GLYPHS.timeSigParensLeft.d} transform={`translate(${x - half - GLYPHS.timeSigParensLeft.width * scale * 0.85} ${middle}) scale(${scale})`} fill={look.ink} />
      <path d={GLYPHS.timeSigParensRight.d} transform={`translate(${x + half} ${middle}) scale(${scale})`} fill={look.ink} />
    </g>
  );
}

/** How far a multi-bar rest's thick bar stays clear of its bar lines. */
const MULTI_REST_INSET = 12;

/**
 * A multi-bar rest as printed parts draw it: a thick bar across the middle, a short upright at each
 * end, and the count over it, large and bold. Shared with the tab (`TabClip.tsx`).
 */
export function MultiRest({ span, count, y, countY, look, reach = 6 }: {
  span: { x0: number; x1: number }; count: number; y: number; countY: number; look: TabLook; reach?: number;
}) {
  const x0 = span.x0 + MULTI_REST_INSET;
  const x1 = span.x1 - MULTI_REST_INSET;
  return (
    <g data-testid="multi-rest">
      <rect x={x0} y={y - 2.6} width={Math.max(0, x1 - x0)} height={5.2} fill={look.ink} />
      <line x1={x0} x2={x0} y1={y - reach} y2={y + reach} stroke={look.ink} strokeWidth={1.2} />
      <line x1={x1} x2={x1} y1={y - reach} y2={y + reach} stroke={look.ink} strokeWidth={1.2} />
      <text x={(span.x0 + span.x1) / 2} y={countY} fontSize={20} fontWeight={800} fill={look.ink} textAnchor="middle">{count}</text>
    </g>
  );
}

function StaffBarLines({ bar, score, look, final }: { bar: PlacedBar; score: ScoreRows; look: TabLook; final: boolean }) {
  const { x0, x1 } = bar;
  const vertical = (x: number, w: number, dashed = false) => (
    <line x1={x} x2={x} y1={score.top} y2={score.bottom} stroke={look.ink} strokeWidth={w} strokeDasharray={dashed ? BAR_DASHES : undefined} />
  );
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
      ) : bar.bar.doubleBar ? (
        <g data-testid="double-bar">{vertical(x1 - 4, 1)}{vertical(x1, 1)}</g>
      ) : bar.restRun && !bar.restRun.last ? null : vertical(x1, 1, bar.bar.freeTime)}
    </g>
  );
}

const FERMATA_GLYPHS: Record<Fermata, GlyphName> = { short: 'fermataShortAbove', medium: 'fermataAbove', long: 'fermataLongAbove' };

/** A fermata centred over x, its foot (the dot) at y. Shared with the tab (`TabClip.tsx`). */
export function FermataSign({ fermata, x, y, look }: { fermata: Fermata; x: number; y: number; look: TabLook }) {
  const name = FERMATA_GLYPHS[fermata];
  return (
    <path
      d={GLYPHS[name].d} transform={`translate(${x - GLYPHS[name].width * SPACE / 2} ${y}) scale(${SPACE})`} fill={look.ink}
      data-testid="fermata"
    />
  );
}

/** A free-time bar's dashed closing line, as Guitar Pro draws it: dashes of 4 with gaps of 3. */
export const BAR_DASHES = '4 3';

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

const PAREN_LEFT = GLYPHS.noteheadParenthesisLeft.width * SPACE;
const PAREN_RIGHT = GLYPHS.noteheadParenthesisRight.width * SPACE;
/** The line from a bent note's bracketed starting head to the note: what is left of its room (`BEND_FROM_ROOM`). */
const BEND_FROM_LINE = BEND_FROM_ROOM - (PAREN_LEFT + 1 + HEAD_WIDTH + 1 + PAREN_RIGHT);
/** The line from a bent note let down in the same note to the head it comes back to. */
const BEND_BACK_LINE = 6;

/** An accidental whose right edge is at `right`. */
function Sign({ shows, right, y, look, scale = 1 }: { shows: Accidental; right: number; y: number; look: TabLook; scale?: number }) {
  const sign: GlyphName = shows > 0 ? 'accidentalSharp' : shows < 0 ? 'accidentalFlat' : 'accidentalNatural';
  return <Glyph name={sign} x={right - GLYPHS[sign].width * SPACE * scale} y={y} look={look} scale={scale} />;
}

/** A bracket glyph's height, in staff spaces. */
const PAREN_HEIGHT = 1.45;
/** How far apart, in steps, a ghost chord's outer heads may be for one pair of brackets round them all: a fifth. */
const GHOST_CHORD_SPREAD = 4;

/** Whether a column is a chord of ghost notes close enough together to share one pair of brackets. */
export function ghostChord(column: Column, heads: Head[]): boolean {
  return heads.length > 1 && heads.every(h => column.notes[h.string]?.ghost) && heads[heads.length - 1].step - heads[0].step <= GHOST_CHORD_SPREAD;
}

/** One bar's notes on the staff. */
/** A note by its column's place in the clip and its string. */
export interface NoteAt {
  index: number;
  string: number;
}

function StaffBar({ bar, score, look: barLook, alone, selected, selectedNote }: {
  bar: PlacedBar; score: ScoreRows; look: TabLook; alone: boolean; selected: [number, number] | null; selectedNote: NoteAt | null;
}) {
  const look = barLook;
  if (bar.restRun) {
    const { first, span, count } = bar.restRun;
    return first ? <MultiRest span={span} count={count} y={stepY(score, 4)} countY={score.top - 8} look={look} reach={SPACE} /> : null;
  }
  const parts: ReactNode[] = [];
  const { columns: geometry, groups, groupUp, beamY } = staffBar(bar, score);

  for (const placed of bar.columns) {
    const { column, x, heads } = placed;
    // A selected column's heads, signs, ledger lines and rest are drawn in the primary colour, as MuseScore colours selected notes.
    const lit = selected !== null && placed.index >= selected[0] && placed.index <= selected[1];
    const look = lit ? { ...barLook, ink: 'var(--primary)' } : barLook;
    const columnLook = look;
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
    const chord = ghostChord(column, heads);
    heads.forEach((h, k) => {
      const note = column.notes[h.string];
      const picked = selectedNote !== null && selectedNote.index === placed.index && selectedNote.string === h.string;
      const look = picked ? { ...barLook, ink: 'var(--primary)' } : columnLook;
      // A dead note is an ×; a natural harmonic a diamond, as printed guitar music has them.
      const head = h.dead ? X_HEADS[shape] : note?.harmonic === 'natural' ? DIAMOND_HEADS[shape] : HEADS[shape];
      const y = stepY(score, h.step);
      // Ledger lines from the staff out to a head: every line step below the bottom line or above the top one.
      const ledgers = (step: number, left: number, right: number, id: string) => {
        for (let ls = -2; ls >= step; ls -= 2) parts.push(<line key={`ledger-${id}-${ls}`} x1={left} x2={right} y1={stepY(score, ls)} y2={stepY(score, ls)} stroke={look.ink} strokeWidth={1} />);
        for (let ls = 10; ls <= step; ls += 2) parts.push(<line key={`ledger-${id}-${ls}`} x1={left} x2={right} y1={stepY(score, ls)} y2={stepY(score, ls)} stroke={look.ink} strokeWidth={1} />);
      };
      ledgers(h.step, xs[k] - 3, xs[k] + width + 3, `${key}-${k}`);
      // A picked note bent up: the pitch it starts from in brackets before it, a line up to it, and,
      // let down in the same note, the pitch it comes back to in brackets after it (issue #176).
      const headWidth = GLYPHS[head].width * SPACE;
      const sideHead = (side: SmallHead, left: number, id: 'from' | 'back') => {
        const sy = stepY(score, side.step);
        ledgers(side.step, left - 3, left + headWidth + 3, `${id}-${key}-${k}`);
        parts.push(
          <g key={`${id}-${key}-${k}`} data-testid={`staff-bend-${id}`}>
            <Glyph name="noteheadParenthesisLeft" x={left - PAREN_LEFT - 1} y={sy} look={look} />
            <Glyph name={head} x={left} y={sy} look={look} />
            <Glyph name="noteheadParenthesisRight" x={left + headWidth + 1} y={sy} look={look} />
            {side.shows !== null && <Sign shows={side.shows} right={left - PAREN_LEFT - 2} y={sy} look={look} />}
          </g>,
        );
        return sy;
      };
      if (h.bendFrom) {
        const end = Math.min(...xs) - accidentalRoom(heads) - 1;
        const right = end + 1 - BEND_FROM_LINE;
        const sy = sideHead(h.bendFrom, right - PAREN_RIGHT - 1 - headWidth, 'from');
        parts.push(<line key={`from-line-${key}-${k}`} x1={right + 1} y1={sy - 2} x2={end} y2={y} stroke={look.ink} strokeWidth={1} data-testid="staff-bend-line" />);
      }
      if (h.bendBack && !alone) {
        const start = Math.max(...xs) + width + 2 + dots * 5;
        const left = start + BEND_BACK_LINE + PAREN_LEFT + 1;
        const sy = sideHead(h.bendBack, left, 'back');
        parts.push(<line key={`back-line-${key}-${k}`} x1={start} y1={y} x2={left - PAREN_LEFT - 2} y2={sy - 2} stroke={look.ink} strokeWidth={1} data-testid="staff-bend-line" />);
      }
      const drawnHead = (
        <g data-testid="staff-head" data-selected={lit || picked || undefined}>
          <Glyph name={head} x={xs[k]} y={y} look={look} scale={grace} />
        </g>
      );
      parts.push(picked ? <g key={`head-${key}-${k}`} data-testid="staff-selected">{drawnHead}</g> : <g key={`head-${key}-${k}`}>{drawnHead}</g>);
      // A ghost note's head in brackets, and a tied note's in a bend, at the pitch the bend has reached.
      if ((note?.ghost && !chord) || h.bent) {
        const open = GLYPHS.noteheadParenthesisLeft.width * SPACE * grace;
        parts.push(
          <g key={`ghost-${key}-${k}`} data-testid={note?.ghost ? 'staff-ghost' : 'staff-bent'}>
            <Glyph name="noteheadParenthesisLeft" x={xs[k] - open - 1} y={y} look={look} scale={grace} />
            <Glyph name="noteheadParenthesisRight" x={xs[k] + GLYPHS[head].width * SPACE * grace + 1} y={y} look={look} scale={grace} />
          </g>,
        );
      }
      if (h.shows !== null) {
        const laneX = Math.min(...xs) - 2 - lanes[k]! * ACCIDENTAL_ROOM * grace;
        parts.push(<Sign key={`acc-${key}-${k}`} shows={h.shows} right={laneX} y={y} look={look} scale={grace} />);
      }
      // Dots go in the space right of the head: a head on a line puts its dot in the space above.
      const dotY = stepY(score, h.step % 2 === 0 ? h.step + 1 : h.step);
      for (let d = 0; d < dots; d++) parts.push(<circle key={`dot-${key}-${k}-${d}`} cx={Math.max(...xs) + width + 4 + d * 5} cy={dotY} r={1.6} fill={look.ink} />);
    });
    // A chord of ghost notes close together: one tall pair of brackets round them all (issue #178).
    if (chord) {
      const top = stepY(score, heads[heads.length - 1].step);
      const bottom = stepY(score, heads[0].step);
      const open = GLYPHS.noteheadParenthesisLeft.width * SPACE * grace;
      // Clear of a stem up the heads' right side.
      const right = Math.max(...xs) + GLYPHS[HEADS[shape]].width * SPACE * grace + (up ? 3 : 1);
      // The glyphs are a head's height (1.45 spaces); stretched upright, they reach past the outer heads as far.
      const stretch = 1 + (bottom - top) / (PAREN_HEIGHT * SPACE * grace);
      const tall = (name: GlyphName, x: number) => (
        <path d={GLYPHS[name].d} transform={`translate(${x} ${(top + bottom) / 2}) scale(${SPACE * grace} ${SPACE * grace * stretch})`} fill={look.ink} />
      );
      parts.push(
        <g key={`ghost-chord-${key}`} data-testid="staff-ghost-chord">
          {tall('noteheadParenthesisLeft', Math.min(...xs) - open - 1)}
          {tall('noteheadParenthesisRight', right)}
        </g>,
      );
    }

    if (tip === null) continue;
    // The stem: from the farthest head to its length past the nearest, or to the group's beam.
    const low = stepY(score, heads[0].step);
    const high = stepY(score, heads[heads.length - 1].step);
    parts.push(<line key={`stem-${key}`} x1={stemX} x2={stemX} y1={up ? low : high} y2={tip} stroke={look.ink} strokeWidth={1.1} />);
    if (value >= 8 && !group) {
      parts.push(<Glyph key={`flag-${key}`} name={FLAGS[value][up ? 0 : 1]} x={stemX - 0.5} y={tip} look={look} scale={grace} />);
      // A grace note before the beat is slashed through its stem and flag, as guitar music prints it.
      if (column.grace) {
        const [y0, y1] = up ? [tip + 13, tip + 5] : [tip - 5, tip - 13];
        parts.push(<line key={`slash-${key}`} data-testid="grace-slash" x1={stemX - 4} y1={y0} x2={stemX + 6} y2={y1} stroke={look.ink} strokeWidth={1} />);
      }
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
    case 'mordent': {
      const { d, transform } = mordentSign(mark.x, mark.y, mark.lower ? 'lower' : 'upper');
      return <path d={d} transform={transform} fill={look.ink} data-testid="staff-mordent" />;
    }
    case 'vibrato': {
      const { d, strokeWidth } = vibratoWave(mark.x, mark.y, mark.wide, mark.end);
      return <path d={d} fill="none" stroke={look.ink} strokeWidth={strokeWidth} data-testid="staff-vibrato" />;
    }
    case 'ottava': {
      // "8va" as printed: the number in bold italics, its letters raised and small; then a dashed line, and a hook at its end.
      const { label, x, y, end, hook, below } = mark;
      const number = label.startsWith('15') ? '15' : '8';
      const letters = label.slice(number.length);
      const lineStart = x + (number.length === 2 ? 30 : 24);
      return (
        <g data-testid="staff-ottava">
          <text x={x} y={y + 4} fontSize={14} fontStyle="italic" fontWeight={700} fill={look.ink}>
            {number}<tspan fontSize={9} dy={-5}>{letters}</tspan>
          </text>
          {end > lineStart && <line x1={lineStart} x2={end} y1={y} y2={y} stroke={look.ink} strokeWidth={1} strokeDasharray="4 3" />}
          {hook && end > lineStart && <line x1={end} x2={end} y1={y} y2={below ? y - 6 : y + 6} stroke={look.ink} strokeWidth={1} />}
        </g>
      );
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
      const { x, y, top, bend, line } = mark;
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
          {line >= 0 && (
            <text x={peakX} y={top - 4 - line * BEND_LABEL_STEP} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" textAnchor="middle">
              {bendLabel(bend)}
            </text>
          )}
        </g>
      );
    }
    case 'whammy':
      return (
        <g data-testid="staff-whammy">
          {mark.points.length > 0 && <polyline points={mark.points.map(p => p.join(',')).join(' ')} fill="none" stroke={look.ink} strokeWidth={1.1} />}
          {mark.labels.map((l, k) => (
            <text key={k} x={l.x} y={l.y} fontSize={10} fontWeight={600} fill={look.ink} textAnchor="middle">{l.text}</text>
          ))}
        </g>
      );
    case 'tap':
      return <TapSign x={mark.x} y={mark.y} look={look} testId="staff-tap" />;
    case 'fermata':
      return <FermataSign fermata={mark.fermata} x={mark.x} y={mark.y} look={look} />;
    case 'tuplet': {
      const { bracket } = mark;
      // The bracket runs through the number's middle, with a gap for it, and hooks 4px toward the notes.
      const lineY = mark.y - 3.5;
      const gap = mark.label.length * 3.5 + 4;
      const hook = bracket.up ? -4 : 4;
      return (
        <g>
          <path
            d={`M${bracket.x0} ${lineY + hook} V${lineY} H${Math.max(bracket.x0, mark.x - gap)} M${Math.min(bracket.x1, mark.x + gap)} ${lineY} H${bracket.x1} V${lineY + hook}`}
            fill="none" stroke={look.ink} strokeWidth={1} data-testid="staff-tuplet-bracket"
          />
          <text x={mark.x} y={mark.y} fontSize={10} fontStyle="italic" fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="staff-tuplet">
            {mark.label}
          </text>
        </g>
      );
    }
  }
}
