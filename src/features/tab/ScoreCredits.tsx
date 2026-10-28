/**
 * Under the clip's title, as a printed score has them: the artist, who wrote the words and music,
 * and the tuning when it isn't standard (`credits.ts`). Nothing when the clip has none of these.
 */
import type { Clip } from './clip';
import { creditsOf, tuningBlock } from './credits';

export function ScoreCredits({ clip }: { clip: Clip }) {
  const { artist, lines } = creditsOf(clip);
  const tuning = tuningBlock(clip.tuning);
  if (!artist && lines.length === 0 && !tuning) return null;
  return (
    <div className="score-credits" data-testid="score-credits">
      {artist && <p className="score-artist">{artist}</p>}
      {lines.map(line => <p key={line}>{line}</p>)}
      {tuning && (
        <div className="score-tuning" aria-label="Tuning">
          {tuning.heading && <p>{tuning.heading}</p>}
          <ul style={{ gridTemplateRows: `repeat(${Math.min(3, tuning.strings.length)}, auto)` }}>
            {tuning.strings.map(s => (
              <li key={s.number}>
                <span className="score-string" aria-label={`string ${s.number}`}>{s.number}</span> = {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
