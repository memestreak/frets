import { DEFAULT_GRID, DEFAULT_GRID_LOOK, isGridLook, isGridValue, type GridLook, type GridValue } from './grid';

/**
 * Tab › Editing, saved as `frets.tab.editing`: note input mode's grid. (Bars are always full since step 4,
 * so the old "Fill short bars with rests" is gone; `docs/specs/2026-11-04-tab-bars-always-full-design.md`.)
 * Note input mode's grid (`grid.ts`, issue #293) is where its cursor stops inside
 * a rest and what a press there snaps to: note input mode's length by default, or with `fixedGrid` on, `grid`;
 * `gridLook` is how it is drawn over the cursor's bar.
 * The palette's Grid button, Alt+G and Alt+[ ] change them too.
 * `chordNames` is which name Chord from notes writes under a capo (issue #464): the shape's, counted from the
 * capo, or the sounding notes'.
 */
export const EDITING_KEY = 'frets.tab.editing';

export interface EditingPrefs {
  /** The grid is fixed at `grid`, not note input mode's length (Alt+G switches). */
  fixedGrid: boolean;
  grid: GridValue;
  /** How the grid is drawn over the cursor's bar: a ruler over the staff, or lines across the bar. */
  gridLook: GridLook;
  /** Chord from notes under a capo: the shape's name (5 5 5 7 under Capo 2 is Am) or the sounding one (Bm). */
  chordNames: ChordNames;
}

export type ChordNames = 'shape' | 'sounding';
export const CHORD_NAMES: readonly ChordNames[] = ['shape', 'sounding'];

export const DEFAULT_EDITING: EditingPrefs = { fixedGrid: false, grid: DEFAULT_GRID, gridLook: DEFAULT_GRID_LOOK, chordNames: 'shape' };

export function parseEditing(raw: unknown): EditingPrefs {
  const fields = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    fixedGrid: typeof fields.fixedGrid === 'boolean' ? fields.fixedGrid : DEFAULT_EDITING.fixedGrid,
    grid: isGridValue(fields.grid) ? fields.grid : DEFAULT_EDITING.grid,
    gridLook: isGridLook(fields.gridLook) ? fields.gridLook : DEFAULT_EDITING.gridLook,
    chordNames: CHORD_NAMES.includes(fields.chordNames as ChordNames) ? fields.chordNames as ChordNames : DEFAULT_EDITING.chordNames,
  };
}
