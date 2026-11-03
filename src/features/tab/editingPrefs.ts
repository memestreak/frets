import { DEFAULT_GRID, isGridValue, type GridValue } from './grid';

/**
 * Tab › Editing, saved as `frets.tab.editing`: how the editor treats a bar that doesn't add up, and
 * note input's grid.
 *
 * With `fillBars` on, the cursor leaving a short bar completes it with rests (`fillBar` in
 * `editing.ts`); off (the default; Jeremy, 2026-10-29), short bars stay short and the line under
 * the clip says by how much. Note input's grid (`grid.ts`, issue #293) is where its cursor stops inside
 * a rest and what a press there snaps to: note input's length by default, or with `fixedGrid` on, `grid`.
 * The palette's Grid button, Alt+G and Alt+[ ] change them too.
 */
export const EDITING_KEY = 'frets.tab.editing';

export interface EditingPrefs {
  fillBars: boolean;
  /** The grid is fixed at `grid`, not note input's length (Alt+G switches). */
  fixedGrid: boolean;
  grid: GridValue;
}

export const DEFAULT_EDITING: EditingPrefs = { fillBars: false, fixedGrid: false, grid: DEFAULT_GRID };

export function parseEditing(raw: unknown): EditingPrefs {
  const fields = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    fillBars: typeof fields.fillBars === 'boolean' ? fields.fillBars : DEFAULT_EDITING.fillBars,
    fixedGrid: typeof fields.fixedGrid === 'boolean' ? fields.fixedGrid : DEFAULT_EDITING.fixedGrid,
    grid: isGridValue(fields.grid) ? fields.grid : DEFAULT_EDITING.grid,
  };
}
