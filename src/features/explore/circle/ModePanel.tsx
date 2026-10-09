import { DEGREES } from '@/components/fretboard/theme';
import { PanelSection } from './ChordChips';
import type { ModeId, ModeWheel, ParallelRow } from './circle';

interface ModePanelProps {
  wheel: ModeWheel;
  onPick: (root: string, mode: ModeId) => void;
  /** A row is hovered or focused: the wheel outlines its run. Null when none is. */
  onPreview: (spoke: number | null) => void;
}

/**
 * The Advanced view's section beside the wheel: every mode on the same root,
 * brightest first, as its seven chords. The current row is in its degree
 * colours, like the wheel; elsewhere a chord the current mode shares is
 * plain, and one it lacks has a dashed border in its degree colour: a
 * chord to borrow. Every column has a fixed width, so picking a row moves
 * nothing.
 */
export function ModePanel({ wheel, onPick, onPreview }: ModePanelProps) {
  return (
    <PanelSection title="Parallel modes: same root, other notes">
      <div className="cof-parallel-scroll">
        <table className="cof-parallel">
          <colgroup>
            <col className="cof-col-name" />
            {wheel.formula.map((_, j) => <col key={j} className="cof-col-chord" />)}
            <col className="cof-col-swap" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Mode</span></th>
              {wheel.formula.map((_, j) => <th key={j} scope="col">{j + 1}</th>)}
              <th scope="col" className="cof-swap">Swap</th>
            </tr>
          </thead>
          <tbody onPointerLeave={() => onPreview(null)}>
            {wheel.parallel.map(row => (
              <Row key={row.mode} row={row} onPick={onPick} onPreview={onPreview} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[13px] leading-5 text-(--ink-muted)">
        Brightest at the top. Each row down slides the lit notes one spoke counterclockwise: one note leaves, and comes back a semitone lower.
      </p>
    </PanelSection>
  );
}

function Row({ row, onPick, onPreview }: { row: ParallelRow } & Omit<ModePanelProps, 'wheel'>) {
  const pick = () => onPick(row.root, row.mode);
  return (
    <tr
      tabIndex={0}
      aria-selected={row.current}
      className={row.current ? 'cof-row-current' : undefined}
      onClick={pick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      }}
      onPointerEnter={() => onPreview(row.spoke)}
      onFocus={() => onPreview(row.spoke)}
      onBlur={() => onPreview(null)}
    >
      <th scope="row" data-tip={row.tip} aria-label={row.title}>
        <span className="cof-row-root">{row.title.slice(0, -row.name.length)}</span>
        {row.name}
      </th>
      {row.chords.map((c, j) => {
        const degree = DEGREES[c.degree - 1];
        const style = row.current
          ? { background: `var(--degree-${degree})`, borderColor: `var(--degree-${degree})`, color: `var(--on-degree-${degree})` }
          : c.same ? undefined : { borderColor: `var(--degree-${degree})` };
        const classes = ['cof-table-chord'];
        if (!row.current) classes.push(c.same ? 'cof-table-same' : 'cof-table-borrow');
        return (
          <td key={j} data-tip={c.tip}>
            <span className={classes.join(' ')} style={style}>
              <small>{c.numeral}</small>
              {c.name}
            </span>
          </td>
        );
      })}
      <td className="cof-swap">{row.swap}</td>
    </tr>
  );
}
