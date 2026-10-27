/**
 * The technique marks drawn on the notation staff (issue #122;
 * `docs/specs/2026-10-27-tab-notation-design.md`), placed as printed guitar music places them:
 * accents and staccato dots at the heads, on the side away from the stem; a vibrato's wave over the
 * staff; tremolo slashes across the stem; slurs for hammer-ons, pull-offs and ties; lines for slides.
 * With the staff alone, bends and taps go on it too (under a staff the tab shows them). Each mark has
 * the box a press picks it by. Pure: `StaffDrawing.tsx` draws them, `marks.ts` adds their boxes.
 */
import { columnAccent, TREMOLO_VALUES, tupletGroups, tupletLabel, type Bend, type Note } from './clip';
import { SPACE, STEM_STEPS, stemUpFor, stepY, type Layout } from './layout';
import type { Box, MarkHit } from './marks';
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
  | { kind: 'vibrato'; x: number; y: number; wide: boolean }
  | { kind: 'tremolo'; x: number; y: number; slashes: number }
  /** A slur or a tie: an arc from (x0, y0) to (x1, y1), bowing `bow` pixels down (negative: up). */
  | { kind: 'arc'; x0: number; y0: number; x1: number; y1: number; bow: number; tie: boolean }
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'bend'; x: number; y: number; top: number; bend: Bend }
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'tuplet'; x: number; y: number; label: string };

export type StaffMark = Placed & StaffShape;

/** How far a thin mark's box reaches past it, so the mouse finds it. */
const REACH = 6;
const BEND_LABEL: Record<number, string> = { 1: '¼', 2: '½', 4: 'full', 6: '1½', 8: '2' };

/** A box round two points, reaching `pad` past them. */
function around(x0: number, y0: number, x1: number, y1: number, pad = REACH): Box {
  return { x: Math.min(x0, x1) - pad, y: Math.min(y0, y1) - pad, width: Math.abs(x1 - x0) + 2 * pad, height: Math.abs(y1 - y0) + 2 * pad };
}

/** Every mark on the staff, line by line, in the line's own units (y from its top). */
export function staffMarks(layout: Layout): StaffMark[][] {
  const { rows } = layout;
  const score = rows.score;
  if (!score) return layout.systems.map(() => []);
  const staffAlone = !rows.tab;
  const previous = previousHeads(layout.systems);
  return layout.systems.map((system, si) => {
    const out: StaffMark[] = [];
    const add = (hit: Hit, box: Box, mark: StaffShape) => {
      out.push({ ...mark, hit: { kind: 'mark', ...hit, on: 'staff' }, box });
    };
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
        if (accent || staccato) {
          // In steps from the outer head: inside the staff a dot sits in a space, never on a line.
          const sign = above ? 1 : -1;
          const outer = above ? heads[heads.length - 1].step : heads[0].step;
          const inStaff = (step: number) => step >= 0 && step <= 8;
          let dotStep = outer + sign * 2;
          if (inStaff(dotStep) && dotStep % 2 === 0) dotStep += sign;
          const dotY = stepY(score, dotStep);
          if (staccato) add({ mark: 'staccato', index, string: null }, around(x, dotY, x, dotY, 6), { kind: 'staccato', x, y: dotY });
          if (accent) {
            const ay = staccato ? dotY - sign * 9 : stepY(score, outer + sign * 3);
            add({ mark: 'accent', index, string: null }, around(x - 5, ay - 4, x + 5, ay + 4, 3), { kind: 'accent', heavy: accent === 'heavy', x, y: ay, above });
          }
        }

        // A vibrato's wave over the staff, clear of the column's heads and an upward stem.
        const vibrato = notes.some(n => n.vibrato === 'wide') ? 'wide' : notes.some(n => n.vibrato) ? 'slight' : null;
        if (vibrato) {
          const highest = c.up && c.tip !== null ? c.tip : topY - SPACE / 2;
          const y = Math.min(score.top - 10, highest - 10);
          const [width, turns] = vibrato === 'wide' ? [8, 3] : [6, 4];
          add({ mark: 'vibrato', index, string: null }, around(x + 2, y, x + 6 + 2 * width * turns, y), { kind: 'vibrato', x, y, wide: vibrato === 'wide' });
        }

        // Tremolo slashes across the stem, between the heads and the stem's end; over a whole note, which has no stem.
        if (column.tremolo && !column.grace) {
          const slashes = TREMOLO_VALUES.indexOf(column.tremolo) + 1;
          const sx = c.tip === null ? x : c.stemX;
          const y = c.tip === null ? topY - 2 * SPACE : c.up ? topY - 2.2 * SPACE : bottomY + 2.2 * SPACE;
          add({ mark: 'tremolo', index, string: null }, around(sx - 5, y - slashes * 2.5, sx + 5, y + slashes * 2.5, 3), { kind: 'tremolo', x: sx, y, slashes });
        }

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

          if (note.tie && joined) {
            // Alone, away from the stem; in a chord, the upper half's ties curve up and the lower half's down.
            const bend = heads.length > 1 ? (k >= heads.length / 2 ? -1 : 1) : c.up ? 1 : -1;
            const ty = y + bend * 5;
            add({ mark: 'tie', index, string: s }, around(fromX + 1, ty, headLeft - 2, ty + bend * 4), { kind: 'arc', x0: fromX + 1, y0: ty, x1: headLeft - 2, y1: ty, bow: bend * 7, tie: true });
          }
          // A hammer-on, pull-off or legato slide: a slur from the head before, on the side away from the stem.
          if (note.legato || (note.slide === 'legato' && before)) {
            const side = c.up ? 1 : -1;
            const y0 = fromY + side * 6;
            const y1 = y + side * 6;
            const bow = side * 9;
            add({ mark: note.legato ? 'legato' : 'slide', index, string: s }, around(fromX - c.width / 2, Math.min(y0, y1) + Math.min(0, bow), headLeft + c.width / 2, Math.max(y0, y1) + Math.max(0, bow), 2), {
              kind: 'arc', x0: fromX - c.width / 2, y0, x1: headLeft + c.width / 2, y1, bow, tie: false,
            });
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
          // Under a staff the tab draws bends and taps; with the staff alone, they go on it.
          if (staffAlone && note.bend) {
            const top = Math.min(score.top, topY) - 14;
            add({ mark: 'bend', index, string: s }, around(x - 4, top - 10, x + (note.bend.release ? 26 : 18), y), { kind: 'bend', x: headRight, y, top, bend: note.bend });
          }
          if (staffAlone && note.tap) {
            const ty = Math.min(score.top, topY) - 8;
            add({ mark: 'tap', index, string: s }, around(x, ty - 4, x, ty - 4, 6), { kind: 'tap', x, y: ty });
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
        add(
          { mark: 'tuplet', index: members[0].index, string: null, to: members[members.length - 1].index },
          around(members[0].x - 6, y - 10, members[members.length - 1].x + 6, y + 2, 2),
          { kind: 'tuplet', x: mid, y, label: tupletLabel(duration) },
        );
      }
    }
    return out;
  });
}

/** A bend's label: "full", "½", "PB ½". */
export function bendLabel(bend: Bend): string {
  return bend.pre ? `PB ${BEND_LABEL[bend.quarters]}` : BEND_LABEL[bend.quarters];
}
