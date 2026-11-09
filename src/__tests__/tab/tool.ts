import { fireEvent, screen } from '@testing-library/react';
import { PANELS } from '@/features/tab/TabRail';

/** The palettes' column (issue #454). */
export const column = () => screen.getByRole('complementary', { name: 'Palettes' });

/** A palette's header, the button that opens and folds it (a palette's own tools may share its name, as Chords' Notes does). */
export function paletteHeader(name: string): HTMLElement {
  const header = [...column().querySelectorAll<HTMLElement>('.tab-stack > section > .tab-stack-head > .tab-stack-toggle')]
    .find(b => b.textContent === name);
  if (!header) throw new Error(`No palette named ${name}`);
  return header;
}

/** A palette by name, open or folded. */
export const paletteOf = (name: string) => screen.getByRole('region', { name });

/** Opens a palette, if it is folded. */
export function openPalette(name: string) {
  const header = paletteHeader(name);
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
}

/** Folds a palette, if it is open. */
export function foldPalette(name: string) {
  const header = paletteHeader(name);
  if (header.getAttribute('aria-expanded') === 'true') fireEvent.click(header);
}

/**
 * A palette tool's button, opening the palette that holds it first if it is folded (issue #454): the tests
 * press tools from every palette.
 */
export function tool(name: string | RegExp): HTMLElement {
  const shown = screen.queryByRole('button', { name });
  if (shown) return shown;
  for (const panel of PANELS) {
    openPalette(panel.name);
    const found = screen.queryByRole('button', { name });
    if (found) return found;
  }
  // Not in any palette: fail as getByRole does.
  return screen.getByRole('button', { name });
}
