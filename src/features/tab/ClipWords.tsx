// The words over a line, drawn by `TabClip`: endings, the capo, sections, tempos, chord names and free text.
import type { ReactNode } from 'react';
import { BEAT_TEXT_INSET, BEAT_TEXT_LINE, BEAT_TEXT_SIZE } from './beatText';
import { gridSize, OVER_NAME_SCALE } from './chordDiagrams';
import { ChordGrid } from './ChordGrid';
import { startsFreeTime, type Part } from './clip';
import { type System } from './layout';
import { textRowOf, type Rows } from './rows';
import { CHORD_SIZE, prettyChord } from './widths';
import { barTextX, CAPO_SIZE, capoText, endingSpans, sameWord, sectionBox, TEMPO_SIZE, tempoOver, tempoParts, type WordHit } from './layoutText';
import { SECTION_BOX_HEIGHT, SECTION_LINE, SECTION_SIZE, sectionBoxes } from './sectionText';
import { litLook, type TabLook } from './tabLook';
import { HYPHEN_ROOM, LYRIC_LINE, LYRIC_SIZE, lyricWidth, syllableOf } from './lyrics';
import { TempoNote } from './TempoNote';

/** The room between a tempo and "Free time" in the same bar. */
const FREE_TIME_GAP = 10;

/** The words over a line: endings, the capo, sections, tempos, chord names and free text. */
export function SystemWords({ system, rows, clip, look: plain, word, columnsOnly = false }: { system: System; rows: Rows; clip: Part; look: TabLook; word: WordHit | null; columnsOnly?: boolean }) {
  const parts: ReactNode[] = [];
  // Another Voice's drawing carries only the words on its own columns: chord names and texts (step 9, Q13).
  if (columnsOnly) return <>{columnWords(system, rows, word, plain)}</>;
  /** The look of a word: the selection's blue when it is the picked one (issue #276). */
  const lookOf = (hit: WordHit) => litLook(plain, sameWord(word, hit));
  // Endings: one bracket over each run of bars with the same ending.
  endingSpans(system).forEach(({ bar, n, x0, x1 }) => {
    const y = rows.endings!;
    const look = lookOf({ kind: 'ending', bar });
    parts.push(
      <g key={`ending-${bar}`} stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="ending">
        <polyline points={`${x0},${y + 8} ${x0},${y - 4} ${x1},${y - 4}`} />
        <text x={x0 + 4} y={y + 6} fontSize={11} fontWeight={700} fill={look.ink} stroke="none">{n}.</text>
      </g>,
    );
  });

  // The capo, over the start of the first line, as printed tab has it.
  if (system.first && clip.capo && rows.capo !== null) {
    const look = lookOf({ kind: 'capo', bar: 0 });
    parts.push(
      <text key="capo" x={system.lineStart} y={rows.capo + 4} fontSize={CAPO_SIZE} fontWeight={700} fill={look.ink} data-testid="capo">
        {capoText(clip.capo)}
      </text>,
    );
  }

  // Sections and tempos, over the bar they start at; chord names and free text over their columns.
  for (const bar of system.bars) {
    const x0 = barTextX(bar);
    const { section } = bar.bar;
    const tempo = tempoOver(bar);
    if (section && rows.section !== null) {
      // Its first line, moved up clear of a section it would run into (issue #389).
      const { y0: y } = sectionBox(bar, rows.section);
      const lines = bar.sectionLines.length > 0 ? bar.sectionLines : [section.text];
      const look = lookOf({ kind: 'section', bar: bar.index });
      const { marker, text } = sectionBoxes(section);
      parts.push(
        <g key={`section-${bar.index}`} data-testid="section" fill={look.ink}>
          {marker && (
            <>
              <rect x={x0 + 0.6} y={y - SECTION_BOX_HEIGHT / 2} width={marker.width - 1.2} height={SECTION_BOX_HEIGHT} fill="none" stroke={look.ink} strokeWidth={1.2} />
              <text x={x0 + marker.width / 2} y={y + 5} fontSize={SECTION_SIZE} fontWeight={700} textAnchor="middle">{section.marker}</text>
            </>
          )}
          <text x={x0 + text.x} y={y + 5} fontSize={SECTION_SIZE} fontWeight={700}>
            {lines.map((line, k) => (
              <tspan key={k} x={x0 + text.x} dy={k === 0 ? 0 : SECTION_LINE}>{k < lines.length - 1 ? `${line} ` : line}</tspan>
            ))}
          </text>
        </g>,
      );
    }
    if (tempo && rows.tempo !== null) {
      const y = rows.tempo;
      const look = lookOf({ kind: 'tempo', bar: bar.index });
      const { noteX, numberX } = tempoParts(tempo);
      const nx = x0 + noteX;
      parts.push(
        <g key={`tempo-${bar.index}`} data-testid="tempo" fill={look.ink} fontSize={TEMPO_SIZE} fontWeight={700}>
          {tempo.label && <text x={x0} y={y + 4}>{tempo.label}</text>}
          <TempoNote x={nx} y={y + 2} size={TEMPO_SIZE} ink={look.ink} />
          <text x={x0 + numberX} y={y + 4}>{` = ${tempo.bpm}`}</text>
        </g>,
      );
    }
    // "Free time" over the bar that starts it, after the bar's tempo when it has one.
    if (rows.tempo !== null && startsFreeTime(clip, bar.index)) {
      const after = tempo ? tempoParts(tempo).width + FREE_TIME_GAP : 0;
      parts.push(
        <text key={`free-${bar.index}`} x={x0 + after} y={rows.tempo + 4} fontSize={BEAT_TEXT_SIZE} fontStyle="italic" fill={plain.ink} data-testid="free-time">
          Free time
        </text>,
      );
    }
  }
  parts.push(...columnWords(system, rows, word, plain));
  return <>{parts}</>;
}

