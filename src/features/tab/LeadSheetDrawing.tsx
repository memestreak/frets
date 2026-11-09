'use client';

/**
 * The lead sheet drawn (issue #295, `docs/specs/2026-11-08-tab-lead-sheet-design.md`): a box per bar with
 * the chord names, slashes, signatures and repeats `layoutLeadSheet` placed. `LeadSheetDrawing` is the
 * drawing alone, for the page and the image; `LeadSheet` is the page's, taking presses and drawing the
 * caret; `LeadPlayhead` draws the playhead and the playback line over it.
 */
import { memo, type PointerEvent, type MouseEvent, type ReactNode } from 'react';
import type { Part } from './clip';
import { prettyChord } from './widths';
import { sameWord, type WordHit } from './layoutText';
import {
  ENDING_ROW, LEAD_TIME_SIZE, leadAt, leadCaret, leadPlayX, lyricBaseline, nameBaseline, SECTION_ROW, SLASH_HALF, SLASH_IN,
  textBaseline, TEXT_SIZE, type LeadBox, type LeadHit, type LeadLayout, type LeadRow,
} from './leadSheet';
import { useHeardPosition, type Playback } from './PlaybackFooter';
import { litLook, PAGE_LOOK, type TabLook } from './tabLook';

/** The repeat sign's dots' distance from the box's middle, and the lines' gap. */
const DOT_OFF = 7;
const THICK = 3;

/** One box's bar lines: its start's, and its end's when it ends something or its row. */
function BarLines({ box, prev, row, look, lastInRow }: { box: LeadBox; prev: LeadBox | null; row: LeadRow; look: TabLook; lastInRow: boolean }) {
  const { boxTop: y0, boxBottom: y1 } = row;
  const mid = (y0 + y1) / 2;
  const out: ReactNode[] = [];
  const thin = (x: number, key: string) => <line key={key} x1={x} x2={x} y1={y0} y2={y1} stroke={look.ink} strokeWidth={1} />;
  const thick = (x: number, key: string) => <rect key={key} x={x} y={y0} width={THICK} height={y1 - y0} fill={look.ink} />;
  const dots = (x: number, key: string) => (
    <g key={key} fill={look.ink}>
      <circle cx={x} cy={mid - DOT_OFF} r={1.8} />
      <circle cx={x} cy={mid + DOT_OFF} r={1.8} />
    </g>
  );
  const prevEnds = prev !== null && (prev.repeatEnd !== null || prev.doubleBar);
  if (box.repeatStart) out.push(thick(box.x0, 'rs-thick'), thin(box.x0 + 6, 'rs-thin'), dots(box.x0 + 10, 'rs-dots'));
  else if (!prevEnds) out.push(thin(box.x0, 'start'));
  if (box.repeatEnd !== null) out.push(dots(box.x1 - 10, 're-dots'), thin(box.x1 - 6, 're-thin'), thick(box.x1 - THICK, 're-thick'));
  else if (box.last) out.push(thin(box.x1 - 6, 'end-thin'), thick(box.x1 - THICK, 'end-thick'));
  else if (box.doubleBar) out.push(thin(box.x1 - 4, 'db-1'), thin(box.x1, 'db-2'));
  else if (lastInRow) out.push(thin(box.x1, 'end'));
  return <g data-testid="lead-bar-lines" data-repeat-start={box.repeatStart || undefined} data-repeat-end={box.repeatEnd ?? undefined} data-double={box.doubleBar || undefined} data-final={box.last || undefined}>{out}</g>;
}

