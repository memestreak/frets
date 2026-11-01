/**
 * The head of the drawn score, as a printed score's first page has it (Jeremy, 2026-10-28,
 * `docs/specs/2026-10-28-tab-score-head-design.md`): the title in the middle, the artist in bold and who wrote the words and music under it, then the tuning on the left. It
 * stands over the drawing and is zoomed with it; the exported image draws the same in SVG
 * (`exportTab.tsx`), from the same sizes (`HEAD`).
 *
 * A press on the title or the credits picks the two together (issue #281): one outline round both,
 * with Edit and Collapse beside it. Edit or Enter opens the one Title and credits panel, on the title;
 * a double-click opens it on the line pressed (issue #227). Collapse folds the head to the title in
 * small text over the clip, after Size (`FoldedTitle`, the View options' Arrangement header), which is
 * picked and edited the same way, with Expand in Collapse's place. Esc, or the focus going elsewhere,
 * lets either go. The tuning is picked the same way (issue #296): Edit (or Enter, or a double-click)
 * opens its panel (issues #202, #203, `docs/specs/2026-10-29-tab-credits-tuning-design.md`), and a
 * named tuning with strings listed has Collapse tuning, which hides the strings and keeps the name
 * (the View options' Tuning details), then Expand tuning. The tuning is always shown, as "Standard
 * tuning" when it is; an unset artist has a quiet "Add artist and credits" under the title. Under the tuning,
 * the first bar's tempo ("♩ = 120" when none is set), whose press opens the tempo panel
 * (`docs/specs/2026-10-29-tab-tempo-button-design.md`).
 */
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { CollapseIcon, ExpandIcon, PencilIcon } from '@/components/icons';
import { DEFAULT_BPM, UNTITLED, type Part, type Tempo } from './clip';
import type { HeadField } from './CreditsPanel';
import { creditsOf, foldsTuning, HEAD, shownTuning, tuningBlock } from './credits';
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

