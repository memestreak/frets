import type { ChordName } from '../naming';

interface NameListProps {
  names: ChordName[];
  selected: number;
  onSelect: (index: number) => void;
  /** Shown when there are no names. */
  emptyText: string;
}

/** Every name for the notes on the neck, best first; the chosen one is pressed. */
export function NameList({ names, selected, onSelect, emptyText }: NameListProps) {
  if (!names.length) return <p className="m-0 text-(--ink-muted)">{emptyText}</p>;
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {names.map((name, i) => (
        <li key={name.symbol}>
          <button
            type="button" className="name-btn"
            aria-pressed={i === selected} onClick={() => onSelect(i)}
          >
            <b>{name.symbol}</b> <span>{name.why}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