/** The lead sheet as SVG, from the drawing's top-left; `picked` (on the page) draws a word blue, `caret` the caret. */
export const LeadSheetDrawing = memo(function LeadSheetDrawing({ layout, look = PAGE_LOOK, picked = null, caret = null }: {
  layout: LeadLayout; look?: TabLook; picked?: WordHit | null; caret?: { bar: number; column: number } | null;
}) {
  const lit = (hit: WordHit) => litLook(look, sameWord(picked, hit));
  const caretAt = caret ? leadCaret(layout, caret) : null;
  return (
    <g data-testid="lead-sheet">
      {layout.rows.map((row, r) => {
        const base = nameBaseline(row);
        return (
          <g key={r} data-testid="lead-row">
            {row.section && row.sectionY !== null && (
              <SectionLabel row={row} look={lit({ kind: 'section', bar: row.section.bar })} />
            )}
            {row.boxes.map((box, k) => (
              <g key={box.bar} data-testid="lead-box" data-bar={box.bar} data-silent={box.silent || undefined}>
                <BarLines box={box} prev={k > 0 ? row.boxes[k - 1] : null} row={row} look={look} lastInRow={k === row.boxes.length - 1} />
                {box.number !== null && (
                  <text x={box.x0 + (box.repeatStart ? 14 : 4)} y={row.boxTop + 11} fontSize={9} fill={look.line} data-testid="lead-bar-number">{box.number}</text>
                )}
                {box.time && (
                  <g fontSize={LEAD_TIME_SIZE} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="lead-time">
                    <text x={box.timeX} y={(row.boxTop + row.boxBottom) / 2 - 2}>{box.time.beats}</text>
                    <text x={box.timeX} y={(row.boxTop + row.boxBottom) / 2 + LEAD_TIME_SIZE - 1}>{box.time.value}</text>
                  </g>
                )}
                {box.ending !== null && row.endingY !== null && (
                  <g data-testid="lead-ending">
                    <path
                      d={row.boxes[k - 1]?.ending === box.ending
                        ? `M${box.x0} ${row.endingY} H${box.x1 - 6}`
                        : `M${box.x0 + 3} ${row.boxTop - 2} V${row.endingY} H${box.x1 - 6}`}
                      fill="none" stroke={look.ink} strokeWidth={1}
                    />
                    {row.boxes[k - 1]?.ending !== box.ending && <text x={box.x0 + 7} y={row.endingY + ENDING_ROW - 4} fontSize={10} fill={look.ink}>{`${box.ending}.`}</text>}
                  </g>
                )}
                {box.repeatEnd !== null && box.repeatEnd > 2 && row.endingY !== null && (
                  <text x={box.x1 - 2} y={row.endingY + ENDING_ROW - 4} fontSize={10} fill={look.ink} textAnchor="end" data-testid="lead-repeat-count">{`×${box.repeatEnd}`}</text>
                )}
                {box.texts.map(t => (
                  <text key={`text-${t.index}`} fontSize={TEXT_SIZE} fill={lit({ kind: 'text', index: t.index }).ink} data-testid="lead-text">
                    {t.lines.map((line, i) => <tspan key={i} x={t.x} y={textBaseline(row, t, i)}>{line}</tspan>)}
                  </text>
                ))}
                {box.chords.map(c => (
                  <text
                    key={`chord-${c.at}`} x={c.x} y={base} fontSize={box.nameSize} fontWeight={600}
                    fill={c.index === null ? look.ink : lit({ kind: 'chord', index: c.index }).ink}
                    data-testid="lead-chord" data-carried={c.carried || undefined}
                  >
                    {prettyChord(c.name)}
                  </text>
                ))}
                {box.slashes.map(x => (
                  <line
                    key={`slash-${x}`} x1={x + SLASH_IN - SLASH_HALF} x2={x + SLASH_IN + SLASH_HALF} y1={base - 1} y2={base - 17}
                    stroke={look.line} strokeWidth={2} strokeLinecap="round" data-testid="lead-slash"
                  />
                ))}
              </g>
            ))}
            {row.lyrics.map((l, i) => (
              <g key={`lyric-${i}`} fontSize={row.lyricSize} fill={look.ink} opacity={l.voice > 0 ? 0.6 : undefined}>
                <text x={l.x} y={lyricBaseline(row, l.line)} data-testid="lead-lyric">{l.text}</text>
                {l.hyphenX !== null && <text x={l.hyphenX} y={lyricBaseline(row, l.line)} textAnchor="middle" data-testid="lead-lyric-hyphen">-</text>}
              </g>
            ))}
          </g>
        );
      })}
      {caretAt && <line x1={caretAt.x} x2={caretAt.x} y1={caretAt.y0} y2={caretAt.y1} stroke="var(--select)" strokeWidth={2} data-testid="lead-caret" />}
    </g>
  );
});

