/**
 * The head of the drawn score, as a printed score's first page has it (Jeremy, 2026-10-28,
 * `docs/specs/2026-10-28-tab-score-head-design.md`): the title in the middle (a click renames the clip),
 * the artist in bold and who wrote the words and music under it, then the tuning on the left. It
 * stands over the drawing and is zoomed with it; the exported image draws the same in SVG
 * (`exportTab.tsx`), from the same sizes (`HEAD`).
 *
 * A press on the credits or the tuning opens its panel there (issues #202, #203,
 * `docs/specs/2026-10-29-tab-credits-tuning-design.md`). With none set, a button adds it.
 */
import { useState, type MouseEvent, type ReactNode } from 'react';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { ClipTitle } from './ClipTitle';
import type { Clip } from './clip';
import { creditsOf, HEAD, tuningBlock } from './credits';

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

/**
 * MOCK (?mock=a/b/c): how an unset tuning or credits is added. 'text': muted "Add tuning" and "Add artist
 * and credits" always shown at the head's foot; 'plus': a small round + there, whose menu lists them;
 * 'none': nothing in the head (the clip's bar has the button).
 */
export type HeadAdd = 'text' | 'plus' | 'none';

export function ScoreHead({ clip, onRename, note, onEditCredits, onEditTuning, add = 'text' }: {
  clip: Clip;
  onRename: (name: string) => void;
  /** A line under the title, as the example note ("Example: edits aren't saved"). */
  note?: ReactNode;
  onEditCredits?: OpenAt;
  onEditTuning?: OpenAt;
  add?: HeadAdd;
}) {
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const { artist, lines } = creditsOf(clip);
  const tuning = tuningBlock(clip.tuning);
  const rows = tuning ? Math.min(3, tuning.strings.length) : 0;
  const hasCredits = !!artist || lines.length > 0;
  const editCredits = openAt(onEditCredits);
  const editTuning = openAt(onEditTuning);
  return (
    <div
      className="score-head" data-testid="score-head"
      style={{ ['--title-size' as string]: `${HEAD.titleSize}px`, ['--artist-size' as string]: `${HEAD.artistSize}px`, ['--credit-size' as string]: `${HEAD.creditSize}px` }}
    >
      <ClipTitle name={clip.name} onRename={onRename} />
      {note}
      {hasCredits && (
        <button type="button" className="score-credits" onClick={editCredits} disabled={!editCredits}>
          {artist && <span className="score-artist">{artist}</span>}
          {lines.map(line => <span key={line} className="score-credit">{line}</span>)}
        </button>
      )}
      {tuning && (
        <div className="score-tuning" role="group" aria-label="Tuning" style={{ paddingLeft: HEAD.tuningIndent }}>
          <button type="button" className="score-tuning-button" onClick={editTuning} disabled={!editTuning}>
            {tuning.heading && <span className="score-tuning-heading">{tuning.heading}</span>}
            <span className="score-tuning-strings" style={{ gridTemplateRows: `repeat(${rows}, auto)`, columnGap: HEAD.tuningColumn - HEAD.tuningColumnWidth }}>
              {tuning.strings.map(s => (
                <span key={s.number} style={{ width: HEAD.tuningColumnWidth }}>
                  <span className="score-string" aria-label={`string ${s.number}`}>{s.number}</span> = {s.name}
                </span>
              ))}
            </span>
          </button>
        </div>
      )}
      {/* The ways in to what isn't set. */}
      {add !== 'none' && ((!hasCredits && editCredits) || (!tuning && editTuning)) ? (
        <div className={`score-head-add score-head-add-${add}`} style={{ paddingLeft: HEAD.tuningIndent }}>
          {add === 'text' && <>
            {!tuning && editTuning && <button type="button" className="score-add score-add-tuning" onClick={editTuning}>Add tuning</button>}
            {!hasCredits && editCredits && <button type="button" className="score-add score-add-credits" onClick={editCredits}>Add artist and credits</button>}
          </>}
          {add === 'plus' && (
            <button
              type="button" className="score-add-plus" aria-label="Add tuning or credits" title="Add tuning or credits"
              aria-haspopup="menu" aria-expanded={addMenu !== null}
              onClick={e => {
                const box = e.currentTarget.getBoundingClientRect();
                setAddMenu(e.detail === 0 ? { x: box.left, y: box.bottom + 4 } : { x: e.clientX, y: e.clientY + 8 });
              }}
            >
              +
            </button>
          )}
        </div>
      ) : null}
      {addMenu && (
        <ShapeMenu
          x={addMenu.x} y={addMenu.y} label="Add to the score head" onClose={() => setAddMenu(null)}
          items={[
            ...(!tuning && onEditTuning ? [{ label: 'Tuning…', onSelect: () => onEditTuning(addMenu.x, addMenu.y) }] : []),
            ...(!hasCredits && onEditCredits ? [{ label: 'Artist and credits…', onSelect: () => onEditCredits(addMenu.x, addMenu.y) }] : []),
          ]}
        />
      )}
    </div>
  );
}
