import { useEffect } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { ToneKey } from '@/components/chords/ToneKey';
import type { ChordInfo } from '@/lib/chords/chordTypes';
import { voicingCaption, voicingKey, type Voicing, type Voicings } from '@/lib/chords/voicings';

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
 * The Open and Moveable groups of diagrams, five per line (three on
 * phones), under a key to the dot colours. Under Moveable, a
 * link switches between the best few and every shape. ← and → select the
 * previous or next shape, in the order shown.
 */
export function VoicingGroups({
  chord, voicings, showAll, onShowAll, selectedKey, onSelect,
}: VoicingGroupsProps) {
  const { open, moveable, allMoveable } = voicings;
  const hasMore = allMoveable.length > moveable.length;
  const name = chord.symbol || 'these notes';
  const shown = [...open, ...(showAll ? allMoveable : moveable)];
  useArrowSteps(shown, selectedKey, onSelect);
  return (
    <div className="grid gap-5">
      <ToneKey chord={chord} />
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

/**
 * ← and → anywhere on the page select the previous or next shape in
 * `shapes`, stopping at the ends; with no shape selected, → selects the
 * first. Keys a field or the fretboard already used are left alone.
 */
function useArrowSteps(
  shapes: Voicing[], selectedKey: string | null, onSelect: (voicing: Voicing) => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea')) return;
      const index = shapes.findIndex(v => voicingKey(v) === selectedKey);
      const next = shapes[e.key === 'ArrowRight' ? index + 1 : index - 1];
      if (!next) return;
      e.preventDefault();
      onSelect(next);
      // Keep focus and scroll with the selection.
      const btn = document.querySelector<HTMLElement>(`[data-voicing="${voicingKey(next)}"]`);
      if (document.activeElement?.classList.contains('shape-btn')) btn?.focus();
      btn?.scrollIntoView?.({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shapes, selectedKey, onSelect]);
}