/** The words on a line's columns: chord names and free text. */
function columnWords(system: System, rows: Rows, word: WordHit | null, plain: TabLook): ReactNode[] {
  const parts: ReactNode[] = [];
  const lookOf = (hit: WordHit) => litLook(plain, sameWord(word, hit));
  // Under each chord name its diagram (issue #242), picked with it.
  if (rows.diagrams !== null) {
    for (const placed of system.bars.flatMap(bar => bar.columns)) {
      if (!placed.diagram) continue;
      const look = lookOf({ kind: 'chord', index: placed.index });
      parts.push(
        <ChordGrid
          key={`grid-${placed.index}`} chord={placed.diagram} look={look}
          x={placed.x - (gridSize(placed.diagram).width * OVER_NAME_SCALE) / 2} y={rows.diagrams} scale={OVER_NAME_SCALE}
        />,
      );
    }
  }
  for (const bar of system.bars) {
    if (rows.chords !== null) {
      for (const placed of bar.columns) {
        if (!placed.column.chord) continue;
        const look = lookOf({ kind: 'chord', index: placed.index });
        parts.push(
          <text
            key={`chord-${placed.index}`} x={placed.x} y={rows.chords + 4} fontSize={CHORD_SIZE} fontWeight={700} fill={look.ink}
            textAnchor="middle" data-testid="chord-name"
          >
            {prettyChord(placed.column.chord)}
          </text>,
        );
      }
    }
    {
      for (const placed of bar.columns) {
        const textRow = textRowOf(rows, placed);
        if (!placed.column.text || textRow === null) continue;
        const look = lookOf({ kind: 'text', index: placed.index });
        parts.push(
          <text
            key={`text-${placed.index}`} x={placed.x - BEAT_TEXT_INSET} y={textRow + placed.textTop * BEAT_TEXT_LINE + 4} fontSize={BEAT_TEXT_SIZE} fontStyle="italic"
            fill={look.ink} data-testid="beat-text"
          >
            {/* A wrapped line keeps its space at the end, so the text reads (and copies) as typed. */}
            {placed.textLines.map((line, k, lines) => (
              <tspan key={k} x={placed.x - BEAT_TEXT_INSET} dy={k === 0 ? 0 : BEAT_TEXT_LINE}>{k < lines.length - 1 ? `${line} ` : line}</tspan>
            ))}
          </text>,
        );
      }
    }
  }
  parts.push(...lyricWords(system, rows, lookOf));
  return parts;
}

/**
 * The Lyrics under a line's notes: each syllable centred on its note, one Lyric line under another, and a
 * hyphen halfway to the next syllable on its line where a syllable is joined to it (at the line's end, just
 * after it, as Dorico and printed songbooks have it).
 */
function lyricWords(system: System, rows: Rows, lookOf: (hit: WordHit) => TabLook): ReactNode[] {
  if (rows.lyrics === null) return [];
  const parts: ReactNode[] = [];
  const placed = system.bars.flatMap(bar => bar.columns);
  for (let line = 0; line < rows.lyricCount; line++) {
    const y = rows.lyrics + line * LYRIC_LINE + 4;
    const sung = placed.filter(p => p.column.lyrics?.[line]);
    sung.forEach((p, k) => {
      const { shown, joined } = syllableOf(p.column.lyrics![line]);
      const look = lookOf({ kind: 'lyric', index: p.index, line });
      parts.push(
        <text key={`lyric-${p.index}-${line}`} x={p.x} y={y} fontSize={LYRIC_SIZE} fill={look.ink} textAnchor="middle" data-testid="lyric">
          {shown}
        </text>,
      );
      if (!joined) return;
      const end = p.x + lyricWidth(shown) / 2;
      const next = sung[k + 1];
      const hx = next ? (end + next.x - lyricWidth(syllableOf(next.column.lyrics![line]).shown) / 2) / 2 : end + HYPHEN_ROOM / 2;
      parts.push(
        <text key={`hyphen-${p.index}-${line}`} x={hx} y={y} fontSize={LYRIC_SIZE} fill={look.ink} textAnchor="middle" data-testid="lyric-hyphen">
          -
        </text>,
      );
    });
  }
  return parts;
}
