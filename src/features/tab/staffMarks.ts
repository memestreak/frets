/**
 * The technique marks drawn on the notation staff (issue #122;
 * `docs/specs/2026-10-27-tab-notation-design.md`), placed as printed guitar music places them:
 * accents and staccato dots at the heads, on the side away from the stem; a vibrato's wave over the
 * staff; tremolo slashes across the stem; slurs for hammer-ons, pull-offs and ties; lines for slides.
 * With the staff alone, bends and taps go on it too (under a staff the tab shows them). Each mark has
 * the box a press picks it by. Pure: `StaffDrawing.tsx` draws them, `marks.ts` adds their boxes.
 */
import { columnAccent, columnMordent, TREMOLO_VALUES, tupletGroups, tupletLabel, type Bend, type Column, type Note, type Ottava } from './clip';
import { BEND_LABEL_STEP, HEAD_WIDTH, OTTAVA_CLEAR, SPACE, STEM_STEPS, stemUpFor, stepY, TAP_RADIUS, VIBRATO_CLEAR, VIBRATO_OVER_MARKS, type Layout, type StaffReach } from './layout';
import { columnRuns, vibratoRuns } from './runs';
import { mordentSign, vibratoWave, type Box, type MarkHit } from './marks';
import { previousHeads, staffBar, type StaffColumn } from './staffGeometry';

type Hit = Omit<MarkHit, 'kind' | 'on'>;

interface Placed {
  hit: MarkHit;
  box: Box;
}

/** What a mark is and where it is drawn. */
export type StaffShape =
  | { kind: 'accent'; heavy: boolean; x: number; y: number; above: boolean }
  | { kind: 'staccato'; x: number; y: number }
  | { kind: 'vibrato'; x: number; y: number; wide: boolean; end: number }
  | { kind: 'mordent'; x: number; y: number; lower: boolean }
  /** An octave line: its label at `x`, a dashed line to `end`, and a hook there when the line ends on this line of music. */
  | { kind: 'ottava'; label: Ottava; x: number; y: number; end: number; hook: boolean; below: boolean }
  | { kind: 'tremolo'; x: number; y: number; slashes: number }
  /** A slur or a tie: an arc from (x0, y0) to (x1, y1), bowing `bow` pixels down (negative: up). */
  | { kind: 'arc'; x0: number; y0: number; x1: number; y1: number; bow: number; tie: boolean }
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'bend'; x: number; y: number; top: number; bend: Bend; line: number }
  | { kind: 'tap'; x: number; y: number }
  /** A tuplet's number at (x, y) in its bracket from `x0` to `x1`, the ends hooking toward the notes (up when it is under them). */
  | { kind: 'tuplet'; x: number; y: number; label: string; bracket: { x0: number; x1: number; up: boolean } };

export type StaffMark = Placed & StaffShape;

/** How far a thin mark's box reaches past it, so the mouse finds it. */
const REACH = 6;
const BEND_LABEL: Record<number, string> = { 1: '¼', 2: '½', 4: 'full', 6: '1½', 8: '2' };

/** A box round two points, reaching `pad` past them. */
/** Each box's padding past what it draws, so marks can be spaced by their ink, not their hit areas. */
const PADS = new WeakMap<Box, number>();

function around(x0: number, y0: number, x1: number, y1: number, pad = REACH): Box {
  const box = { x: Math.min(x0, x1) - pad, y: Math.min(y0, y1) - pad, width: Math.abs(x1 - x0) + 2 * pad, height: Math.abs(y1 - y0) + 2 * pad };
  PADS.set(box, pad);
  return box;
}

/** How far a mark's ink reaches, top and bottom. */
function ink(mark: StaffMark): { top: number; bottom: number } {
  const pad = PADS.get(mark.box) ?? 0;
  return { top: mark.box.y + pad, bottom: mark.box.y + mark.box.height - pad };
}

