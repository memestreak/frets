import { ChordDiagram } from './ChordDiagram';
import type { ChordInfo } from './chordTypes';
import { voicingCaption, voicingKey, type Voicing, type Voicings } from './voicings';

interface VoicingGroupsProps {
  chord: ChordInfo;
  voicings: Voicings;
  /** Moveable shows every shape rather than the best few. */
  showAll: boolean;
  onShowAll: (showAll: boolean) => void;
  /** `voicingKey` of the voicing on the neck. */
  selectedKey: string | null;
  onSelect: (voicing: Voicing) => void;
}

/**
 * The Open and Moveable groups of diagrams, five per line. Under Moveable,
 * a link switches between the best few and every shape.
 */
export function VoicingGroups({
  chord, voicings, showAll, onShowAll, selectedKey, onSelect,
}: VoicingGroupsProps) {
  const { open, moveable, allMoveable } = voicings;
  const hasMore = allMoveable.length > moveable.length;
  const name = chord.symbol || 'these notes';
  return (
    <div className="grid gap-5">
      <VoicingGroup
        title="Open" chord={chord} voicings={open}
        emptyText={`No open shape for ${name}.`}
        selectedKey={selectedKey} onSelect={onSelect}
      />
      <VoicingGroup
        title="Moveable" chord={chord} voicings={showAll ? allMoveable : moveable}
        emptyText={`No moveable shape for ${name}.`}
        selectedKey={selectedKey} onSelect={onSelect}
      />
      {hasMore && (
        <button
          type="button" className="btn btn-ghost justify-self-start"
          onClick={() => onShowAll(!showAll)}
        >
          {showAll ? 'Show the best few' : `Show all ${allMoveable.length} shapes`}
        </button>
      )}
    </div>
  );
}

interface VoicingGroupProps {
  title: string;
  chord: ChordInfo;
  voicings: Voicing[];
  emptyText: string;
  selectedKey: string | null;
  onSelect: (voicing: Voicing) => void;
}

/** A titled group of diagram buttons, or a line saying there are none. */
function VoicingGroup({
  title, chord, voicings, emptyText, selectedKey, onSelect,
}: VoicingGroupProps) {
  return (
    <section className="grid gap-2" aria-label={`${title} shapes`}>
      <h2 className="m-0 text-[17px] leading-6">{title}</h2>
      {voicings.length ? (
        <div className="shape-grid">
          {voicings.map((v, i) => (
            <button
              key={voicingKey(v)} type="button" className="shape-btn"
              aria-pressed={voicingKey(v) === selectedKey}
              aria-label={`${title} shape ${i + 1}: ${voicingCaption(v)}`}
              data-voicing={voicingKey(v)}
              onClick={() => onSelect(v)}
            >
              <ChordDiagram chord={chord} voicing={v} />
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 text-(--ink-muted)">{emptyText}</p>
      )}
    </section>
  );
}
