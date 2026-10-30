/**
 * The head of the drawn score, as a printed score's first page has it (Jeremy, 2026-10-28,
 * `docs/specs/2026-10-28-tab-score-head-design.md`): the title in the middle, the artist in bold and who wrote the words and music under it, then the tuning on the left. It
 * stands over the drawing and is zoomed with it; the exported image draws the same in SVG
 * (`exportTab.tsx`), from the same sizes (`HEAD`).
 *
 * A press on the title or the credits opens the one Title and credits panel there, with the pressed
 * one's field focused (issue #227); a press on the tuning opens its panel (issues #202, #203,
 * `docs/specs/2026-10-29-tab-credits-tuning-design.md`). The tuning is always shown, as "Standard tuning"
 * when it is; an unset artist has a quiet "Add artist and credits" under the title. Under the tuning,
 * the first bar's tempo ("♩ = 120" when none is set), whose press opens the tempo panel
 * (`docs/specs/2026-10-29-tab-tempo-button-design.md`).
 */
import type { MouseEvent, ReactNode } from 'react';
import { DEFAULT_BPM, UNTITLED, type Part, type Tempo } from './clip';
import type { HeadField } from './CreditsPanel';
import { creditsOf, HEAD, tuningBlock } from './credits';
import { TempoNote, tempoNoteWidth } from './TempoNote';

/** Opens a panel at the press, in viewport pixels (a key press opens it under the element). */
type OpenAt = (x: number, y: number) => void;

function openAt(open: OpenAt | undefined) {
  if (!open) return undefined;
  return (e: MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    // A click from the keyboard has no pointer position.
    if (e.detail === 0) open(box.left, box.bottom + 4);
    else open(e.clientX, e.clientY + 8);
  };
}

export function ScoreHead({ clip, note, onEditCredits, onEditTuning, onEditTempo }: {
  clip: Part;
  /** A line under the title, as the example note ("Example: edits aren't saved"). */
  note?: ReactNode;
  /** Opens the Title and credits panel with `field`'s field focused. */
  onEditCredits?: (x: number, y: number, field: HeadField) => void;
  onEditTuning?: OpenAt;
  onEditTempo?: OpenAt;
}) {
  const { artist, lines } = creditsOf(clip);
  const tuning = tuningBlock(clip.tuning);
  const rows = tuning ? Math.min(3, tuning.strings.length) : 0;
  // Always shown (Jeremy, 2026-10-29): standard tuning is named, so a press on it opens the tuning panel.
  const heading = tuning ? tuning.heading : 'Standard tuning';
  const hasCredits = !!artist || lines.length > 0;
  const editTitle = openAt(onEditCredits && ((x, y) => onEditCredits(x, y, 'title')));
  const editCredits = openAt(onEditCredits && ((x, y) => onEditCredits(x, y, 'artist')));
  const editTuning = openAt(onEditTuning);
  const editTempo = openAt(onEditTempo);
  // The first bar's tempo, always shown where it can be set (Jeremy, 2026-10-29): 120 when the clip names none.
  const tempo = clip.bars[0]?.tempo ?? (editTempo ? { bpm: DEFAULT_BPM } : null);
  return (
    <div
      className="score-head" data-testid="score-head"
      style={{ ['--title-size' as string]: `${HEAD.titleSize}px`, ['--artist-size' as string]: `${HEAD.artistSize}px`, ['--credit-size' as string]: `${HEAD.creditSize}px` }}
    >
      <h1 className="m-0 tab-title">
        <button type="button" className="tab-title-text" onClick={editTitle} disabled={!editTitle}>{clip.name.trim() || UNTITLED}</button>
      </h1>
      {note}
      {hasCredits && (
        <button type="button" className="score-credits" onClick={editCredits} disabled={!editCredits}>
          {artist && <span className="score-artist">{artist}</span>}
          {lines.map(line => <span key={line} className="score-credit">{line}</span>)}
        </button>
      )}
      {/* An unset artist: a quiet line in the credits' place, always shown (no text that appears on hover). */}
      {!hasCredits && editCredits && (
        <div className="score-head-add">
          <button type="button" className="score-add" onClick={editCredits}>Add artist and credits</button>
        </div>
      )}
      {(tuning || editTuning) && (
        <div className="score-tuning" role="group" aria-label="Tuning" style={{ paddingLeft: HEAD.tuningIndent }}>
          <button type="button" className="score-tuning-button" onClick={editTuning} disabled={!editTuning}>
            {heading && <span className="score-tuning-heading">{heading}</span>}
            {tuning && <span className="score-tuning-strings" style={{ gridTemplateRows: `repeat(${rows}, auto)`, columnGap: HEAD.tuningColumn - HEAD.tuningColumnWidth }}>
              {tuning.strings.map(s => (
                <span key={s.number} style={{ width: HEAD.tuningColumnWidth }}>
                  <span className="score-string" aria-label={`string ${s.number}`}>{s.number}</span> = {s.name}
                </span>
              ))}
            </span>}
          </button>
        </div>
      )}
      {tempo && (
        <div className="score-tempo" style={{ paddingLeft: HEAD.tuningIndent, height: HEAD.tempoLine }}>
          <button type="button" className="score-tempo-button" onClick={editTempo} disabled={!editTempo} aria-label={`Tempo: ${tempoWords(tempo)}`}>
            {tempo.label && <span>{tempo.label}</span>}
            <TempoGlyph />
            <span>= {tempo.bpm}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** A tempo as a screen reader says it: "Slowly, 92 bpm". */
function tempoWords(tempo: Tempo): string {
  return [tempo.label, `${tempo.bpm} bpm`].filter(Boolean).join(', ');
}

/** The tempo's quarter note, as the drawn tab and the exported image draw it, sized to the head's text. */
function TempoGlyph() {
  const size = HEAD.creditSize;
  const width = tempoNoteWidth(size);
  return (
    <svg width={width} height={size + 2} viewBox={`0 0 ${width} ${size + 2}`} aria-hidden="true" className="score-tempo-note">
      <TempoNote x={1} y={size - 1} size={size} ink="currentColor" />
    </svg>
  );
}