/** Every mark on the staff, line by line, in the line's own units (y from its top). */
export function staffMarks(layout: Layout): StaffMark[][] {
  if (layout.parts === 'tab') return layout.systems.map(() => []);
  const staffAlone = layout.parts === 'staff';
  const previous = previousHeads(layout.systems);
  return layout.systems.map((system, si) => {
    const score = system.rows.score!;
    const out: StaffMark[] = [];
    const add = (hit: Hit, box: Box, mark: StaffShape) => {
      out.push({ ...mark, hit: { kind: 'mark', ...hit, on: 'staff' }, box });
    };
    // Each string's slur still open: the run it covers so far, and where its last head is.
    const slurs: ({ mark: StaffMark & { kind: 'arc' }; lastX: number } | null)[] = Array(6).fill(null);
    const highest = new Map<number, number>();
    const lowest = new Map<number, number>();
    for (const bar of system.bars) {
      const geometry = staffBar(bar, score);
      for (const placed of bar.columns) {
        const c = geometry.columns.get(placed);
        if (!c) continue;
        const { column, index, heads } = placed;
        const notes = column.notes.filter((n): n is Note => n !== null);
        const x = placed.x;
        const topY = stepY(score, heads[heads.length - 1].step);
        const bottomY = stepY(score, heads[0].step);

        // Accents and staccato: at the heads, away from the stem (over a whole note, which has none).
        const accent = columnAccent(column);
        const staccato = notes.some(n => n.staccato);
        const above = c.tip === null || !c.up;
        // The top of the accent or dot when they go over the heads, for a tap's sign over them.
        let marksTop = Infinity;
        if (accent || staccato) {
          // In steps from the outer head: inside the staff a dot sits in a space, never on a line.
          const sign = above ? 1 : -1;
          const outer = above ? heads[heads.length - 1].step : heads[0].step;
          const inStaff = (step: number) => step >= 0 && step <= 8;
          let dotStep = outer + sign * 2;
          if (inStaff(dotStep) && dotStep % 2 === 0) dotStep += sign;
          const dotY = stepY(score, dotStep);
          if (staccato) add({ mark: 'staccato', index, string: null }, around(x, dotY, x, dotY, 6), { kind: 'staccato', x, y: dotY });
          if (above) marksTop = dotY - 3;
          if (accent) {
            const ay = staccato ? dotY - sign * 9 : stepY(score, outer + sign * 3);
            if (above) marksTop = ay - 4;
            add({ mark: 'accent', index, string: null }, around(x - 5, ay - 4, x + 5, ay + 4, 3), { kind: 'accent', heavy: accent === 'heavy', x, y: ay, above });
          }
        }

        // How high the column reaches, for a vibrato's wave over it: its heads, or an upward stem.
        highest.set(index, c.up && c.tip !== null ? c.tip : topY - SPACE / 2);
        lowest.set(index, !c.up && c.tip !== null ? c.tip : bottomY + SPACE / 2);

        // Tremolo slashes across the stem, between the heads and the stem's end; over a whole note, which has no stem.
        if (column.tremolo && !column.grace) {
          const slashes = TREMOLO_VALUES.indexOf(column.tremolo) + 1;
          const sx = c.tip === null ? x : c.stemX;
          const y = c.tip === null ? topY - 2 * SPACE : c.up ? topY - 2.2 * SPACE : bottomY + 2.2 * SPACE;
          add({ mark: 'tremolo', index, string: null }, around(sx - 5, y - slashes * 2.5, sx + 5, y + slashes * 2.5, 3), { kind: 'tremolo', x: sx, y, slashes });
        }

        const labelLines = bendLabelLines(column, carriedBend);
        heads.forEach((h, k) => {
          const note = column.notes[h.string];
          if (!note) return;
          const s = h.string;
          const y = stepY(score, h.step);
          const headLeft = c.xs[k];
          const headRight = headLeft + c.width;
          const before = previous.get(`${index}:${s}`);
          const joined = before && before.system === si;
          // From the head before on this string, or the start of the line when it was on the line before.
          const fromX = joined ? before.x + c.width : system.staffStart;
          const fromY = joined ? stepY(score, before.step) : y;

          if (note.tie && joined && before.step !== h.step) {
            // A tie into a bend, or out of one, joins heads at two pitches: a straight line between them.
            const line = { x0: fromX + 3, y0: fromY, x1: headLeft - 6, y1: y };
            add({ mark: 'tie', index, string: s }, around(line.x0, line.y0, line.x1, line.y1), { kind: 'line', ...line });
          } else if (note.tie && joined) {
            // Alone, away from the stem; in a chord, the upper half's ties curve up and the lower half's down.
            const bend = heads.length > 1 ? (k >= heads.length / 2 ? -1 : 1) : c.up ? 1 : -1;
            const ty = y + bend * 5;
            add({ mark: 'tie', index, string: s }, around(fromX + 1, ty, headLeft - 2, ty + bend * 4), { kind: 'arc', x0: fromX + 1, y0: ty, x1: headLeft - 2, y1: ty, bow: bend * 7, tie: true });
          }
          // Hammer-ons, pull-offs and legato slides: one slur over the run, from its first head to its last,
          // on the side away from the first one's stem (as Guitar Pro prints it).
          const joinedOn = !!(note.legato || (note.slide === 'legato' && before));
          const run = slurs[s];
          const here = placed.x - HEAD_WIDTH / 2;
          if (!joinedOn) {
            slurs[s] = null;
          } else if (run && joined && before.x === run.lastX) {
            const arc = run.mark;
            const side = Math.sign(arc.bow);
            arc.x1 = headLeft + c.width / 2;
            arc.y1 = y + side * 6;
            arc.bow = side * Math.min(18, 9 + (arc.x1 - arc.x0) / 25);
            arc.box = around(arc.x0, Math.min(arc.y0, arc.y1) + Math.min(0, arc.bow), arc.x1, Math.max(arc.y0, arc.y1) + Math.max(0, arc.bow), 2);
            run.lastX = here;
          } else {
            const side = c.up ? 1 : -1;
            const y0 = fromY + side * 6;
            const y1 = y + side * 6;
            const bow = side * 9;
            add({ mark: note.legato ? 'legato' : 'slide', index, string: s }, around(fromX - c.width / 2, Math.min(y0, y1) + Math.min(0, bow), headLeft + c.width / 2, Math.max(y0, y1) + Math.max(0, bow), 2), {
              kind: 'arc', x0: fromX - c.width / 2, y0, x1: headLeft + c.width / 2, y1, bow, tie: false,
            });
            slurs[s] = { mark: out[out.length - 1] as StaffMark & { kind: 'arc' }, lastX: here };
          }
          if (note.slide) {
            // A slide from the head before is a line between the heads; from below or above, a short line into the head.
            const fromNote = (note.slide === 'legato' || note.slide === 'shift') && before;
            const line = fromNote
              ? { x0: fromX + 3, y0: fromY, x1: headLeft - 3, y1: y }
              : { x0: headLeft - 15, y0: y + (note.slide === 'below' ? 7 : -7), x1: headLeft - 3, y1: y };
            add({ mark: 'slide', index, string: s }, around(line.x0, line.y0, line.x1, line.y1), { kind: 'line', ...line });
          }
          if (note.slideOut) {
            const line = { x0: headRight + 3, y0: y, x1: headRight + 15, y1: y + (note.slideOut === 'down' ? 7 : -7) };
            add({ mark: 'slideOut', index, string: s }, around(line.x0, line.y0, line.x1, line.y1), { kind: 'line', ...line });
          }
          // Under a staff the tab draws bends; with the staff alone, they go on it.
          if (staffAlone && note.bend && !carriedBend(note)) {
            const top = Math.min(score.top, topY) - 14;
            const line = labelLines.get(note) ?? 0;
            add(
              { mark: 'bend', index, string: s }, around(x - 4, top - 10 - Math.max(line, 0) * BEND_LABEL_STEP, x + (note.bend.release ? 26 : 18), y),
              { kind: 'bend', x: headRight, y, top, bend: note.bend.from === undefined ? note.bend : { ...note.bend, pre: false }, line },
            );
          }
          // A tap's circled T over the staff in every view, as a book prints it, clear of the heads, an upward stem and
          // the marks over them.
          if (note.tap) {
            const highestPoint = Math.min(score.top, topY - SPACE / 2, marksTop, c.up && c.tip !== null ? c.tip : Infinity);
            const ty = highestPoint - TAP_RADIUS - 6;
            add({ mark: 'tap', index, string: s }, around(x, ty, x, ty, TAP_RADIUS + 1), { kind: 'tap', x, y: ty });
          }
        });
      }

      // Each tuplet's number over (or under) its group, past the beam or the heads.
      const cols = bar.columns.filter(p => !p.column.grace);
      for (const { from, to, duration } of tupletGroups(cols.map(p => p.column))) {
        const members = cols.slice(from, to + 1);
        const placedMembers = members.map(p => geometry.columns.get(p)).filter((g): g is StaffColumn => g !== undefined);
        const up = placedMembers[0]?.up ?? stemUpFor(members.flatMap(p => p.heads).sort((a, b) => a.step - b.step));
        const reach = members.map(p => {
          const g = geometry.columns.get(p);
          if (!g) return stepY(score, up ? 8 : 0);
          if (g.tip !== null) return g.tip;
          return up ? stepY(score, p.heads[p.heads.length - 1].step + STEM_STEPS) : stepY(score, p.heads[0].step - STEM_STEPS);
        });
        const y = up ? Math.min(stepY(score, 9), ...reach) - 5 : Math.max(stepY(score, -1), ...reach) + 13;
        const mid = (members[0].x + members[members.length - 1].x) / 2;
        // A bracket under every group, beamed or not, as Guitar Pro prints them (issue #179).
        const bracket = { x0: members[0].x - HEAD_WIDTH / 2 - 1, x1: members[members.length - 1].x + HEAD_WIDTH / 2 + 1, up: !up };
        add(
          { mark: 'tuplet', index: members[0].index, string: null, to: members[members.length - 1].index },
          around(members[0].x - 6, y - 10, members[members.length - 1].x + 6, y + 2, 2),
          { kind: 'tuplet', x: mid, y, label: tupletLabel(duration), bracket },
        );
      }
    }

    // A vibrato over neighbouring notes is one wave over the staff, clear of every one of them.
    const placed = system.bars.flatMap(b => b.columns);
    const span = (from: number, to: number) => placed.filter(p => p.index >= from && p.index <= to);
    // Every wave and mordent on a line at one height, clear of the notes and marks under each of them.
    const runs = vibratoRuns(system);
    const mordents = placed.filter(p => columnMordent(p.column));
    const clearOf = (from: number, to: number, x0: number, x1: number) => [
      ...span(from, to).map(p => (highest.get(p.index) ?? score.top) - VIBRATO_CLEAR),
      ...out.filter(m => m.box.x < x1 && m.box.x + m.box.width > x0).map(m => ink(m).top - VIBRATO_OVER_MARKS),
    ];
    const waveY = Math.min(
      score.top - VIBRATO_CLEAR,
      ...runs.flatMap(run => clearOf(run.from.index, run.to.index, run.from.x, run.end)),
      ...mordents.flatMap(p => clearOf(p.index, p.index, p.x - 8, p.x + 8)),
    );
    for (const p of mordents) {
      const kind = columnMordent(p.column)!;
      const { box } = mordentSign(p.x, waveY, kind);
      add({ mark: 'mordent', index: p.index, string: null }, around(box.x, box.y, box.x + box.width, box.y + box.height, 3), { kind: 'mordent', x: p.x, y: waveY, lower: kind === 'lower' });
    }
    for (const run of runs) {
      const wide = run.kind === 'wide';
      const { width } = vibratoWave(run.from.x, waveY, wide, run.end);
      add({ mark: 'vibrato', index: run.from.index, string: null, to: run.to.index }, around(run.from.x + 2, waveY, run.from.x + 6 + width, waveY), { kind: 'vibrato', x: run.from.x, y: waveY, wide, end: run.end });
    }

    // Octave lines: past everything else on the staff, one height across the line of music.
    const octaves = columnRuns(system, c => c.ottava ?? null);
    if (octaves.length > 0) {
      const above = Math.min(score.top, ...highest.values(), ...out.map(m => ink(m).top)) - OTTAVA_CLEAR;
      const under = Math.max(score.bottom, ...lowest.values(), ...out.map(m => ink(m).bottom)) + OTTAVA_CLEAR;
      const lastIndex = placed[placed.length - 1]?.index;
      for (const run of octaves) {
        const below = run.kind === '8vb' || run.kind === '15mb';
        const y = below ? under : above;
        // The line runs on past the column it ends on, to the next note or the end of the line.
        const end = run.to.index === lastIndex ? run.end : run.end + 6;
        const x = run.from.x - 6;
        add({ mark: 'ottava', index: run.from.index, string: null, to: run.to.index }, around(x, y - 8, end, y + 4, 2), {
          kind: 'ottava', label: run.kind, x, y, end, hook: true, below,
        });
      }
    }
    return out;
  });
}

