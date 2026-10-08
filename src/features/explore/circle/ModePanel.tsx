import type { Root } from '../scales/theory';
import { ChordChips, PanelSection } from './ChordChips';
import { modeDef, type ModeId, type ModeWheel } from './circle';
import { prettyNote } from '@/lib/notation';

interface ModePanelProps {
  wheel: ModeWheel;
  onPick: (root: Root, mode: ModeId) => void;
}

/**
 * The Mode view's sections under the wheel: the mode's chords, its relative
 * modes (same notes, other roots) and its parallel modes (same root, other
 * notes). Every cell and column has a fixed width, and the relative modes
 * keep one order, so picking another root or mode moves nothing.
 */
export function ModePanel({ wheel, onPick }: ModePanelProps) {
  return (
    <>
      <PanelSection title="Chords">
        <ChordChips chips={wheel.chords} />
      </PanelSection>

      <PanelSection title="Relative modes: same notes, other roots">
        <div className="cof-relative">
          {wheel.relative.map((r, i) => (
            <button
              key={i}
              type="button"
              className="cof-relative-cell"
              aria-pressed={r.current}
              aria-label={r.label}
              data-tip={r.current
                ? `${r.label}: the mode shown.`
                : `${r.label}: the same notes as ${wheel.title}, starting on ${prettyNote(r.root)}.`}
              onClick={() => onPick(r.root, r.mode)}
            >
              <small>{prettyNote(r.root)}</small>
              {modeDef(r.mode).name}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Parallel modes: same root, other notes">
        <div className="cof-parallel-scroll">
          <table className="cof-parallel">
            <colgroup>
              <col className="cof-col-name" />
              {wheel.formula.map((_, j) => <col key={j} className="cof-col-degree" />)}
              <col className="cof-col-parent" />
            </colgroup>
            <tbody>
              {wheel.parallel.map(row => (
                <tr
                  key={row.mode}
                  tabIndex={0}
                  aria-selected={row.current}
                  className={row.current ? 'cof-row-current' : undefined}
                  onClick={() => onPick(row.root, row.mode)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPick(row.root, row.mode);
                    }
                  }}
                >
                  <th scope="row">{prettyNote(row.root)} {row.name}</th>
                  {row.degrees.map((d, j) => (
                    <td key={j} className={row.changed[j] ? 'cof-changed' : undefined}>
                      <span>{d}</span>
                    </td>
                  ))}
                  <td className="cof-parent">{row.parent} major&apos;s notes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 text-[13px] leading-5 text-(--ink-muted)">
          Brightest at the top. Each row down flattens one note (marked) and moves one spoke counterclockwise on the wheel.
        </p>
      </PanelSection>
    </>
  );
}