/** A section over its row: its rehearsal mark boxed, then its text, bold. */
function SectionLabel({ row, look }: { row: LeadRow; look: TabLook }) {
  const { section } = row.section!;
  const x = row.boxes[0].x0;
  const y = row.sectionY! + SECTION_ROW - 7;
  const markWidth = section.marker ? section.marker.length * 9 + 6 : 0;
  return (
    <g data-testid="lead-section" fill={look.ink}>
      {section.marker && (
        <>
          <rect x={x} y={y - 12} width={markWidth} height={16} fill="none" stroke={look.ink} strokeWidth={1} />
          <text x={x + markWidth / 2} y={y} fontSize={12} fontWeight={700} textAnchor="middle">{section.marker}</text>
        </>
      )}
      <text x={x + (markWidth ? markWidth + 6 : 0)} y={y} fontSize={14} fontWeight={700}>{section.text}</text>
    </g>
  );
}

/**
 * The lead sheet on the page: a press picks a chord name, text or section, or puts the caret on a beat
 * (`onPick`); a double-click on a word edits it (`onEdit`); a press on no box lets go (`onMiss`).
 */
export function LeadSheet({ clip, layout, width, picked, caret, onPick, onEdit, onMiss }: {
  clip: Part; layout: LeadLayout; width: number; picked: WordHit | null; caret: { bar: number; column: number } | null;
  onPick: (hit: LeadHit) => void; onEdit: (hit: WordHit) => void; onMiss: () => void;
}) {
  const at = (e: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    return leadAt(clip, layout, (e.clientX - box.left) * scale, (e.clientY - box.top) * scale);
  };
  return (
    <svg
      width={width} height={layout.height} viewBox={`0 0 ${width} ${layout.height}`} role="img" aria-label={`${clip.name || 'Clip'}, drawn as a lead sheet`}
      className="tab-lead-sheet"
      onPointerDown={e => {
        const hit = at(e);
        if (hit) onPick(hit);
        else onMiss();
      }}
      onDoubleClick={e => {
        const hit = at(e);
        if (hit && hit.kind !== 'beat') onEdit(hit);
      }}
    >
      <LeadSheetDrawing layout={layout} picked={picked} caret={caret} />
    </svg>
  );
}

/** The playhead's line, moving through the boxes as the clip plays, and the playback line when stopped. */
export function LeadPlayhead({ clip, layout, width, playback, mark, markOnly }: {
  clip: Part; layout: LeadLayout; width: number; playback: Playback; mark: number | null; markOnly: boolean;
}) {
  const playing = playback.view.state === 'playing';
  const heard = useHeardPosition(playback, !markOnly && playing);
  const total = clip.bars.reduce((n, b) => n + b.columns.length, 0);
  const idle = playing || mark === null ? null
    : mark < total ? leadPlayX(clip, layout, mark, 0) : leadPlayX(clip, layout, total - 1, 1);
  const head = heard ? leadPlayX(clip, layout, heard.column, heard.through) : null;
  if (!idle && !head) return null;
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={layout.height} aria-hidden="true">
      {idle && <line x1={idle.x} x2={idle.x} y1={idle.y0} y2={idle.y1} stroke="var(--playhead)" strokeWidth={2} data-testid="play-mark" />}
      {head && <line x1={head.x} x2={head.x} y1={head.y0} y2={head.y1} stroke="var(--playhead)" strokeWidth={2} data-testid="playhead" />}
    </svg>
  );
}