/** The staff's marks that `staffReach` in `layout.ts` doesn't foresee: they stand over everything else. */
const FAR_MARKS: ReadonlySet<StaffMark['kind']> = new Set(['bend', 'tap', 'ottava']);

/**
 * How far each line's bends, taps and octave lines reach over and under the staff, in steps from its
 * bottom line, as drawn: `layoutClip` makes room for them, so the words over the staff stay clear of
 * them (an "8va" ran into the chord names over bends on the staff alone, Jeremy 2026-10-28).
 */
export function staffInk(layout: Layout): StaffReach[] {
  const half = SPACE / 2;
  return staffMarks(layout).map((all, si) => {
    const marks = all.filter(m => FAR_MARKS.has(m.kind));
    const score = layout.systems[si].rows.score!;
    const top = Math.min(score.top, ...marks.map(m => ink(m).top));
    const bottom = Math.max(score.bottom, ...marks.map(m => ink(m).bottom));
    return { high: Math.ceil((score.bottom - top) / half), low: Math.floor((score.bottom - bottom) / half) };
  });
}

/** A bend's label: "full", "½", "PB ½". */
export function bendLabel(bend: Bend): string {
  return bend.pre ? `PB ${BEND_LABEL[bend.quarters]}` : BEND_LABEL[bend.quarters];
}

/**
 * A tied note carrying a bend on, which the staff shows by its bracketed head alone; one that pushes
 * the bend on up (`Bend.from`) draws its arrow to the new height.
 */
function carriedBend(note: Note): boolean {
  return note.tie === true && note.bend?.pre === true && note.bend.from === undefined;
}

/**
 * Which line each bend's label goes on when a column bends more than one string: one label per height,
 * stacked with the top string's highest, as Guitar Pro prints "full" over "½" (bar 132 of the book).
 * 0 is the line next to the arrows; a bend whose height another string already labels gets none (-1).
 * `carried` picks the bends carried on from the note before, which draw no label.
 */
export function bendLabelLines(column: Column, carried: (note: Note) => boolean): Map<Note, number> {
  const bent = column.notes.filter((n): n is Note => n !== null && n.bend !== undefined && !carried(n));
  const labels = [...new Set(bent.map(n => bendLabel(n.bend!)))];
  const lines = new Map<Note, number>();
  const seen = new Set<string>();
  for (const note of bent) {
    const label = bendLabel(note.bend!);
    lines.set(note, seen.has(label) ? -1 : labels.length - 1 - labels.indexOf(label));
    seen.add(label);
  }
  return lines;
}
