/**
 * Tab › Editing, saved as `frets.tab.editing`: how the editor treats a bar that doesn't add up.
 * With `fillBars` on, the cursor leaving a short bar completes it with rests (`fillBar` in
 * `editing.ts`); off (the default; Jeremy, 2026-10-29), short bars stay short and the line under
 * the clip says by how much.
 */
export const EDITING_KEY = 'frets.tab.editing';

export interface EditingPrefs {
  fillBars: boolean;
}

export const DEFAULT_EDITING: EditingPrefs = { fillBars: false };

export function parseEditing(raw: unknown): EditingPrefs {
  const fields = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { fillBars: typeof fields.fillBars === 'boolean' ? fields.fillBars : DEFAULT_EDITING.fillBars };
}
