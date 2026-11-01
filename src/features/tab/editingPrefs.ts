import { DEFAULT_GRID, isGridValue, type GridValue } from './grid';

/**
 * Tab › Editing, saved as `frets.tab.editing`: how the editor treats a bar that doesn't add up, and
 * note input's grid.
 *
 * With `fillBars` on, the cursor leaving a short bar completes it with rests (`fillBar` in
 * `editing.ts`); off (the default; Jeremy, 2026-10-29), short bars stay short and the line under
 * the clip says by how much. `grid` is where note input's cursor stops inside a rest and what a press
 * there snaps to (`grid.ts`, issue #293), also set by the palette's Grid button and Alt+[ ].
 */
export const EDITING_KEY = 'frets.tab.editing';

export interface EditingPrefs {
  fillBars: boolean;
  grid: GridValue;
}

export const DEFAULT_EDITING: EditingPrefs = { fillBars: false, grid: DEFAULT_GRID };

export function parseEditing(raw: unknown): EditingPrefs {
  const fields = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    fillBars: typeof fields.fillBars === 'boolean' ? fields.fillBars : DEFAULT_EDITING.fillBars,
    grid: isGridValue(fields.grid) ? fields.grid : DEFAULT_EDITING.grid,
  };
}
