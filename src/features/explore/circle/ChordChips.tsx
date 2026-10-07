import type { ReactNode } from 'react';
import { DEGREES } from '@/components/fretboard/theme';
import type { ChordChip } from './circle';

/** A titled section under the wheel. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h2 className="cof-heading">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Chords as fixed-width chips, numeral over name, in their degree colour:
 * filled for the key's or mode's own chords, a dashed border for chords
 * from outside, an ink ring where the wheel rings the cell too.
 */
export function ChordChips({ chips }: { chips: readonly ChordChip[] }) {
  return (
    <ul className="cof-chips">
      {chips.map(c => {
        const degree = DEGREES[c.degree - 1];
        const style = c.outside
          ? { borderColor: `var(--degree-${degree})` }
          : { background: `var(--degree-${degree})`, borderColor: `var(--degree-${degree})`, color: `var(--on-degree-${degree})` };
        const classes = ['cof-chip'];
        if (c.outside) classes.push('cof-chip-outside');
        if (c.ringed) classes.push('cof-chip-ringed');
        return (
          <li key={`${c.numeral} ${c.name}`} className={classes.join(' ')} style={style} data-tip={c.tip}>
            <small>{c.numeral}</small>
            {c.name}
          </li>
        );
      })}
    </ul>
  );
}