export function ScoreHead({ clip, folded = false, tuningFolded = false, onEditCredits, onCollapse, onFoldTuning, onEditTuning, onEditTempo }: {
  clip: Part;
  /** The title and credits folded away (shown small over the clip instead): the tuning and tempo stay. */
  folded?: boolean;
  /** The tuning's strings hidden, its name kept (issue #296). */
  tuningFolded?: boolean;
  /** Collapses (true) or expands (false) the tuning's strings. */
  onFoldTuning?: (fold: boolean) => void;
  /** Opens the Title and credits panel with `field`'s field focused. */
  onEditCredits?: (x: number, y: number, field: HeadField) => void;
  /** Folds the head away to the small title over the clip. */
  onCollapse?: () => void;
  onEditTuning?: OpenAt;
  onEditTempo?: OpenAt;
}) {
  const { artist, lines } = creditsOf(clip);
  const full = tuningBlock(clip.tuning);
  const tuning = shownTuning(full, !tuningFolded);
  // Only a named tuning that lists its strings folds; folded, it unfolds (issue #296).
  const tuningTool = onFoldTuning && (tuningFolded
    ? { label: 'Expand tuning', icon: <ExpandIcon />, onClick: () => onFoldTuning(false) }
    : foldsTuning(full) ? { label: 'Collapse tuning', icon: <CollapseIcon />, onClick: () => onFoldTuning(true) } : undefined);
  const rows = tuning ? Math.min(3, tuning.strings.length) : 0;
  // Always shown (Jeremy, 2026-10-29): standard tuning is named, so a press on it opens the tuning panel.
  const heading = tuning ? tuning.heading : 'Standard tuning';
  const hasCredits = !!artist || lines.length > 0;
  const editCredits = openAt(onEditCredits && ((x, y) => onEditCredits(x, y, 'artist')));
  const editTempo = openAt(onEditTempo);
  // The first bar's tempo, always shown where it can be set (Jeremy, 2026-10-29): 120 when the clip names none.
  const tempo = clip.bars[0]?.tempo ?? (editTempo ? { bpm: DEFAULT_BPM } : null);
  return (
    <div
      className="score-head" data-testid="score-head"
      style={{ ['--title-size' as string]: `${HEAD.titleSize}px`, ['--artist-size' as string]: `${HEAD.artistSize}px`, ['--credit-size' as string]: `${HEAD.creditSize}px` }}
    >
      {!folded && (
        <HeadPick<HeadField>
          onEdit={onEditCredits && ((field, el) => editUnder(el, field, onEditCredits))} editLabel="Edit title and credits" editField="title"
          tool={onCollapse && { label: 'Collapse header', icon: <CollapseIcon />, onClick: onCollapse }}
          className="score-head-pick"
        >
          {press => <>
            <h1 className="m-0 tab-title">
              <button type="button" className="tab-title-text" {...press('title')}>{clip.name.trim() || UNTITLED}</button>
            </h1>
            {hasCredits && (
              <button type="button" className="score-credits" {...press('artist')}>
                {artist && <span className="score-artist">{artist}</span>}
                {lines.map(line => <span key={line} className="score-credit">{line}</span>)}
              </button>
            )}
          </>}
        </HeadPick>
      )}
      {/* An unset artist: a quiet line in the credits' place, always shown (no text that appears on hover). */}
      {!folded && !hasCredits && editCredits && (
        <div className="score-head-add">
          <button type="button" className="score-add" onClick={editCredits}>Add artist and credits</button>
        </div>
      )}
      {(tuning || onEditTuning) && (
        <div className="score-tuning" role="group" aria-label="Tuning" style={{ paddingLeft: HEAD.tuningIndent }}>
          <HeadPick
            onEdit={onEditTuning && ((_, el) => { const box = el.getBoundingClientRect(); onEditTuning(box.left, box.bottom + 4); })}
            editLabel="Edit tuning" editField="tuning" tool={tuningTool} className="score-tuning-pick"
          >
            {press => (
              <button type="button" className="score-tuning-button" {...press('tuning')}>
                {heading && <span className="score-tuning-heading">{heading}</span>}
                {tuning && tuning.strings.length > 0 && <span className="score-tuning-strings" style={{ gridTemplateRows: `repeat(${rows}, auto)`, columnGap: HEAD.tuningColumn - HEAD.tuningColumnWidth }}>
                  {tuning.strings.map(s => (
                    <span key={s.number} style={{ width: HEAD.tuningColumnWidth }}>
                      <span className="score-string" aria-label={`string ${s.number}`}>{s.number}</span> = {s.name}
                    </span>
                  ))}
                </span>}
              </button>
            )}
          </HeadPick>
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

/** Opens the Title and credits panel under `el`, as a key press would, on `field`. */
function editUnder(el: HTMLElement, field: HeadField, open: (x: number, y: number, field: HeadField) => void) {
  const box = el.getBoundingClientRect();
  open(box.left, box.bottom + 4, field);
}

/** What `HeadPick` gives each of its buttons: a press picks, a double-click edits. */
type Press<F extends string> = (field: F) => {
  onClick: () => void;
  onDoubleClick: (e: MouseEvent<HTMLElement>) => void;
  disabled: boolean;
  'aria-pressed'?: boolean;
  'data-head-field': F;
};

/**
 * The title and credits, or the folded title: a press on any of its buttons picks the whole, one
 * outline round it, with Edit and one more tool (Collapse or Expand) to its right. Enter while picked
 * or Edit opens the panel (Enter on the line it is on, Edit on the title); a double-click opens it on
 * the line pressed. Esc or the focus leaving it and its tools lets it go. Without `onEdit` (the head
 * not editable) it is plain text.
 */
function HeadPick<F extends string>({ onEdit: open, editLabel, editField, tool, className, children }: {
  onEdit?: (field: F, el: HTMLElement) => void;
  /** The Edit button's name, and the field it opens the panel on. */
  editLabel: string;
  editField: F;
  tool?: { label: string; icon: ReactNode; onClick: () => void };
  className: string;
  children: (press: Press<F>) => ReactNode;
}) {
  // Its own, so folding it away (or opening the panel) never leaves it picked when it comes back.
  const [picked, onPick] = useState(false);
  const onEdit = open && ((field: F, el: HTMLElement) => {
    onPick(false);
    open(field, el);
  });
  const press: Press<F> = field => ({
    onClick: () => { if (!picked) onPick(true); },
    // A double-click edits it too (Jeremy, 2026-11-01): its first click picks it.
    onDoubleClick: e => onEdit?.(field, e.currentTarget),
    disabled: !onEdit,
    'aria-pressed': onEdit ? picked : undefined,
    'data-head-field': field,
  });
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!picked) return;
    const field = (e.target as HTMLElement).dataset.headField as F | undefined;
    if (e.key === 'Escape') {
      e.stopPropagation();
      onPick(false);
      (document.activeElement as HTMLElement | null)?.blur();
    } else if (e.key === 'Enter' && field) {
      // Enter on the picked one edits it, as Enter edits a picked word over the tab.
      e.preventDefault();
      onEdit?.(field, e.target as HTMLElement);
    }
  };
  // The tools keep the focus on what is picked, so it stays picked.
  const keep = (e: MouseEvent) => e.preventDefault();
  return (
    // Its keys are its buttons': Enter edits, Esc lets the pick go. It keeps the focus while picked (the
    // app lets go of a pressed button), so those keys reach it.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`score-pick ${className}${picked ? ' score-picked' : ''}`} data-keep-focus onKeyDown={onKeyDown}
      onBlur={e => { if (picked && !e.currentTarget.contains(e.relatedTarget as Node | null)) onPick(false); }}
    >
      {children(press)}
      {picked && onEdit && (
        <span className="score-pick-tools" data-testid="head-tools">
          <button
            type="button" className="score-pick-tool" aria-label={editLabel} data-tip="Edit (Enter)" onMouseDown={keep}
            onClick={e => {
              const target = e.currentTarget.closest('.score-pick')!.querySelector<HTMLElement>(`[data-head-field="${editField}"]`)!;
              onEdit(editField, target);
            }}
          >
            <PencilIcon />
          </button>
          {tool && (
            <button
              type="button" className="score-pick-tool" aria-label={tool.label} data-tip={tool.label} onMouseDown={keep}
              onClick={() => { onPick(false); tool.onClick(); }}
            >
              {tool.icon}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * The arrangement header folded (issue #281): the title in small text over the clip, after Size.
 * Picked and edited as the full head is, with Expand in Collapse's place.
 */
export function FoldedTitle({ clip, onEditCredits, onExpand }: {
  clip: Part;
  onEditCredits: (x: number, y: number, field: HeadField) => void;
  onExpand: () => void;
}) {
  return (
    <HeadPick<HeadField>
      onEdit={(field, el) => editUnder(el, field, onEditCredits)} editLabel="Edit title and credits" editField="title"
      tool={{ label: 'Expand header', icon: <ExpandIcon />, onClick: onExpand }}
      className="tab-head-folded-pick"
    >
      {press => <button type="button" className="tab-head-folded" {...press('title')}>{clip.name.trim() || UNTITLED}</button>}
    </HeadPick>
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
