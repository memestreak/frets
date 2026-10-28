/**
 * The head of the drawn score, as a printed score's first page has it (Jeremy, 2026-10-28,
 * `docs/specs/2026-10-28-tab-score-head-design.md`): the title in the middle (a click renames the clip),
 * the artist in bold and who wrote the words and music under it, then the tuning on the left. It
 * stands over the drawing and is zoomed with it; the exported image draws the same in SVG
 * (`exportTab.tsx`), from the same sizes (`HEAD`).
 */
import type { ReactNode } from 'react';
import { ClipTitle } from './ClipTitle';
import type { Clip } from './clip';
import { creditsOf, HEAD, tuningBlock } from './credits';

export function ScoreHead({ clip, onRename, note }: {
  clip: Clip;
  onRename: (name: string) => void;
  /** A line under the title, as the example note ("Example: edits aren't saved"). */
  note?: ReactNode;
}) {
  const { artist, lines } = creditsOf(clip);
  const tuning = tuningBlock(clip.tuning);
  const rows = tuning ? Math.min(3, tuning.strings.length) : 0;
  return (
    <div
      className="score-head" data-testid="score-head"
      style={{ ['--title-size' as string]: `${HEAD.titleSize}px`, ['--artist-size' as string]: `${HEAD.artistSize}px`, ['--credit-size' as string]: `${HEAD.creditSize}px` }}
    >
      <ClipTitle name={clip.name} onRename={onRename} />
      {note}
      {artist && <p className="score-artist">{artist}</p>}
      {lines.map(line => <p key={line} className="score-credit">{line}</p>)}
      {tuning && (
        <div className="score-tuning" aria-label="Tuning" style={{ paddingLeft: HEAD.tuningIndent }}>
          {tuning.heading && <p>{tuning.heading}</p>}
          <ul style={{ gridTemplateRows: `repeat(${rows}, auto)`, columnGap: HEAD.tuningColumn - HEAD.tuningColumnWidth }}>
            {tuning.strings.map(s => (
              <li key={s.number} style={{ width: HEAD.tuningColumnWidth }}>
                <span className="score-string" aria-label={`string ${s.number}`}>{s.number}</span> = {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
